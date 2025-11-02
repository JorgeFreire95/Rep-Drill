from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import Sum, Count, Q, F, DecimalField, ExpressionWrapper
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import logging
from .models import Order, OrderDetails, Shipment, Payment
from .serializers import (
    OrderSerializer,
    OrderDetailsSerializer,
    ShipmentSerializer,
    PaymentSerializer
)

logger = logging.getLogger(__name__)

class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar órdenes de venta
    """
    queryset = Order.objects.all().prefetch_related('details')
    serializer_class = OrderSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['status']
    ordering_fields = ['order_date']
    ordering = ['-order_date']
    
    @action(detail=False, methods=['get'])
    def customer_history(self, request):
        """
        GET /api/ventas/orders/customer_history/?customer_id=1&limit=10
        Obtiene el historial de órdenes para un cliente.
        """
        try:
            customer_id = request.query_params.get('customer_id')
            limit = int(request.query_params.get('limit', 10))
            
            if not customer_id:
                return Response(
                    {'error': 'customer_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Query SQL directa usando raw SQL que evita el ORM
            from django.db.models import Field
            sql_query = f"""
                SELECT id, customer_id, order_date, status, total, notes, created_at 
                FROM orders 
                WHERE customer_id = %s 
                ORDER BY order_date DESC 
                LIMIT %s
            """
            logger.info(f"Query: {sql_query}")
            logger.info(f"Params: customer_id={customer_id}, limit={limit}")
            
            orders = Order.objects.raw(sql_query, [customer_id, limit])
            
            orders_data = []
            for order in orders:
                # Obtener detalles
                details = OrderDetails.objects.filter(order=order)
                order_items = []
                for detail in details:
                    order_items.append({
                        'product_id': detail.product_id,
                        'quantity': detail.quantity,
                        'unit_price': str(detail.unit_price),
                        'discount': str(detail.discount),
                        'subtotal': str(detail.subtotal)
                    })
                
                orders_data.append({
                    'id': order.id,
                    'customer_id': order.customer_id,
                    'order_date': order.order_date.isoformat() if order.order_date else None,
                    'status': order.status,
                    'total': str(order.total),
                    'items_count': len(order_items),
                    'items': order_items,
                    'created_at': order.created_at.isoformat() if order.created_at else None,
                    'notes': order.notes
                })
            
            return Response({
                'count': len(orders_data),
                'customer_id': int(customer_id),
                'orders': orders_data
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response(
                {'error': f'Invalid parameter: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'Error fetching customer history: {str(e)}')
            return Response(
                {'error': 'Internal server error', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def create_order(self, request):
        """
        POST /api/orders/create/
        
        Crea una nueva orden de venta con validación completa.
        
        Request:
        {
            "customer_id": 1,
            "details": [
                {
                    "product_id": 101,
                    "quantity": 5,
                    "unit_price": 150000
                }
            ]
        }
        
        Response (201):
        {
            "order_id": 42,
            "status": "created",
            "customer_id": 1,
            "total": 900000,
            "items_count": 2,
            "created_at": "2025-10-24T15:30:00Z"
        }
        """
        try:
            # Validar datos de entrada
            customer_id = request.data.get('customer_id')
            details = request.data.get('details', [])
            
            if not customer_id:
                return Response(
                    {'error': 'customer_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not details:
                return Response(
                    {'error': 'At least one product detail is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Crear la orden
            order = Order.objects.create(
                status='PENDING',
                total=Decimal('0.00')
            )
            
            # Crear detalles de la orden
            total = Decimal('0.00')
            items_count = len(details)
            
            for detail in details:
                product_id = detail.get('product_id')
                quantity = detail.get('quantity')
                unit_price = detail.get('unit_price')
                
                # Validar datos del producto
                if not all([product_id, quantity, unit_price]):
                    order.delete()
                    return Response(
                        {'error': 'product_id, quantity, and unit_price are required'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Calcular subtotal
                subtotal = Decimal(str(quantity)) * Decimal(str(unit_price))
                
                # Crear detalle de orden
                OrderDetails.objects.create(
                    order=order,
                    product_id=product_id,
                    quantity=quantity,
                    unit_price=Decimal(str(unit_price)),
                    subtotal=subtotal
                )
                
                total += subtotal
            
            # Actualizar total en la orden
            order.total = total
            order.save()
            
            # Publicar evento
            try:
                from servicio_analytics.tasks import publish_event
                publish_event.delay(
                    event_type='order.created',
                    data={
                        'order_id': order.id,
                        'customer_id': customer_id,
                        'total': str(total),
                        'items_count': items_count
                    }
                )
            except Exception as e:
                logger.warning(f'Could not publish event: {str(e)}')
            
            logger.info(f'Order {order.id} created')
            
            return Response({
                'order_id': order.id,
                'status': 'created',
                'customer_id': customer_id,
                'total': float(total),
                'items_count': items_count,
                'created_at': order.order_date.isoformat() if order.order_date else timezone.now().isoformat()
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f'Error creating order: {str(e)}')
            return Response(
                {'error': 'Internal server error', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class OrderDetailsViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar detalles de órdenes
    """
    queryset = OrderDetails.objects.all().select_related('order')
    serializer_class = OrderDetailsSerializer
    permission_classes = [AllowAny]
    ordering = ['-detail_date']

class ShipmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar envíos
    """
    queryset = Shipment.objects.all().select_related('order')
    serializer_class = ShipmentSerializer
    permission_classes = [AllowAny]
    ordering = ['-shipment_date']

class PaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar pagos
    """
    queryset = Payment.objects.all().select_related('order')
    serializer_class = PaymentSerializer
    permission_classes = [AllowAny]
    ordering = ['-payment_date']


