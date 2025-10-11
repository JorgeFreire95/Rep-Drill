from rest_framework import serializers
from .models import Order, OrderDetails, Shipment, Payment
from decimal import Decimal


class OrderDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderDetails
        fields = '__all__'
        read_only_fields = ('order',)


class OrderDetailCreateSerializer(serializers.Serializer):
    """Serializer para crear detalles de orden anidados"""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)


class OrderSerializer(serializers.ModelSerializer):
    details = OrderDetailCreateSerializer(many=True, write_only=True, required=False)
    details_read = OrderDetailsSerializer(many=True, read_only=True, source='details')
    customer_name = serializers.SerializerMethodField()
    order_date = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('total',)
    
    def get_customer_name(self, obj):
        """Obtener el nombre del cliente desde el servicio de personas"""
        import requests
        try:
            response = requests.get(f'http://localhost:8003/api/personas/{obj.customer_id}/', timeout=2)
            if response.status_code == 200:
                customer_data = response.json()
                return customer_data.get('nombre', f'Cliente #{obj.customer_id}')
        except:
            pass
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
        
        return order
    
    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', None)
        
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
