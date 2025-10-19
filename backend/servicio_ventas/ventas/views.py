from rest_framework import viewsets, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Sum, Count, Q, F, DecimalField, ExpressionWrapper
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import Order, OrderDetails, Shipment, Payment
from .serializers import (
    OrderSerializer,
    OrderDetailsSerializer,
    ShipmentSerializer,
    PaymentSerializer
)

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
    today = timezone.now().date()
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
    
    # Obtener información de productos desde el servicio de inventario
    import requests
    top_products = []
    for item in top_products_data:
        product_info = {'product_id': item['product_id']}
        try:
            # Intentar obtener el nombre del producto del servicio de inventario
            response = requests.get(f'http://localhost:8002/api/products/{item["product_id"]}/', timeout=2)
            if response.status_code == 200:
                product_data = response.json()
                product_info['product_name'] = product_data.get('name', f'Producto #{item["product_id"]}')
            else:
                product_info['product_name'] = f'Producto #{item["product_id"]}'
        except Exception as e:
            print(f'Error obteniendo producto {item["product_id"]}: {str(e)}')
            product_info['product_name'] = f'Producto #{item["product_id"]}'
        
        product_info['total_quantity'] = item['total_quantity']
        product_info['total_sales'] = item['total_sales']
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