@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_stats(request):
    """
    Retorna estadísticas para el dashboard
    """
    # Usar timezone.localtime() para obtener la fecha en la zona horaria configurada
    # Esto asegura que coincida con las fechas guardadas por datetime.date.today()
    today = timezone.localtime(timezone.now()).date()
    first_day_of_month = today.replace(day=1)
    last_month_first_day = (first_day_of_month - timedelta(days=1)).replace(day=1)
    
    # Ventas del mes actual
    current_month_sales = Order.objects.filter(
        order_date__gte=first_day_of_month,
        status__in=['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
    ).aggregate(total=Sum('total'))['total'] or Decimal('0')
    
    # Ventas del mes anterior
    last_month_sales = Order.objects.filter(
        order_date__gte=last_month_first_day,
        order_date__lt=first_day_of_month,
        status__in=['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
    ).aggregate(total=Sum('total'))['total'] or Decimal('0')
    
    # Ventas de hoy
    today_sales = Order.objects.filter(
        order_date=today,
        status__in=['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
    ).aggregate(total=Sum('total'))['total'] or Decimal('0')
    
    # Órdenes pendientes
    pending_orders = Order.objects.filter(
        status__in=['PENDING', 'CONFIRMED']
    ).count()
    
    # Órdenes completadas
    completed_orders = Order.objects.filter(
        status='COMPLETED'
    ).count()
    
    # Total de pagos del mes
    current_month_payments = Payment.objects.filter(
        payment_date__gte=first_day_of_month
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    
    # Envíos pendientes
    pending_shipments = Shipment.objects.filter(
        delivery_status__in=['Pendiente', 'En Preparación', 'Enviado', 'En Tránsito']
    ).count()
    
    # Productos más vendidos del mes
    # Calcular subtotal dinámicamente: (quantity * unit_price) - (quantity * unit_price * discount / 100)
    top_products_data = OrderDetails.objects.filter(
        order__order_date__gte=first_day_of_month,
        order__status__in=['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
    ).values('product_id').annotate(
        total_quantity=Sum('quantity'),
        total_sales=Sum(
            ExpressionWrapper(
                F('quantity') * F('unit_price') - (F('quantity') * F('unit_price') * F('discount') / 100),
                output_field=DecimalField(max_digits=10, decimal_places=2)
            )
        )
    ).order_by('-total_quantity')[:5]
    
    # Obtener productos más vendidos (sin hacer llamadas HTTP internas que causan timeouts)
    top_products = []
    for item in top_products_data:
        product_info = {
            'product_id': item['product_id'],
            'product_name': f'Producto #{item["product_id"]}',  # Nombre por defecto, se puede mejorar con caché después
            'total_quantity': item['total_quantity'],
            'total_sales': item['total_sales']
        }
        top_products.append(product_info)
    
    # Ventas por día de los últimos 7 días
    seven_days_ago = today - timedelta(days=6)
    daily_sales = []
    for i in range(7):
        day = seven_days_ago + timedelta(days=i)
        day_total = Order.objects.filter(
            order_date=day,
            status__in=['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
        ).aggregate(total=Sum('total'))['total'] or Decimal('0')
        daily_sales.append({
            'date': day.strftime('%Y-%m-%d'),
            'total': float(day_total)
        })
    
    return Response({
        'ventas_hoy': str(today_sales),
        'ventas_mes': str(current_month_sales),
        'ventas_mes_anterior': str(last_month_sales),
        'ordenes_pendientes': pending_orders,
        'ordenes_completadas': completed_orders,
        'pagos_mes': str(current_month_payments),
        'envios_pendientes': pending_shipments,
        'productos_mas_vendidos': list(top_products),
        'ventas_diarias': daily_sales,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def check_product_availability(request):
    """
    Verifica la disponibilidad de productos en el inventario
    antes de crear una orden.
    
    Request body:
    {
        "products": [
            {"product_id": 1, "quantity": 5},
            {"product_id": 2, "quantity": 3}
        ]
    }
    """
    from .services import InventoryService
    
    products = request.data.get('products', [])
    
    if not products:
        return Response(
            {'error': 'Debe proporcionar una lista de productos'},
            status=400
        )
    
    results = []
    all_available = True
    
    for item in products:
        product_id = item.get('product_id')
        quantity = item.get('quantity')
        
        if not product_id or not quantity:
            continue
        
        result = InventoryService.check_product_availability(product_id, quantity)
        results.append(result)
        
        if not result.get('available', False):
            all_available = False
    
    return Response({
        'all_available': all_available,
        'products': results
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def process_order_payment_manually(request, order_id):
    """
    Procesa manualmente el pago completo de una orden y actualiza el inventario.
    Útil para casos donde se necesita forzar la actualización del inventario.
    """
    from .services import OrderService
    
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response(
            {'error': 'Orden no encontrada'},
            status=404
        )
    
    result = OrderService.process_payment_completion(order)
    
    if result['success']:
        return Response(result, status=200)
    else:
        return Response(result, status=400)


@api_view(['GET'])
@permission_classes([AllowAny])
def order_payment_status(request, order_id):
    """
    Obtiene el estado de pago de una orden y si el inventario fue actualizado.
    """
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response(
            {'error': 'Orden no encontrada'},
            status=404
        )
    
    total_paid = order.get_total_paid()
    is_fully_paid = order.is_fully_paid()
    remaining = order.total - total_paid
    
    return Response({
        'order_id': order.id,
        'total': str(order.total),
        'total_paid': str(total_paid),
        'remaining': str(max(0, remaining)),
        'is_fully_paid': is_fully_paid,
        'inventory_updated': order.inventory_updated,
        'status': order.status,
        'payment_percentage': float((total_paid / order.total * 100) if order.total > 0 else 0)
    })

