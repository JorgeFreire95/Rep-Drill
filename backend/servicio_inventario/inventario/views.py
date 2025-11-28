from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.http import HttpResponse
from django.db.models import Q, Sum
import csv
import json
from django.db import models as db_models
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum
from .models import Warehouse, Category, Product, ProductPriceHistory, Inventory, InventoryEvent, ReorderRequest, ReorderStatusHistory, Supplier, ProductCostHistory, AuditLog, StockReservation
from .serializers import (
    WarehouseSerializer,
    CategorySerializer,
    ProductSerializer,
    ProductPriceHistorySerializer,
    ProductCostHistorySerializer,
    InventorySerializer,
    InventoryEventSerializer,
    ReorderRequestSerializer,
    ReorderStatusHistorySerializer,
    SupplierSerializer,
    AuditLogSerializer,
    StockReservationSerializer,
)


class WarehouseViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar bodegas/almacenes
    """
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'location']
    ordering_fields = ['name']
    ordering = ['name']


class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar categorías de productos
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['name']


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar productos
    """
    queryset = Product.objects.all().select_related('category')
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['name']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        ids = self.request.query_params.get('ids')
        if ids:
            try:
                id_list = [int(x) for x in ids.split(',') if x.strip().isdigit()]
                if id_list:
                    queryset = queryset.filter(id__in=id_list)
            except Exception:
                pass
        return queryset
    
    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        """
        Retorna productos con stock bajo con múltiples niveles de alerta:
        - CRITICAL: quantity = 0 (sin stock)
        - HIGH: quantity <= min_stock (por debajo del mínimo)
        - MEDIUM: quantity <= min_stock * 1.5 (alerta temprana)
        """
        # Obtener threshold de alerta (por defecto 1.5x min_stock)
        threshold_multiplier = float(request.query_params.get('threshold', '1.5'))
        
        # Filtrar productos con stock bajo o crítico
        # Incluir productos hasta 1.5x del mínimo para alertas tempranas
        low_stock_products = Product.objects.filter(
            quantity__lte=db_models.F('min_stock') * threshold_multiplier,
            status='ACTIVE'  # Solo productos activos
        ).select_related('category').order_by('quantity', 'name')
        
        # Serializar y agregar información adicional
        serializer = self.get_serializer(low_stock_products, many=True)
        data = serializer.data
        
        # Agregar información de alerta detallada
        for item in data:
            product = low_stock_products.get(id=item['id'])
            
            # Calcular nivel de alerta
            if product.quantity == 0:
                alert_level = 'critical'
                alert_message = '🔴 SIN STOCK - Reorden urgente'
            elif product.quantity <= product.min_stock:
                alert_level = 'high'
                alert_message = f'⚠️ Por debajo del mínimo ({product.quantity}/{product.min_stock})'
            elif product.quantity <= product.min_stock * 1.5:
                alert_level = 'medium'
                alert_message = f'⚡ Stock bajo - Próximo al mínimo ({product.quantity}/{product.min_stock})'
            else:
                alert_level = 'low'
                alert_message = f'ℹ️ Stock normal ({product.quantity}/{product.min_stock})'
            
            item['alert_level'] = alert_level
            item['alert_message'] = alert_message
            item['needs_reorder'] = product.needs_reorder
            item['stock_percentage'] = (
                (product.quantity / product.min_stock * 100) if product.min_stock > 0 else 0
            )
            item['missing_to_min'] = max(0, product.min_stock - product.quantity)
            item['recommended_reorder'] = product.reorder_quantity
        
        # Agrupar por nivel de alerta
        alerts_by_level = {
            'critical': [item for item in data if item['alert_level'] == 'critical'],
            'high': [item for item in data if item['alert_level'] == 'high'],
            'medium': [item for item in data if item['alert_level'] == 'medium'],
        }
        
        return Response({
            'count': len(data),
            'critical_count': len(alerts_by_level['critical']),
            'high_count': len(alerts_by_level['high']),
            'medium_count': len(alerts_by_level['medium']),
            'threshold_multiplier': threshold_multiplier,
            'results': data,
            'alerts_by_level': alerts_by_level
        })
    
    @action(detail=False, methods=['get'], url_path='low-stock/count')
    def low_stock_count(self, request):
        """
        Retorna el número de productos con stock bajo agrupado por nivel
        Útil para mostrar badge en UI con conteos diferenciados
        """
        threshold_multiplier = float(request.query_params.get('threshold', '1.5'))
        
        # Contar productos activos con stock bajo
        low_stock_products = Product.objects.filter(
            quantity__lte=db_models.F('min_stock') * threshold_multiplier,
            status='ACTIVE'
        )
        
        # Contar por nivel de alerta
        critical_count = low_stock_products.filter(quantity=0).count()
        high_count = low_stock_products.filter(
            quantity__gt=0,
            quantity__lte=db_models.F('min_stock')
        ).count()
        medium_count = low_stock_products.filter(
            quantity__gt=db_models.F('min_stock'),
            quantity__lte=db_models.F('min_stock') * threshold_multiplier
        ).count()
        
        total_count = critical_count + high_count + medium_count
        
        return Response({
            'count': total_count,
            'critical': critical_count,
            'high': high_count,
            'medium': medium_count,
            'threshold_multiplier': threshold_multiplier,
            'has_critical': critical_count > 0,
            'has_alerts': total_count > 0
        })


class ProductPriceHistoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar historial de precios
    """
    queryset = ProductPriceHistory.objects.all().select_related('product')
    serializer_class = ProductPriceHistorySerializer
    permission_classes = [AllowAny]
    ordering = ['-start_date']


class ProductCostHistoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar historial de costo
    """
    queryset = ProductCostHistory.objects.all().select_related('product')
    serializer_class = ProductCostHistorySerializer
    permission_classes = [AllowAny]
    ordering = ['-start_date']


class InventoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar inventario (stock)
    """
    queryset = Inventory.objects.all().select_related('product', 'warehouse')
    serializer_class = InventorySerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'warehouse__name']
    ordering = ['-entry_date']


class InventoryEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar eventos de inventario
    """
    queryset = InventoryEvent.objects.all().select_related('inventory')
    serializer_class = InventoryEventSerializer
    permission_classes = [AllowAny]
    ordering = ['-event_date']


class ReorderRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar solicitudes de reorden (reabastecimiento)
    """
    queryset = ReorderRequest.objects.all().select_related('product', 'supplier')
    serializer_class = ReorderRequestSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'product__sku', 'supplier__name', 'status']
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        # Si no se envía cantidad, usar reorder_quantity del producto
        product = Product.objects.get(id=self.request.data.get('product'))
        quantity = self.request.data.get('quantity')
        if quantity in (None, '', 0, '0'):
            quantity = product.reorder_quantity or max(1, product.min_stock)
        serializer.save(quantity=quantity)

    @action(detail=True, methods=['post'])
    def mark_ordered(self, request, pk=None):
        reorder = self.get_object()
        old_status = reorder.status
        reorder.status = 'ordered'
        reorder.save(update_fields=['status', 'updated_at'])
        
        # Crear registro de historial
        _user = getattr(request, 'user', None)
        _is_auth = getattr(_user, 'is_authenticated', False)
        _username = getattr(_user, 'username', None) if _is_auth else None
        ReorderStatusHistory.objects.create(
            reorder=reorder,
            old_status=old_status,
            new_status='ordered',
            changed_by=_username or 'system',
            notes='Marcado como ordenado'
        )
        
        return Response(self.get_serializer(reorder).data)

    @action(detail=True, methods=['post'])
    def mark_received(self, request, pk=None):
        reorder = self.get_object()
        old_status = reorder.status
        reorder.status = 'received'
        reorder.save(update_fields=['status', 'updated_at'])
        
        # Actualizar inventario del producto automáticamente
        product = reorder.product
        product.quantity += reorder.quantity
        product.save(update_fields=['quantity'])
        
        # Crear registro de historial
        _user = getattr(request, 'user', None)
        _is_auth = getattr(_user, 'is_authenticated', False)
        _username = getattr(_user, 'username', None) if _is_auth else None
        ReorderStatusHistory.objects.create(
            reorder=reorder,
            old_status=old_status,
            new_status='received',
            changed_by=_username or 'system',
            notes=f'Marcado como recibido. Inventario incrementado en {reorder.quantity} unidades.'
        )
        
        return Response(self.get_serializer(reorder).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        reorder = self.get_object()
        old_status = reorder.status
        reorder.status = 'cancelled'
        reorder.save(update_fields=['status', 'updated_at'])
        
        # Crear registro de historial
        _user = getattr(request, 'user', None)
        _is_auth = getattr(_user, 'is_authenticated', False)
        _username = getattr(_user, 'username', None) if _is_auth else None
        ReorderStatusHistory.objects.create(
            reorder=reorder,
            old_status=old_status,
            new_status='cancelled',
            changed_by=_username or 'system',
            notes='Reorden cancelado'
        )
        
        return Response(self.get_serializer(reorder).data)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Obtener historial de cambios de estado para esta reorden"""
        reorder = self.get_object()
        history = reorder.status_history.all()
        serializer = ReorderStatusHistorySerializer(history, many=True)
        return Response(serializer.data)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    CRUD de Proveedores + endpoints de asociación y compras.
    """
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'tax_id', 'email', 'phone']
    ordering_fields = ['name', 'created_at', 'updated_at']

    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):
        """Lista productos asociados a este proveedor."""
        products = Product.objects.filter(supplier_id=pk).order_by('name')
        serializer = ProductSerializer(products, many=True)
        return Response({
            'count': products.count(),
            'results': serializer.data
        })

    @action(detail=True, methods=['post'])
    def attach_product(self, request, pk=None):
        """Asocia un producto a este proveedor (Product.supplier=pk)."""
        product_id = request.data.get('product_id')
        try:
            product = Product.objects.get(id=product_id)
            product.supplier_id = pk
            product.save(update_fields=['supplier'])
            return Response({'status': 'attached', 'product_id': product.id})
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)

    @action(detail=True, methods=['post'])
    def detach_product(self, request, pk=None):
        """Desasocia un producto de este proveedor (Product.supplier=None)."""
        product_id = request.data.get('product_id')
        try:
            product = Product.objects.get(id=product_id, supplier_id=pk)
            product.supplier = None
            product.save(update_fields=['supplier'])
            return Response({'status': 'detached', 'product_id': product.id})
        except Product.DoesNotExist:
            return Response({'error': 'Product not found or not attached to this supplier'}, status=404)

    @action(detail=True, methods=['get'])
    def purchases(self, request, pk=None):
        """
        Historial de compras (reorders) por proveedor con métricas.
        Query params opcionales: days (int), status (requested|ordered|received|cancelled)
        """
        days = int(request.query_params.get('days', 180))
        status_filter = request.query_params.get('status')

        since = timezone.now() - timedelta(days=days)
        reorders = ReorderRequest.objects.filter(supplier_id=pk, created_at__gte=since)
        if status_filter:
            reorders = reorders.filter(status=status_filter)
        reorders = reorders.select_related('product', 'supplier').order_by('-created_at')

        # Métricas básicas
        total_orders = reorders.count()
        total_quantity = reorders.aggregate(total=Sum('quantity'))['total'] or 0
        # Valor estimado usando el cost_price actual del producto
        total_value = sum([(r.product.cost_price or 0) * r.quantity for r in reorders])

        # Calcular lead time promedio usando historial de estados
        lead_times = []
        history = ReorderStatusHistory.objects.filter(reorder__in=reorders).order_by('changed_at')
        ordered_map = {}
        for h in history:
            if h.new_status == 'ordered' and h.reorder_id not in ordered_map:
                ordered_map[h.reorder_id] = h.changed_at
        for h in history:
            if h.new_status == 'received' and h.reorder_id in ordered_map:
                delta = (h.changed_at - ordered_map[h.reorder_id]).total_seconds() / 86400.0
                if delta >= 0:
                    lead_times.append(delta)

        avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else None

        serializer = ReorderRequestSerializer(reorders, many=True)
        return Response({
            'count': total_orders,
            'total_quantity': total_quantity,
            'estimated_total_value': float(total_value),
            'average_lead_time_days': avg_lead_time,
            'results': serializer.data,
        })

    @action(detail=True, methods=['get'])
    def performance(self, request, pk=None):
        """
        Métricas de desempeño del proveedor calculadas desde historial:
        - on_time_rate: proporción de órdenes recibidas dentro de `expected_days` desde que fueron 'ordered'.
        - average_lead_time_days: promedio de días entre 'ordered' y 'received'.

        Query params:
        - days: ventana en días a evaluar (default 365)
        - expected_days: SLA esperado para considerar "a tiempo" (default 7)
        - update: si 'true', guarda on_time_rate en el modelo Supplier.
        """
        days = int(request.query_params.get('days', 365))
        expected_days = int(request.query_params.get('expected_days', 7))
        should_update = str(request.query_params.get('update', 'false')).lower() == 'true'

        since = timezone.now() - timedelta(days=days)
        reorders = ReorderRequest.objects.filter(supplier_id=pk, created_at__gte=since)
        reorders = reorders.select_related('product', 'supplier')

        # Considerar solo órdenes que hayan sido recibidas (para medir lead time completo)
        received_ids = list(reorders.filter(status='received').values_list('id', flat=True))
        if not received_ids:
            metrics = {
                'evaluated_orders': 0,
                'on_time_orders': 0,
                'on_time_rate': None,
                'average_lead_time_days': None,
                'expected_days': expected_days,
                'window_days': days,
            }
            return Response(metrics)

        history = ReorderStatusHistory.objects.filter(reorder_id__in=received_ids).order_by('changed_at')
        ordered_map = {}
        lead_times = []
        for h in history:
            if h.new_status == 'ordered' and h.reorder_id not in ordered_map:
                ordered_map[h.reorder_id] = h.changed_at
        on_time = 0
        for h in history:
            if h.new_status == 'received' and h.reorder_id in ordered_map:
                delta_days = (h.changed_at - ordered_map[h.reorder_id]).total_seconds() / 86400.0
                if delta_days >= 0:
                    lead_times.append(delta_days)
                    if delta_days <= expected_days:
                        on_time += 1

        avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else None
        on_time_rate = round(on_time / len(lead_times), 3) if lead_times else None

        if should_update:
            try:
                supplier = Supplier.objects.get(id=pk)
                supplier.on_time_rate = on_time_rate
                supplier.save(update_fields=['on_time_rate', 'updated_at'])
            except Supplier.DoesNotExist:
                pass

        metrics = {
            'evaluated_orders': len(lead_times),
            'on_time_orders': on_time,
            'on_time_rate': on_time_rate,
            'average_lead_time_days': avg_lead_time,
            'expected_days': expected_days,
            'window_days': days,
        }
        return Response(metrics)


class StockReservationViewSet(viewsets.ModelViewSet):
    """CRUD básico para reservas de stock.
    POST crea una reserva si hay disponibilidad (stock real menos reservas activas).
    """
    queryset = StockReservation.objects.select_related('product').all()
    serializer_class = StockReservationSerializer
    permission_classes = [AllowAny]
    ordering = ['-reserved_at']
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'order_reference', 'status']
    ordering_fields = ['reserved_at', 'expires_at', 'status']

    def create(self, request, *args, **kwargs):
        try:
            product_id = request.data.get('product') or request.data.get('product_id')
            quantity = int(request.data.get('quantity', 0))
            ttl_minutes = int(request.data.get('ttl_minutes', 15))
            order_reference = request.data.get('order_reference')
            notes = request.data.get('notes')
            if not product_id or quantity <= 0:
                return Response({'error': 'product and positive quantity required'}, status=400)
            product = Product.objects.filter(id=product_id, status='ACTIVE').first()
            if not product:
                return Response({'error': 'Product not found or inactive'}, status=404)
            # Calcular reservas activas vigentes
            now = timezone.now()
            active_reserved = StockReservation.objects.filter(
                product_id=product.id,
                status__in=['pending', 'confirmed'],
            ).exclude(status='pending', expires_at__lt=now).aggregate(total=Sum('quantity'))['total'] or 0
            available = product.quantity - active_reserved
            if quantity > available:
                return Response({'error': 'Insufficient available stock', 'available': available, 'requested': quantity}, status=409)
            reservation = StockReservation.create_with_ttl(product, quantity, ttl_minutes=ttl_minutes, order_reference=order_reference, notes=notes)
            serializer = self.get_serializer(reservation)
            return Response(serializer.data, status=201)
        except ValueError:
            return Response({'error': 'quantity and ttl_minutes must be integers'}, status=400)
        except Exception as e:
            return Response({'error': 'Internal server error', 'detail': str(e)}, status=500)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        reservation = self.get_object()
        reason = request.data.get('reason', '')
        if reservation.release(reason):
            return Response({'status': 'released', 'id': reservation.id})
        return Response({'error': 'Cannot release reservation'}, status=400)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        reason = request.data.get('reason', '')
        if reservation.cancel(reason):
            return Response({'status': 'cancelled', 'id': reservation.id})
        return Response({'error': 'Cannot cancel reservation'}, status=400)

    @action(detail=False, methods=['get'])
    def active_summary(self, request):
        now = timezone.now()
        qs = StockReservation.objects.filter(status__in=['pending', 'confirmed']).exclude(status='pending', expires_at__lt=now)
        agg = qs.values('product_id').annotate(total_reserved=Sum('quantity')).order_by('-total_reserved')[:50]
        return Response({'count': qs.count(), 'results': list(agg)})

    @action(detail=True, methods=['post'])
    def commit(self, request, pk=None):
        """Confirma la reserva y descuenta el stock del producto si aún no confirmado."""
        from django.db import transaction
        reservation = self.get_object()
        if reservation.status == 'confirmed':
            return Response({'status': 'already-confirmed', 'id': reservation.id})
        if reservation.status != 'pending':
            return Response({'error': 'Only pending reservations can be confirmed'}, status=400)
        with transaction.atomic():
            product = reservation.product
            product.refresh_from_db()
            if product.quantity < reservation.quantity:
                return Response({'error': 'Insufficient product quantity to confirm'}, status=409)
            product.quantity = product.quantity - reservation.quantity
            product.save(update_fields=['quantity'])
            reservation.mark_confirmed()
        return Response({'status': 'confirmed', 'id': reservation.id, 'product_quantity': product.quantity})

    @action(detail=True, methods=['post'])
    def uncommit(self, request, pk=None):
        """Revierte una reserva confirmada (compensación saga)."""
        from django.db import transaction
        reservation = self.get_object()
        if reservation.status != 'confirmed':
            return Response({'error': 'Only confirmed reservations can be uncommitted'}, status=400)
        with transaction.atomic():
            product = reservation.product
            product.refresh_from_db()
            product.quantity = product.quantity + reservation.quantity
            product.save(update_fields=['quantity'])
            reservation.release(reason='uncommit compensation')
        return Response({'status': 'uncommitted', 'id': reservation.id, 'product_quantity': product.quantity})

    @action(detail=False, methods=['get'])
    def by_order(self, request):
        order_ref = request.query_params.get('order_reference')
        if not order_ref:
            return Response({'error': 'order_reference query param required'}, status=400)
        qs = StockReservation.objects.filter(order_reference=order_ref).order_by('-reserved_at')
        serializer = self.get_serializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})


class ReportsViewSet(viewsets.ViewSet):
    """
    Reportes del servicio de inventario.
    - Kardex por producto y bodega con balance secuencial.
    """
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def kardex(self, request):
        """
        GET /api/reports/kardex/?product_id=..&warehouse_id=..&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD

        Retorna movimientos y balance secuencial (cantidad) para un producto/bodega.
        """
        from datetime import datetime as dt

        try:
            product_id = int(request.query_params.get('product_id'))
        except (TypeError, ValueError):
            return Response({'error': 'product_id es requerido y debe ser entero'}, status=400)

        warehouse_id = request.query_params.get('warehouse_id')
        warehouse_id = int(warehouse_id) if warehouse_id else None

        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # Rango por defecto: últimos 30 días
        if end_date_str:
            end_date = dt.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            end_date = timezone.localdate()
        if start_date_str:
            start_date = dt.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = end_date - timedelta(days=30)

        # Construir queryset base de eventos
        events_qs = InventoryEvent.objects.filter(
            inventory__product_id=product_id,
        ).select_related('inventory', 'inventory__warehouse')
        if warehouse_id:
            events_qs = events_qs.filter(inventory__warehouse_id=warehouse_id)

        # Balance inicial hasta el día anterior al inicio
        prior_events = events_qs.filter(event_date__lt=start_date).order_by('event_date', 'id')
        balance = 0
        for ev in prior_events:
            qty = ev.quantity or 0
            choice = (ev.choice or '').lower()
            if choice in ('entry', 'entrada', 'in', 'ingreso', 'adjustment', 'ajuste'):
                balance += qty
            elif choice in ('exit', 'salida', 'out'):
                balance -= qty
            # transfer u otros: ignorar (sin info de dirección)

        # Movimientos dentro del rango
        range_events = events_qs.filter(event_date__gte=start_date, event_date__lte=end_date).order_by('event_date', 'id')

        rows = []
        for ev in range_events:
            qty = ev.quantity or 0
            choice = (ev.choice or '').lower()
            delta = 0
            if choice in ('entry', 'entrada', 'in', 'ingreso', 'adjustment', 'ajuste'):
                delta = qty
            elif choice in ('exit', 'salida', 'out'):
                delta = -qty
            # Calcular nuevo balance
            balance = balance + delta
            rows.append({
                'date': ev.event_date.isoformat(),
                'warehouse_id': ev.inventory.warehouse_id,
                'warehouse_name': getattr(ev.inventory.warehouse, 'name', None),
                'type': ev.choice,
                'quantity': qty,
                'delta': delta,
                'balance': balance,
                'notes': ev.notes,
            })

        product = Product.objects.filter(id=product_id).first()
        return Response({
            'product': {
                'id': product.id if product else product_id,
                'name': product.name if product else None,
                'sku': product.sku if product else None,
            },
            'warehouse_id': warehouse_id,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'opening_balance': max(0, balance - sum(r['delta'] for r in rows)) if rows else balance,
            'rows': rows,
        })

    @action(detail=False, methods=['get'])
    def audit(self, request):
        """
        Reporte simple de auditoría con filtros:
        ?model=Product|Inventory&action=create|update|delete&days=30
        Retorna logs y un pequeño resumen por acción.
        """
        days = int(request.query_params.get('days', 30))
        model = request.query_params.get('model')
        action = request.query_params.get('action')

        base_qs = AuditLog.objects.filter(created_at__gte=timezone.now() - timedelta(days=days))
        if model:
            base_qs = base_qs.filter(model=model)
        if action:
            base_qs = base_qs.filter(action=action)

        # Resumen por acción SIEMPRE sobre el queryset completo (sin slice)
        summary = {
            'create': base_qs.filter(action='create').count(),
            'update': base_qs.filter(action='update').count(),
            'delete': base_qs.filter(action='delete').count(),
        }

        # Paginación: page/page_size
        try:
            page = int(request.query_params.get('page', 1))
        except ValueError:
            page = 1
        try:
            page_size = int(request.query_params.get('page_size', 50))
        except ValueError:
            page_size = 50
        page = max(1, page)
        page_size = max(1, min(page_size, 500))

        total = base_qs.count()
        total_pages = (total + page_size - 1) // page_size if page_size else 1
        offset = (page - 1) * page_size
        items_qs = base_qs.order_by('-created_at')[offset:offset + page_size]

        serializer = AuditLogSerializer(items_qs, many=True)
        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'summary': summary,
            'results': serializer.data
        })

    @action(detail=False, methods=['get'], url_path='price-changes')
    def price_changes(self, request):
        """
        Timeline combinado de cambios de precio de venta y costo para un producto.
        GET /api/reports/price-changes/?product_id=ID
        """
        try:
            product_id = int(request.query_params.get('product_id'))
        except (TypeError, ValueError):
            return Response({'error': 'product_id es requerido y debe ser entero'}, status=400)

        price_hist = ProductPriceHistory.objects.filter(product_id=product_id).order_by('-start_date')
        cost_hist = ProductCostHistory.objects.filter(product_id=product_id).order_by('-start_date')
        price_rows = [
            {
                'type': 'sale',
                'price': float(h.price),
                'start_date': h.start_date.isoformat(),
                'end_date': h.end_date.isoformat() if h.end_date else None,
            }
            for h in price_hist
        ]
        cost_rows = [
            {
                'type': 'cost',
                'price': float(h.cost_price),
                'start_date': h.start_date.isoformat(),
                'end_date': h.end_date.isoformat() if h.end_date else None,
            }
            for h in cost_hist
        ]

        return Response({'product_id': product_id, 'sale': price_rows, 'cost': cost_rows})

    @action(detail=False, methods=['get'], url_path='audit/export')
    def audit_export(self, request):
        """
        Exporta CSV de logs de auditoría con los mismos filtros del reporte.
        Query params:
          - days (int, default 30)
          - model (str)
          - action (create|update|delete)
          - search (str, busca en actor y object_repr)
          - scope (page|all, default 'page'): si 'page', usa page y page_size; si 'all', exporta todo el rango filtrado.
          - page (int, default 1)
          - page_size (int, default 100)
        """
        days = int(request.query_params.get('days', 30))
        model = request.query_params.get('model')
        action = request.query_params.get('action')
        search = request.query_params.get('search')
        scope = (request.query_params.get('scope') or 'page').lower()

        base_qs = AuditLog.objects.filter(created_at__gte=timezone.now() - timedelta(days=days))
        if model:
            base_qs = base_qs.filter(model=model)
        if action:
            base_qs = base_qs.filter(action=action)
        if search:
            base_qs = base_qs.filter(Q(actor__icontains=search) | Q(object_repr__icontains=search))

        base_qs = base_qs.order_by('-created_at')

        # Paginación si scope=page
        if scope != 'all':
            try:
                page = int(request.query_params.get('page', 1))
            except ValueError:
                page = 1
            try:
                page_size = int(request.query_params.get('page_size', 100))
            except ValueError:
                page_size = 100
            page = max(1, page)
            page_size = max(1, min(page_size, 2000))
            offset = (page - 1) * page_size
            qs = base_qs[offset:offset + page_size]
        else:
            # Límite de seguridad para exportaciones completas
            max_rows = min(int(request.query_params.get('max_rows', 50000)), 100000)
            qs = base_qs[:max_rows]

        # Construir CSV en memoria
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        filename = f"audit_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(['created_at', 'model', 'action', 'object_id', 'object_repr', 'actor', 'ip_address', 'changes'])
        for item in qs.iterator():
            changes_str = ''
            if item.changes is not None:
                try:
                    changes_str = json.dumps(item.changes, ensure_ascii=False)
                except Exception:
                    changes_str = str(item.changes)
            writer.writerow([
                item.created_at.isoformat(),
                item.model,
                item.action,
                item.object_id,
                item.object_repr or '',
                item.actor or '',
                item.ip_address or '',
                changes_str,
            ])
        return response


class AuditPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [AllowAny]
    pagination_class = AuditPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['model', 'actor', 'object_repr']
    ordering = ['-created_at']
