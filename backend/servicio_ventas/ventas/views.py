from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import Sum, Count, Q, F, DecimalField, ExpressionWrapper
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from decimal import Decimal
import logging
import requests
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
            
            # ✅ NUEVO: Validar que el cliente existe en servicio Personas
            try:
                customer_response = requests.get(
                    f"{settings.PERSONAS_SERVICE_URL}/api/personas/{customer_id}/",
                    timeout=5
                )
                
                if customer_response.status_code == 404:
                    return Response(
                        {'error': f'Cliente con ID {customer_id} no encontrado'},
                        status=status.HTTP_404_NOT_FOUND
                    )
                elif customer_response.status_code != 200:
                    logger.warning(
                        f"Error consultando servicio Personas: {customer_response.status_code}"
                    )
                    # Continuar sin validación si el servicio no responde
                    customer_data = None
                else:
                    customer_data = customer_response.json()
                    
            except requests.exceptions.RequestException as e:
                logger.error(f"Error de conexión con servicio Personas: {str(e)}")
                # Continuar sin validación si hay error de conexión
                customer_data = None
            
            # Crear la orden base (sin detalles aún)
            order = Order.objects.create(
                customer_id=customer_id,
                status='PENDING',
                total=Decimal('0.00')
            )
            
            # ✅ NUEVO: Si se obtuvo data del cliente, actualizar cache
            if customer_data:
                order.customer_name = f"{customer_data.get('nombre', '')} {customer_data.get('apellido', '')}".strip()
                order.customer_email = customer_data.get('email', '')
                order.customer_phone = customer_data.get('telefono', '')
                order.save(update_fields=['customer_name', 'customer_email', 'customer_phone'])
            
            # Crear reservas de stock primero (microservicio inventario)
            from .services import InventoryService
            reservation_result = InventoryService.create_reservations_for_order(order.id, details)
            if not reservation_result.get('success'):
                order.delete()
                return Response({
                    'error': 'No se pudo reservar stock',
                    'detail': reservation_result.get('reservation_error'),
                    'failed_detail': reservation_result.get('failed_detail')
                }, status=status.HTTP_409_CONFLICT)

            # Crear detalles de la orden (después de reservas exitosas)
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
            
            # Anotar ids de reservas en notes para trazabilidad inicial
            try:
                reservation_ids = [r['reservation']['id'] for r in reservation_result.get('reservations', [])]
                order.notes = f"reservations={reservation_ids}"
                order.save(update_fields=['notes'])
            except Exception:
                pass

            logger.info(f'Order {order.id} created with {len(reservation_result.get("reservations", []))} reservations')
            
            return Response({
                'order_id': order.id,
                'status': 'created',
                'customer_id': customer_id,
                'total': float(total),
                'items_count': items_count,
                'created_at': order.order_date.isoformat() if order.order_date else timezone.now().isoformat(),
                'reservations': [r['reservation'] for r in reservation_result.get('reservations', [])]
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

    @action(detail=False, methods=['post'])
    def sync_customer_cache(self, request):
        """
        POST /api/orders/sync_customer_cache/
        
        Sincroniza el cache de clientes en todas las órdenes activas.
        
        Response:
        {
            "message": "Cache sincronizado",
            "success": 15,
            "errors": 2,
            "total": 17
        }
        """
        try:
            result = Order.sync_all_customer_caches()
            
            return Response({
                'message': 'Sincronización completada',
                'success': result['success'],
                'errors': result['errors'],
                'total': result['total']
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f'Error sincronizando cache: {str(e)}')
            return Response(
                {'error': 'Internal server error', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def sync_order_customer_cache(self, request, pk=None):
        """
        POST /api/orders/{id}/sync_order_customer_cache/
        
        Sincroniza el cache del cliente para una orden específica.
        
        Response:
        {
            "message": "Cache sincronizado",
            "order_id": 42,
            "customer_name": "Juan Pérez",
            "customer_email": "juan@example.com"
        }
        """
        try:
            order = self.get_object()
            
            if order.sync_customer_cache():
                return Response({
                    'message': 'Cache sincronizado exitosamente',
                    'order_id': order.id,
                    'customer_name': order.customer_name,
                    'customer_email': order.customer_email,
                    'customer_phone': order.customer_phone
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'No se pudo sincronizar el cache',
                    'detail': 'Error al obtener datos del servicio Personas'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                
        except Exception as e:
            logger.error(f'Error sincronizando cache de orden {pk}: {str(e)}')
            return Response(
                {'error': 'Internal server error', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def confirm(self, request, pk=None):
        """Confirma la orden: commit de reservas y cambio de estado a CONFIRMED."""
        from .services import InventoryService
        order = self.get_object()
        if order.status != 'PENDING':
            return Response({'error': 'Solo órdenes PENDING pueden confirmarse', 'status': order.status}, status=400)
        # Obtener reservas
        res_list = InventoryService.list_reservations_for_order(order.id)
        if not res_list.get('success'):
            return Response({'error': 'No se pudo listar reservas', 'detail': res_list}, status=502)
        reservations = res_list['data'].get('results', [])
        commit_results = []
        for r in reservations:
            if r['status'] == 'pending':
                cr = InventoryService.commit_reservation(r['id'])
                commit_results.append({'id': r['id'], 'commit': cr})
                if not cr.get('success'):
                    # compensación: uncommit lo ya confirmado (si alguno) y abortar
                    for done in commit_results:
                        if done['commit'].get('success'):
                            InventoryService.uncommit_reservation(done['id'])
                    return Response({'error': 'Fallo commit de reserva', 'failed': r['id'], 'details': cr}, status=409)
        order.status = 'CONFIRMED'
        order.confirmed_at = timezone.now()
        order.save(update_fields=['status', 'confirmed_at', 'updated_at'])
        try:
            from servicio_analytics.tasks import publish_event
            publish_event.delay(event_type='order.confirmed', data={'order_id': order.id, 'total': str(order.total)})
        except Exception:
            pass
        # Invalidate forecast cache for affected products
        try:
            product_ids = list(order.details.values_list('product_id', flat=True))
            analytics_url = getattr(settings, 'ANALYTICS_SERVICE_URL', 'http://analytics:8000')
            requests.post(f"{analytics_url}/api/prophet/invalidate/", json={'product_ids': product_ids})
        except Exception as e:
            logger.warning(f"Could not invalidate forecast cache: {e}")
        return Response({'order_id': order.id, 'status': order.status, 'commit_results': commit_results})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        """Cancela la orden: libera o compensa reservas y marca CANCELLED."""
        from .services import InventoryService
        order = self.get_object()
        if order.status == 'CANCELLED':
            return Response({'error': 'Orden ya cancelada'}, status=400)
        res_list = InventoryService.list_reservations_for_order(order.id)
        if not res_list.get('success'):
            return Response({'error': 'No se pudo listar reservas', 'detail': res_list}, status=502)
        reservations = res_list['data'].get('results', [])
        actions = []
        for r in reservations:
            if order.status == 'PENDING' and r['status'] == 'pending':
                rel = InventoryService.release_reservation(r['id'], reason='order cancelled')
                actions.append({'id': r['id'], 'released': rel})
            elif order.status == 'CONFIRMED' and r['status'] == 'confirmed':
                # compensación completa
                un = InventoryService.uncommit_reservation(r['id'])
                actions.append({'id': r['id'], 'uncommitted': un.get('success')})
            elif r['status'] == 'pending':
                rel = InventoryService.release_reservation(r['id'], reason='order cancelled (other status)')
                actions.append({'id': r['id'], 'released': rel})
        order.status = 'CANCELLED'
        order.save(update_fields=['status', 'updated_at'])
        try:
            from servicio_analytics.tasks import publish_event
            publish_event.delay(event_type='order.cancelled', data={'order_id': order.id})
        except Exception:
            pass
        return Response({'order_id': order.id, 'status': order.status, 'reservation_actions': actions})


