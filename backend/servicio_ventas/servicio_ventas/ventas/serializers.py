from rest_framework import serializers
from .models import Order, OrderDetails, Shipment, Payment
from decimal import Decimal
import logging

from .service_client import RobustServiceClient
from .events import EventPublisher

logger = logging.getLogger(__name__)


class OrderDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderDetails
        fields = '__all__'
        read_only_fields = ('order',)


class OrderDetailCreateSerializer(serializers.Serializer):
    """Serializer para crear detalles de orden anidados"""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=0)  # CLP sin decimales
    discount = serializers.DecimalField(max_digits=12, decimal_places=0, default=0)  # CLP sin decimales
    
    def validate(self, data):
        """Validar que el producto tenga stock disponible"""
        from .services import InventoryService
        
        product_id = data.get('product_id')
        quantity = data.get('quantity')
        
        # Verificar disponibilidad del producto
        availability = InventoryService.check_product_availability(product_id, quantity)
        
        if not availability.get('success'):
            raise serializers.ValidationError({
                'product_id': f"Error al verificar producto {product_id}: {availability.get('error')}"
            })
        
        if not availability.get('available'):
            current_stock = availability.get('current_quantity', 0)
            product_name = availability.get('product_name', f'Producto #{product_id}')
            
            if current_stock == 0:
                raise serializers.ValidationError({
                    'product_id': f"{product_name} no tiene stock disponible. No se puede agregar a la orden."
                })
            else:
                raise serializers.ValidationError({
                    'quantity': f"{product_name} solo tiene {current_stock} unidades disponibles. "
                                f"No se pueden agregar {quantity} unidades."
                })
        
        return data


class OrderSerializer(serializers.ModelSerializer):
    details = OrderDetailCreateSerializer(many=True, write_only=True, required=False)
    details_read = OrderDetailsSerializer(many=True, read_only=True, source='details')
    customer_name = serializers.SerializerMethodField()
    order_date = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = Order
        fields = ('id', 'customer_id', 'customer_name', 'order_date', 'confirmed_at', 'confirmed_by_id', 
                  'created_by_id', 'employee_id', 'warehouse_id', 'status', 'total', 'notes', 
                  'inventory_updated', 'created_at', 'updated_at', 'details', 'details_read')
        read_only_fields = ('total', 'customer_name')
    
    def get_customer_name(self, obj):
        """
        Retorna un placeholder. El nombre real se obtiene del frontend usando el mapa de clientes.
        """
        # El backend devuelve un placeholder; el frontend hace lookup en su mapa
        return f'Cliente #{obj.customer_id}'
    
    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        
        # Remover order_date si viene vacío o None
        if 'order_date' in validated_data and validated_data['order_date'] is None:
            validated_data.pop('order_date')
        
        # Calcular el total
        total = Decimal('0.00')
        for detail in details_data:
            subtotal = Decimal(str(detail['quantity'])) * Decimal(str(detail['unit_price']))
            discount_amount = subtotal * (Decimal(str(detail.get('discount', 0))) / Decimal('100'))
            subtotal_with_discount = subtotal - discount_amount
            total += subtotal_with_discount
        
        # Crear la orden
        validated_data['total'] = total
        order = Order.objects.create(**validated_data)
        
        # Crear los detalles
        for detail_data in details_data:
            OrderDetails.objects.create(
                order=order,
                product_id=detail_data['product_id'],
                quantity=detail_data['quantity'],
                unit_price=detail_data['unit_price'],
                discount=detail_data.get('discount', 0)
            )
        
        # Publicar evento de orden creada
        try:
            publisher = EventPublisher()
            publisher.publish_order_created(
                order_id=order.id,
                customer_id=order.customer_id,
                total=float(order.total),
                details_count=len(details_data)
            )
            logger.info(f"Evento 'order.created' publicado para orden #{order.id}")
        except Exception as e:
            logger.error(
                f"Error publicando evento de orden creada {order.id}: {str(e)}"
            )
            # No fallar la creación de la orden si hay error en eventos
        
        return order
    
    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', None)
        
        # Guardar estado anterior para detectar cambios
        old_status = instance.status
        
        # Actualizar campos de la orden
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Si se enviaron detalles, actualizar
        if details_data is not None:
            # Eliminar detalles existentes
            instance.details.all().delete()
            
            # Recalcular total
            total = Decimal('0.00')
            for detail in details_data:
                subtotal = Decimal(str(detail['quantity'])) * Decimal(str(detail['unit_price']))
                discount_amount = subtotal * (Decimal(str(detail.get('discount', 0))) / Decimal('100'))
                subtotal_with_discount = subtotal - discount_amount
                total += subtotal_with_discount
            
            instance.total = total
            
            # Crear nuevos detalles
            for detail_data in details_data:
                OrderDetails.objects.create(
                    order=instance,
                    product_id=detail_data['product_id'],
                    quantity=detail_data['quantity'],
                    unit_price=detail_data['unit_price'],
                    discount=detail_data.get('discount', 0)
                )
        
        instance.save()
        
        # Publicar evento si hubo cambio de estado
        if old_status != instance.status:
            try:
                publisher = EventPublisher()
                
                if instance.status == 'COMPLETED':
                    publisher.publish_order_completed(
                        order_id=instance.id,
                        customer_id=instance.customer_id,
                        total=float(instance.total)
                    )
                    logger.info(f"Evento 'order.completed' publicado para orden #{instance.id}")
                
                elif instance.status == 'CANCELLED':
                    publisher.publish_order_cancelled(
                        order_id=instance.id,
                        customer_id=instance.customer_id,
                        reason='Order updated to cancelled status'
                    )
                    logger.info(f"Evento 'order.cancelled' publicado para orden #{instance.id}")
                
                else:
                    publisher.publish_order_updated(
                        order_id=instance.id,
                        customer_id=instance.customer_id,
                        status=instance.status
                    )
                    logger.info(f"Evento 'order.updated' publicado para orden #{instance.id}")
                    
            except Exception as e:
                logger.error(
                    f"Error publicando evento de actualización de orden {instance.id}: {str(e)}"
                )
        
        return instance


class ShipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipment
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    payment_date = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = Payment
        fields = '__all__'
    
    def create(self, validated_data):
        # Remover payment_date del validated_data si viene vacío
        # El método save() del modelo se encargará de establecerlo
        if 'payment_date' in validated_data and validated_data['payment_date'] is None:
            validated_data.pop('payment_date')
        print(f"DEBUG - Creating payment with data: {validated_data}")
        return super().create(validated_data)
    
    def validate_order(self, value):
        """
        Valida que no se puedan crear pagos para órdenes completadas o canceladas.
        """
        if value.status == 'COMPLETED':
            raise serializers.ValidationError(
                'No se pueden registrar pagos para órdenes completadas. '
                'La orden ya está completamente pagada.'
            )
        
        if value.status == 'CANCELLED':
            raise serializers.ValidationError(
                'No se pueden registrar pagos para órdenes canceladas.'
            )
        
        return value
    
    def validate(self, data):
        """
        Validación adicional: verificar que el pago no exceda el monto pendiente.
        """
        order = data.get('order')
        amount = data.get('amount')
        
        if order and amount:
            from decimal import Decimal
            total_paid = Decimal(str(order.get_total_paid()))
            order_total = Decimal(str(order.total))
            payment_amount = Decimal(str(amount))
            remaining = order_total - total_paid
            
            # Permitir un margen de error de 0.01 por redondeos
            if payment_amount > remaining + Decimal('0.01'):
                raise serializers.ValidationError({
                    'amount': f'El monto excede lo pendiente de pago. '
                              f'Total de la orden: ${float(order_total)}, '
                              f'Ya pagado: ${float(total_paid)}, '
                              f'Pendiente: ${float(remaining)}'
                })
        
        return data


# Keep the VentasSerializer name for compatibility
class VentasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'
