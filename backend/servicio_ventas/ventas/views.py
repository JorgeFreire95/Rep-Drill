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

    def list(self, request, *args, **kwargs):
        """
        Listar órdenes con soporte opcional de filtros livianos para evitar respuestas muy grandes.
        Query params opcionales:
        - status: filtra por estado exacto (p.ej. COMPLETED)
        - date_from, date_to: rango de fechas (YYYY-MM-DD)
        - limit: límite máximo de resultados (entero)
        - ordering: campo(s) de ordenamiento (por defecto -order_date)
        """
        try:
            qs = self.get_queryset()

            status_param = request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param)

            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')
            from datetime import datetime as _dt
            if date_from:
                try:
                    df = _dt.strptime(date_from[:10], '%Y-%m-%d').date()
                    qs = qs.filter(order_date__gte=df)
                except Exception:
                    pass
            if date_to:
                try:
                    dt = _dt.strptime(date_to[:10], '%Y-%m-%d').date()
                    qs = qs.filter(order_date__lte=dt)
                except Exception:
                    pass

            ordering = request.query_params.get('ordering') or '-order_date'
            if ordering:
                qs = qs.order_by(*[o.strip() for o in ordering.split(',') if o.strip()])

            limit = request.query_params.get('limit')
            if limit:
                try:
                    lim = int(limit)
                    if lim > 0:
                        qs = qs[:lim]
                except ValueError:
                    pass

            serializer = self.get_serializer(qs, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error listing orders: {str(e)}", exc_info=True)
            return Response({'error': 'Internal server error'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
                customer_id=customer_id,
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
    
    def create(self, request, *args, **kwargs):
        """Override create para agregar logging"""
        logger.info(f"DEBUG - PaymentViewSet.create() called with data: {request.data}")
        try:
            response = super().create(request, *args, **kwargs)
            logger.info(f"DEBUG - Payment created successfully")
            return response
        except Exception as e:
            logger.error(f"ERROR in PaymentViewSet.create(): {str(e)}", exc_info=True)
            raise


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


@api_view(['POST'])
@permission_classes([AllowAny])
def validate_stock(request):
    """
    POST /api/ventas/validate-stock/
    
    Validación en tiempo real de disponibilidad de stock.
    Recibe una lista de productos con cantidades y retorna el estado de disponibilidad.
    
    Request:
    {
        "items": [
            {"product_id": 1, "quantity": 5},
            {"product_id": 2, "quantity": 10}
        ]
    }
    
    Response:
    {
        "all_available": true/false,
        "validation_timestamp": "2025-10-24T15:30:00Z",
        "items": [
            {
                "product_id": 1,
                "name": "Laptop Dell XPS 13",
                "requested_quantity": 5,
                "available_quantity": 5,
                "status": "in_stock",
                "price": 1299000,
                "cost_price": 900000,
                "profit_margin": 44.3,
                "is_low_stock": false,
                "needs_reorder": false,
                "reorder_quantity": 3,
                "min_stock": 2,
                "warnings": []
            }
        ],
        "warnings": ["Laptop tiene bajo stock después de este pedido"],
        "summary": {
            "total_items": 2,
            "available": 2,
            "partial": 0,
            "unavailable": 0
        }
    }
    """
    import requests
    
    try:
        items = request.data.get('items', [])
        
        if not items:
            return Response(
                {'error': 'items list is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Llamar al API de inventario para obtener todos los productos
        try:
            inventory_response = requests.get(
                'http://inventario:8000/api/products/',
                timeout=5
            )
            products_data = inventory_response.json() if inventory_response.status_code == 200 else []
        except Exception as e:
            logger.error(f'Error fetching products from inventory service: {str(e)}')
            products_data = []
        
        # Crear un mapeo de products por ID
        products_map = {p['id']: p for p in products_data}
        
        validation_results = {
            'all_available': True,
            'validation_timestamp': timezone.now().isoformat(),
            'items': [],
            'warnings': [],
            'summary': {
                'total_items': len(items),
                'available': 0,
                'partial': 0,
                'unavailable': 0
            }
        }
        
        for item in items:
            product_id = item.get('product_id')
            requested_quantity = item.get('quantity', 0)
            
            if not product_id or not requested_quantity:
                continue
            
            product = products_map.get(product_id)
            
            if not product:
                validation_results['summary']['unavailable'] += 1
                validation_results['all_available'] = False
                validation_results['items'].append({
                    'product_id': product_id,
                    'name': 'PRODUCTO NO ENCONTRADO',
                    'requested_quantity': requested_quantity,
                    'available_quantity': 0,
                    'status': 'not_found',
                    'warnings': ['Producto no existe en el sistema']
                })
                continue
            
            # Determinar estado
            available_qty = product.get('quantity', 0)
            min_stock = product.get('min_stock', 0)
            reorder_qty = product.get('reorder_quantity', 0)
            
            if available_qty >= requested_quantity:
                item_status = 'in_stock'
                validation_results['summary']['available'] += 1
            elif available_qty > 0:
                item_status = 'partial'
                validation_results['summary']['partial'] += 1
                validation_results['all_available'] = False
            else:
                item_status = 'out_of_stock'
                validation_results['summary']['unavailable'] += 1
                validation_results['all_available'] = False
            
            # Calcular warnings
            warnings = []
            
            # Verificar si quedará bajo stock después de la compra
            if available_qty >= requested_quantity and (available_qty - requested_quantity) <= min_stock:
                remaining = available_qty - requested_quantity
                warnings.append(
                    f"{product.get('name')} quedará en {remaining} unidades (mín: {min_stock})"
                )
            
            # Verificar bajo stock
            if available_qty <= min_stock:
                warnings.append(
                    f"{product.get('name')} está en bajo stock ({available_qty}/{min_stock})"
                )
            
            # Verificar reorden
            if available_qty <= reorder_qty:
                warnings.append(
                    f"{product.get('name')} necesita reorden (stock: {available_qty}, reorden: {reorder_qty})"
                )
            
            if warnings:
                validation_results['warnings'].extend(warnings)
            
            # Construir respuesta del producto
            item_data = {
                'product_id': product.get('id'),
                'name': product.get('name'),
                'sku': product.get('sku'),
                'requested_quantity': requested_quantity,
                'available_quantity': available_qty,
                'status': item_status,
                'price': int(product.get('price', 0)) if product.get('price') else 0,
                'cost_price': int(product.get('cost_price', 0)) if product.get('cost_price') else 0,
                'profit_margin': float(product.get('profit_margin', 0)) if product.get('profit_margin') else 0,
                'is_low_stock': available_qty <= min_stock,
                'needs_reorder': available_qty <= reorder_qty,
                'reorder_quantity': reorder_qty,
                'min_stock': min_stock,
                'warnings': warnings
            }
            
            validation_results['items'].append(item_data)
        
        return Response(validation_results, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f'Error validating stock: {str(e)}')
        return Response(
            {'error': 'Internal server error', 'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

