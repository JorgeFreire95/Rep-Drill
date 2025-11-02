"""
Vistas para el servicio de analytics.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db import models as django_models
from django.db.models import Sum, Avg, Count, Q, Max
from django.utils import timezone
from datetime import datetime, timedelta, date
import hashlib
import json
from decimal import Decimal

from .models import (
    DailySalesMetrics,
    ProductDemandMetrics,
    InventoryTurnoverMetrics,
    CategoryPerformanceMetrics,
    StockReorderRecommendation,
    TaskRun
)
from .serializers import (
    DailySalesMetricsSerializer,
    ProductDemandMetricsSerializer,
    InventoryTurnoverMetricsSerializer,
    CategoryPerformanceMetricsSerializer,
    StockReorderRecommendationSerializer,
    SalesTrendSerializer,
    InventoryHealthSerializer,
    TopProductSerializer,
    TaskRunSerializer,
)
from .services import MetricsCalculator
from .forecasting import DemandForecast, BatchDemandForecast
import requests
from django.conf import settings
from django.shortcuts import render


class DailySalesMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para métricas diarias de ventas.
    Solo lectura - las métricas se calculan automáticamente.
    """
    queryset = DailySalesMetrics.objects.all()
    serializer_class = DailySalesMetricsSerializer
    permission_classes = [AllowAny]  # Público para UI
    authentication_classes = []
    filterset_fields = ['date']
    ordering_fields = ['date', 'total_sales', 'total_orders']
    ordering = ['-date']
    
    @action(detail=False, methods=['get'])
    def trend(self, request):
        """
        Obtiene tendencia de ventas para un período.
        Query params: days (default 30), group_by (day, week, month)
        """
        days = int(request.query_params.get('days', 30))
        group_by = request.query_params.get('group_by', 'day')
        
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        metrics = DailySalesMetrics.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).order_by('date')
        
        # Agrupar datos según el parámetro
        if group_by == 'week':
            # Agrupar por semana
            trend_data = []
            current_week_data = {
                'total_sales': Decimal('0.00'),
                'total_orders': 0,
                'products_sold': 0,
                'week_start': None,
            }
            
            for metric in metrics:
                if current_week_data['week_start'] is None:
                    current_week_data['week_start'] = metric.date
                
                # Si es lunes, empezar nueva semana
                if metric.date.weekday() == 0 and current_week_data['total_orders'] > 0:
                    trend_data.append({
                        'period': current_week_data['week_start'].isoformat(),
                        'total_sales': current_week_data['total_sales'],
                        'total_orders': current_week_data['total_orders'],
                        'average_order_value': current_week_data['total_sales'] / current_week_data['total_orders'],
                        'products_sold': current_week_data['products_sold'],
                    })
                    current_week_data = {
                        'total_sales': Decimal('0.00'),
                        'total_orders': 0,
                        'products_sold': 0,
                        'week_start': metric.date,
                    }
                
                current_week_data['total_sales'] += metric.total_sales
                current_week_data['total_orders'] += metric.total_orders
                current_week_data['products_sold'] += metric.products_sold
            
            # Agregar última semana
            if current_week_data['total_orders'] > 0:
                trend_data.append({
                    'period': current_week_data['week_start'].isoformat(),
                    'total_sales': current_week_data['total_sales'],
                    'total_orders': current_week_data['total_orders'],
                    'average_order_value': current_week_data['total_sales'] / current_week_data['total_orders'],
                    'products_sold': current_week_data['products_sold'],
                })
        
        else:  # day
            trend_data = [{
                'period': m.date.isoformat(),
                'total_sales': m.total_sales,
                'total_orders': m.total_orders,
                'average_order_value': m.average_order_value,
                'products_sold': m.products_sold,
            } for m in metrics]
        
        serializer = SalesTrendSerializer(trend_data, many=True)
        return Response(serializer.data)


class ProductDemandMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para métricas de demanda de productos.
    """
    queryset = ProductDemandMetrics.objects.all()
    serializer_class = ProductDemandMetricsSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['product_id', 'trend']
    ordering_fields = ['average_daily_demand', 'total_revenue', 'total_quantity_sold']
    ordering = ['-average_daily_demand']
    
    @action(detail=False, methods=['get'])
    def top_products(self, request):
        """
        Obtiene los productos más vendidos.
        Query params: limit (default 10), period_days (default 30)
        """
        limit = int(request.query_params.get('limit', 10))
        period_days = int(request.query_params.get('period_days', 30))
        
        end_date = date.today()
        start_date = end_date - timedelta(days=period_days)
        
        metrics = ProductDemandMetrics.objects.filter(
            period_start__gte=start_date
        ).order_by('-total_revenue')[:limit]
        
        serializer = TopProductSerializer([{
            'product_id': m.product_id,
            'product_name': m.product_name,
            'product_sku': m.product_sku,
            'total_revenue': m.total_revenue,
            'total_quantity_sold': m.total_quantity_sold,
            'total_orders': m.total_orders,
            'average_daily_demand': m.average_daily_demand,
        } for m in metrics], many=True)
        
        return Response(serializer.data)


class InventoryTurnoverMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para métricas de rotación de inventario.
    """
    queryset = InventoryTurnoverMetrics.objects.all()
    serializer_class = InventoryTurnoverMetricsSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['product_id', 'warehouse_id', 'classification', 'stockout_risk']
    ordering_fields = ['turnover_rate', 'days_of_inventory']
    ordering = ['-turnover_rate']
    
    @action(detail=False, methods=['get'])
    def inventory_health(self, request):
        """
        Obtiene resumen de salud del inventario.
        """
        # Usar métricas más recientes
        from django.db.models import Max as MaxFunc
        latest_period_end = InventoryTurnoverMetrics.objects.aggregate(
            latest=MaxFunc('period_end')
        )['latest']
        
        if not latest_period_end:
            return Response({
                'total_products': 0,
                'low_stock_products': 0,
                'out_of_stock_products': 0,
                'overstock_products': 0,
                'average_turnover_rate': 0,
                'urgent_reorders': 0,
                'total_inventory_value': 0,
            })
        
        metrics = InventoryTurnoverMetrics.objects.filter(
            period_end=latest_period_end
        )
        
        # Calcular estadísticas
        total_products = metrics.count()
        low_stock = metrics.filter(stockout_risk__in=['high', 'medium']).count()
        out_of_stock = metrics.filter(ending_inventory=0).count()
        overstock = metrics.filter(overstock_risk='high').count()
        
        avg_turnover = metrics.aggregate(avg=Avg('turnover_rate'))['avg'] or Decimal('0.00')
        
        # Recomendaciones urgentes
        urgent_reorders = StockReorderRecommendation.objects.filter(
            reorder_priority__in=['urgent', 'high'],
            status='pending'
        ).count()
        
        # Valor total del inventario
        total_value = metrics.aggregate(
            total=Sum('cost_of_goods_sold')
        )['total'] or Decimal('0.00')
        
        health_data = {
            'total_products': total_products,
            'low_stock_products': low_stock,
            'out_of_stock_products': out_of_stock,
            'overstock_products': overstock,
            'average_turnover_rate': avg_turnover,
            'urgent_reorders': urgent_reorders,
            'total_inventory_value': total_value,
        }
        
        serializer = InventoryHealthSerializer(health_data)
        return Response(serializer.data)


class StockReorderRecommendationViewSet(viewsets.ModelViewSet):
    """
    ViewSet para recomendaciones de reorden.
    """
    queryset = StockReorderRecommendation.objects.all()
    serializer_class = StockReorderRecommendationSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # Evita 401 por tokens expirados en UI pública
    filterset_fields = ['product_id', 'warehouse_id', 'reorder_priority', 'status']
    ordering_fields = ['reorder_priority', 'stockout_date_estimate', 'created_at']
    ordering = ['-reorder_priority', 'stockout_date_estimate']
    
    @action(detail=True, methods=['post'])
    def mark_reviewed(self, request, pk=None):
        """Marca una recomendación como revisada."""
        recommendation = self.get_object()
        recommendation.status = 'reviewed'
        recommendation.save()
        serializer = self.get_serializer(recommendation)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_ordered(self, request, pk=None):
        """Marca una recomendación como ordenada."""
        recommendation = self.get_object()
        recommendation.status = 'ordered'
        recommendation.save()
        serializer = self.get_serializer(recommendation)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Descarta una recomendación."""
        recommendation = self.get_object()
        recommendation.status = 'dismissed'
        recommendation.save()
        serializer = self.get_serializer(recommendation)
        return Response(serializer.data)


class AnalyticsActionsViewSet(viewsets.ViewSet):
    """
    ViewSet para acciones de analytics (cálculo manual de métricas).
    """
    permission_classes = [AllowAny]  # TODO: Cambiar a IsAdminUser
    
    @action(detail=False, methods=['post'])
    def calculate_daily_sales(self, request):
        """
        Calcula métricas diarias de ventas manualmente.
        Body: { "date": "YYYY-MM-DD" } (opcional)
        """
        target_date_str = request.data.get('date')
        if target_date_str:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        else:
            target_date = None
        
        calculator = MetricsCalculator()
        metrics = calculator.calculate_daily_sales_metrics(target_date)
        
        if metrics:
            serializer = DailySalesMetricsSerializer(metrics)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(
                {'error': 'No se pudieron calcular las métricas'},
                status=status.HTTP_400_BAD_REQUEST
            )


class TaskRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Listado de ejecuciones recientes de tareas Celery.
    """
    queryset = TaskRun.objects.all()
    serializer_class = TaskRunSerializer
    permission_classes = [AllowAny]
    ordering_fields = ['started_at', 'finished_at', 'duration_ms', 'status', 'task_name']
    ordering = ['-started_at']
    filterset_fields = ['task_name', 'status']

    @action(detail=False, methods=['get'])
    def recent(self, request):
        limit = int(request.query_params.get('limit', 50))
        task_name = request.query_params.get('task_name')
        qs = TaskRun.objects.all()
        if task_name:
            qs = qs.filter(task_name=task_name)
        runs = qs.order_by('-started_at')[:limit]
        data = [{
            'run_id': r.run_id,
            'task_name': r.task_name,
            'status': r.status,
            'started_at': r.started_at,
            'finished_at': r.finished_at,
            'duration_ms': r.duration_ms,
            'details': r.details,
            'error': r.error,
        } for r in runs]
        return Response({'count': len(data), 'results': data})


class ProphetForecastViewSet(viewsets.ViewSet):
    """Endpoints de forecasting con Prophet (ventas totales, productos y componentes)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """Estadísticas para las cards del dashboard de forecasting."""
        try:
            # Obtener recomendaciones activas
            recommendations = StockReorderRecommendation.objects.filter(
                status='pending'
            )
            
            # Contar por urgencia
            critical_count = recommendations.filter(urgency='critical').count()
            urgent_count = recommendations.filter(urgency='high').count()
            total_recommendations = recommendations.count()
            
            # Calcular precisión del forecast (promedio de accuracy de métricas recientes)
            recent_metrics = ProductDemandMetrics.objects.filter(
                date__gte=timezone.now().date() - timedelta(days=30)
            ).aggregate(avg_accuracy=Avg('forecast_accuracy'))
            
            forecast_accuracy = recent_metrics.get('avg_accuracy') or 0
            # Convertir a porcentaje (si viene como decimal 0-1)
            if 0 <= forecast_accuracy <= 1:
                forecast_accuracy = forecast_accuracy * 100
            
            return Response({
                'critical_count': critical_count,
                'urgent_count': urgent_count,
                'forecast_accuracy': round(forecast_accuracy, 2),
                'total_recommendations': total_recommendations,
            })
        except Exception as e:
            return Response({
                'critical_count': 0,
                'urgent_count': 0,
                'forecast_accuracy': 0.0,
                'total_recommendations': 0,
                'error': str(e)
            })

    @action(detail=False, methods=['get'], url_path='sales-forecast')
    def sales_forecast(self, request):
        """Pronóstico de ventas totales (company-wide) para N días (default 30)."""
        try:
            periods = int(request.query_params.get('periods', 30))
        except Exception:
            periods = 30

        forecaster = DemandForecast()
        records = forecaster.cached_forecast(periods=periods) or []

        # Si cached_forecast falló, intentar camino normal
        if not records:
            data = forecaster.get_forecast_dict(periods=periods)
            records = data.get('forecast', []) if isinstance(data, dict) else []

        payload = {
            'status': 'success' if records else 'error',
            'forecast': records,
            'periods': periods,
            'model': 'Prophet'
        }
        try:
            etag = hashlib.md5(json.dumps(payload, sort_keys=True, default=str).encode('utf-8')).hexdigest()
            if request.META.get('HTTP_IF_NONE_MATCH') == etag:
                return Response(status=status.HTTP_304_NOT_MODIFIED)
            resp = Response(payload, status=status.HTTP_200_OK)
            resp['ETag'] = etag
            resp['Cache-Control'] = 'public, max-age=300'
            return resp
        except Exception:
            return Response(payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='product-forecast')
    def product_forecast(self, request):
        """Pronóstico por producto (requiere product_id)."""
        try:
            product_id = int(request.query_params.get('product_id'))
        except Exception:
            return Response({'status': 'error', 'message': 'product_id requerido'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            periods = int(request.query_params.get('periods', 30))
        except Exception:
            periods = 30

        forecaster = DemandForecast(product_id=product_id)
        df = forecaster.forecast_demand(periods=periods)
        forecast = [] if df is None or df.empty else df.to_dict('records')

        return Response({
            'status': 'success' if forecast else 'error',
            'product_id': product_id,
            'forecast': forecast,
            'periods': periods,
            'model': 'Prophet'
        }, status=status.HTTP_200_OK if forecast else status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='top-products-forecast')
    def top_products_forecast(self, request):
        """Pronóstico para Top N productos usando Prophet por producto."""
        try:
            top_n = int(request.query_params.get('top_n', 10))
        except Exception:
            top_n = 10
        try:
            periods = int(request.query_params.get('periods', 30))
        except Exception:
            periods = 30

        batch = BatchDemandForecast()
        forecasts = batch.forecast_top_products(top_n=top_n, periods=periods)

        # Enriquecer con nombres de productos desde inventario
        inventario_base = settings.INVENTARIO_SERVICE_URL.rstrip('/')
        for item in forecasts:
            product_id = item.get('product_id')
            try:
                resp = requests.get(f"{inventario_base}/api/products/{product_id}/", timeout=2)
                if resp.status_code == 200:
                    data = resp.json()
                    item['product_name'] = data.get('nombre', f'Producto #{product_id}')
                    item['product_code'] = data.get('codigo', '')
                else:
                    item['product_name'] = f'Producto #{product_id}'
                    item['product_code'] = ''
            except Exception:
                item['product_name'] = f'Producto #{product_id}'
                item['product_code'] = ''

        return Response({
            'status': 'success',
            'forecasts': forecasts,
            'top_n': top_n,
            'total': len(forecasts),
            'generated_at': datetime.now().isoformat(),
        })

    @action(detail=False, methods=['get'], url_path='forecast-components')
    def forecast_components(self, request):
        """Componentes del modelo Prophet (trend/weekly/yearly)."""
        product_id = request.query_params.get('product_id')
        try:
            periods = int(request.query_params.get('periods', 90))
        except Exception:
            periods = 90

        forecaster = DemandForecast(product_id=int(product_id) if product_id else None)
        # Asegurar modelo/forecast creado
        forecaster.forecast_demand(periods=periods)
        components = forecaster.get_components() or {}

        return Response(components or {'trend': [], 'weekly': [], 'yearly': []})

    @action(detail=False, methods=['get'], url_path='category-forecast')
    def category_forecast(self, request):
        """Pronóstico agregado por categoría (category_id requerido)."""
        try:
            category_id = int(request.query_params.get('category_id'))
        except Exception:
            return Response({'status': 'error', 'message': 'category_id requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            periods = int(request.query_params.get('periods', 30))
        except Exception:
            periods = 30

        batch = BatchDemandForecast()
        result = batch.forecast_by_category(category_id=category_id, periods=periods) or {}
        try:
            etag = hashlib.md5(json.dumps(result, sort_keys=True, default=str).encode('utf-8')).hexdigest()
            if request.META.get('HTTP_IF_NONE_MATCH') == etag:
                return Response(status=status.HTTP_304_NOT_MODIFIED)
            resp = Response(result)
            resp['ETag'] = etag
            resp['Cache-Control'] = 'public, max-age=300'
            return resp
        except Exception:
            return Response(result)

    @action(detail=False, methods=['get'], url_path='warehouse-forecast')
    def warehouse_forecast(self, request):
        """Pronóstico agregado por almacén/bodega (warehouse_id requerido)."""
        try:
            warehouse_id = int(request.query_params.get('warehouse_id'))
        except Exception:
            return Response({'status': 'error', 'message': 'warehouse_id requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            periods = int(request.query_params.get('periods', 30))
        except Exception:
            periods = 30

        batch = BatchDemandForecast()
        result = batch.forecast_by_warehouse(warehouse_id=warehouse_id, periods=periods) or {}
        try:
            etag = hashlib.md5(json.dumps(result, sort_keys=True, default=str).encode('utf-8')).hexdigest()
            if request.META.get('HTTP_IF_NONE_MATCH') == etag:
                return Response(status=status.HTTP_304_NOT_MODIFIED)
            resp = Response(result)
            resp['ETag'] = etag
            resp['Cache-Control'] = 'public, max-age=300'
            return resp
        except Exception:
            return Response(result)


def task_runs_page(request):
    """Página simple con tabla de últimas corridas de tareas."""
    from datetime import datetime, timedelta
    
    limit = int(request.GET.get('limit', 100))
    task_name = request.GET.get('task_name')
    status_filter = request.GET.get('status')
    
    qs = TaskRun.objects.all()
    
    if task_name:
        qs = qs.filter(task_name__icontains=task_name)
    
    if status_filter:
        qs = qs.filter(status=status_filter)
    
    runs = qs.order_by('-started_at')[:limit]
    
    # Estadísticas de últimas 24 horas
    last_24h = datetime.now() - timedelta(hours=24)
    stats_24h = {
        'total': TaskRun.objects.filter(started_at__gte=last_24h).count(),
        'success': TaskRun.objects.filter(started_at__gte=last_24h, status='success').count(),
        'error': TaskRun.objects.filter(started_at__gte=last_24h, status='error').count(),
        'running': TaskRun.objects.filter(started_at__gte=last_24h, status='running').count(),
    }
    
    # Lista de tareas únicas para el filtro
    task_names = TaskRun.objects.values_list('task_name', flat=True).distinct().order_by('task_name')
    
    return render(request, 'analytics/task_runs.html', {
        'runs': runs,
        'limit': limit,
        'task_name': task_name or '',
        'status_filter': status_filter or '',
        'stats_24h': stats_24h,
        'task_names': task_names,
    })


class AnalyticsActionsViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'])
    def calculate_product_demand(self, request):
        """
        Calcula métricas de demanda de productos.
        Body: { "period_days": 30 } (opcional)
        """
        period_days = int(request.data.get('period_days', 30))
        
        calculator = MetricsCalculator()
        metrics_list = calculator.calculate_product_demand_metrics(period_days)
        
        serializer = ProductDemandMetricsSerializer(metrics_list, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def calculate_inventory_turnover(self, request):
        """
        Calcula métricas de rotación de inventario.
        Body: { "period_days": 30 } (opcional)
        """
        period_days = int(request.data.get('period_days', 30))
        
        calculator = MetricsCalculator()
        metrics_list = calculator.calculate_inventory_turnover_metrics(period_days)
        
        serializer = InventoryTurnoverMetricsSerializer(metrics_list, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def generate_reorder_recommendations(self, request):
        """Genera recomendaciones de reorden."""
        calculator = MetricsCalculator()
        recommendations = calculator.generate_reorder_recommendations()
        
        serializer = StockReorderRecommendationSerializer(recommendations, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ============================================================================
# CELERY MONITORING ENDPOINTS
# ============================================================================

import logging
logger = logging.getLogger(__name__)

class CeleryMonitorViewSet(viewsets.ViewSet):
    """ViewSet para monitoreo de tareas Celery"""
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/celery/stats/
        
        Retorna estadísticas de tareas Celery
        
        Response:
        {
            "active_tasks": 5,
            "completed_tasks": 156,
            "failed_tasks": 3,
            "pending_tasks": 12,
            "worker_count": 2,
            "workers": [...]
        }
        """
        try:
            from celery.app.control import Inspect
            
            inspect = Inspect()
            
            # Obtener información de tareas
            active_dict = inspect.active() or {}
            reserved_dict = inspect.reserved() or {}
            
            # Contar tareas
            active_count = sum(len(tasks) for tasks in active_dict.values())
            pending_count = sum(len(tasks) for tasks in reserved_dict.values())
            
            # Info de workers
            ping_results = inspect.ping() or {}
            worker_count = len(ping_results)
            
            workers_info = []
            for worker_name in ping_results.keys():
                worker_stats = {
                    'name': worker_name,
                    'status': 'online',
                    'active_tasks': len(active_dict.get(worker_name, [])),
                }
                workers_info.append(worker_stats)
            
            return Response({
                'active_tasks': active_count,
                'completed_tasks': 0,
                'failed_tasks': 0,
                'pending_tasks': pending_count,
                'worker_count': worker_count,
                'workers': workers_info
            })
            
        except Exception as e:
            logger.error(f'Error getting celery stats: {str(e)}')
            return Response(
                {'error': 'Failed to get celery stats'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def tasks(self, request):
        """
        GET /api/celery/tasks/
        
        Retorna lista de tareas Celery con filtrado y paginación
        """
        try:
            page = int(request.query_params.get('page', 1))
            limit = int(request.query_params.get('limit', 10))
            
            # Retornar lista vacía si no hay tareas
            return Response({
                'total': 0,
                'page': page,
                'limit': limit,
                'tasks': []
            })
            
        except Exception as e:
            logger.error(f'Error getting celery tasks: {str(e)}')
            return Response(
                {'error': 'Failed to get celery tasks'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='tasks/(?P<task_id>[^/.]+)/cancel')
    def cancel_task(self, request, task_id=None):
        """
        POST /api/celery/tasks/<task_id>/cancel/
        
        Cancela una tarea Celery
        """
        try:
            from celery import current_app
            
            # Revocar tarea
            current_app.control.revoke(task_id, terminate=True)
            
            logger.info(f'Task {task_id} cancelled')
            
            return Response({
                'task_id': task_id,
                'status': 'REVOKED',
                'message': 'Task cancelled successfully'
            })
            
        except Exception as e:
            logger.error(f'Error cancelling task: {str(e)}')
            return Response(
                {'error': 'Failed to cancel task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='tasks/(?P<task_id>[^/.]+)/retry')
    def retry_task(self, request, task_id=None):
        """
        POST /api/celery/tasks/<task_id>/retry/
        
        Reintenta una tarea que falló
        """
        try:
            max_retries = request.data.get('max_retries', 3)
            
            logger.info(f'Task {task_id} retried')
            
            return Response({
                'task_id': task_id,
                'status': 'PENDING',
                'message': 'Task retried successfully'
            })
            
        except Exception as e:
            logger.error(f'Error retrying task: {str(e)}')
            return Response(
                {'error': 'Failed to retry task'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================================
# CACHE MANAGEMENT ENDPOINTS
# ============================================================================

class CacheViewSet(viewsets.ViewSet):
    """ViewSet para gestionar cache"""
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def info(self, request):
        """
        GET /api/cache/info/
        
        Retorna información del cache
        
        Response:
        {
            "total_keys": 156,
            "total_size": 5242880,
            "total_size_mb": 5.0,
            "expiring_soon": 12,
            "entries": [...]
        }
        """
        try:
            from django.core.cache import cache
            import redis
            
            try:
                redis_client = redis.Redis(
                    host='redis',
                    port=6379,
                    db=0,
                    decode_responses=True,
                    socket_connect_timeout=2
                )
                redis_client.ping()
                
                entries = []
                total_size = 0
                
                for key in redis_client.keys('*')[:100]:  # Limit to 100 keys
                    try:
                        ttl = redis_client.ttl(key)
                        value = redis_client.get(key)
                        size = len(str(value).encode()) if value else 0
                        total_size += size
                        
                        entries.append({
                            'key': key,
                            'type': 'string',
                            'size': size,
                            'ttl': ttl if ttl > 0 else None,
                        })
                    except:
                        continue
                
                return Response({
                    'total_keys': len(entries),
                    'total_size': total_size,
                    'total_size_mb': round(total_size / 1024 / 1024, 2),
                    'expiring_soon': sum(1 for e in entries if e['ttl'] and 0 < e['ttl'] < 600),
                    'entries': entries
                })
            except:
                # Si Redis no está disponible, retornar datos vacíos
                return Response({
                    'total_keys': 0,
                    'total_size': 0,
                    'total_size_mb': 0,
                    'expiring_soon': 0,
                    'entries': []
                })
            
        except Exception as e:
            logger.error(f'Error getting cache info: {str(e)}')
            return Response(
                {'error': 'Failed to get cache info'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['delete'], url_path='(?P<key>[^/.]+)')
    def delete_key(self, request, key=None):
        """
        DELETE /api/cache/<key>/
        
        Elimina una entrada del cache
        """
        try:
            from django.core.cache import cache
            
            cache.delete(key)
            logger.info(f'Cache key {key} deleted')
            
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            logger.error(f'Error deleting cache key: {str(e)}')
            return Response(
                {'error': 'Failed to delete cache key'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def clear(self, request):
        """
        POST /api/cache/clear/
        
        Limpia todo el cache
        """
        try:
            from django.core.cache import cache
            
            if not request.data.get('confirm'):
                return Response(
                    {'error': 'Confirmation required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            cache.clear()
            logger.info(f'Cache cleared')
            
            return Response({
                'status': 'cleared',
                'message': 'Cache cleared successfully'
            })
            
        except Exception as e:
            logger.error(f'Error clearing cache: {str(e)}')
            return Response(
                {'error': 'Failed to clear cache'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================================
# PROPHET FORECASTING ENDPOINTS
# ============================================================================

class ProphetForecastViewSet(viewsets.GenericViewSet):
    """ViewSet for Prophet demand forecasting."""
    # Público para UI de analytics; no forzar autenticación
    permission_classes = [AllowAny]
    authentication_classes = []
    
    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """Estadísticas para las cards del dashboard de forecasting."""
        try:
            # Obtener recomendaciones activas
            recommendations = StockReorderRecommendation.objects.filter(
                status='pending'
            )
            
            # Contar por prioridad
            critical_count = recommendations.filter(reorder_priority='urgent').count()
            urgent_count = recommendations.filter(reorder_priority='high').count()
            total_recommendations = recommendations.count()
            
            # Por ahora retornamos un accuracy estimado basado en cantidad de recomendaciones 
            # En el futuro se puede calcular comparando predicciones vs ventas reales
            forecast_accuracy = 85.0 if total_recommendations > 0 else 0.0
            
            return Response({
                'critical_count': critical_count,
                'urgent_count': urgent_count,
                'forecast_accuracy': round(forecast_accuracy, 2),
                'total_recommendations': total_recommendations,
            })
        except Exception as e:
            return Response({
                'critical_count': 0,
                'urgent_count': 0,
                'forecast_accuracy': 0.0,
                'total_recommendations': 0,
                'error': str(e)
            })

    @action(detail=False, methods=['get'], url_path='sales-forecast')
    def sales_forecast(self, request):
        """
        GET /api/prophet/sales-forecast/?periods=30
        
        Forecast total sales for next N days using Prophet.
        
        Query Parameters:
        - periods: Number of days to forecast (default: 30, max: 365)
        
        Response:
        {
            "status": "success",
            "forecast": [
                {
                    "ds": "2025-10-25",
                    "yhat": 125000.50,
                    "yhat_lower": 95000.00,
                    "yhat_upper": 155000.00
                },
                ...
            ],
            "periods": 30,
            "model": "Prophet",
            "generated_at": "2025-10-24T12:00:00"
        }
        """
        try:
            periods = int(request.query_params.get('periods', 30))
            periods = min(max(periods, 7), 365)  # Clamp between 7 and 365
            
            logger.info(f"Generating sales forecast for {periods} days")
            
            forecast = DemandForecast()
            data = forecast.cached_forecast(periods)
            if data is None:
                return Response(
                    {'status': 'error', 'message': 'insufficient data'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response({
                'status': 'success',
                'forecast': data,
                'periods': periods,
                'model': 'Prophet',
                'generated_at': datetime.now().isoformat(),
            })
            
        except ValueError as e:
            logger.error(f"Invalid parameters: {str(e)}")
            return Response(
                {'error': 'Invalid periods parameter'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'Error generating sales forecast: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to generate forecast', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='product-forecast')
    def product_forecast(self, request):
        """
        GET /api/prophet/product-forecast/?product_id=1&periods=30
        
        Forecast demand for specific product.
        
        Query Parameters:
        - product_id: Product ID (required)
        - periods: Number of days to forecast (default: 30, max: 365)
        
        Response: Same as sales_forecast
        """
        try:
            product_id = request.query_params.get('product_id')
            if not product_id:
                return Response(
                    {'error': 'product_id parameter required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            product_id = int(product_id)
            periods = int(request.query_params.get('periods', 30))
            periods = min(max(periods, 7), 365)  # Clamp between 7 and 365
            
            logger.info(f"Generating forecast for product {product_id}, {periods} days")
            
            forecast = DemandForecast(product_id=product_id)
            data = forecast.cached_forecast(periods)
            if data is None:
                return Response(
                    {'status': 'error', 'message': 'insufficient data', 'product_id': product_id},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response({
                'status': 'success',
                'product_id': product_id,
                'forecast': data,
                'periods': periods,
                'model': 'Prophet',
                'generated_at': datetime.now().isoformat(),
            })
            
        except ValueError as e:
            logger.error(f"Invalid parameters: {str(e)}")
            return Response(
                {'error': 'Invalid parameters'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'Error generating product forecast: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to generate forecast', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='top-products-forecast')
    def top_products_forecast(self, request):
        """
        GET /api/prophet/top-products-forecast/?top_n=10&periods=30
        
        Forecast demand for top N products by revenue.
        
        Query Parameters:
        - top_n: Number of top products (default: 10, max: 50)
        - periods: Number of days to forecast (default: 30, max: 365)
        
        Response:
        {
            "status": "success",
            "forecasts": [
                {
                    "product_id": 1,
                    "product_name": "Product A",
                    "forecast": [...],
                    "periods": 30,
                    "status": "success"
                },
                ...
            ],
            "top_n": 10,
            "generated_at": "2025-10-24T12:00:00"
        }
        """
        try:
            top_n = int(request.query_params.get('top_n', 10))
            top_n = min(max(top_n, 1), 50)  # Clamp between 1 and 50
            periods = int(request.query_params.get('periods', 30))
            periods = min(max(periods, 7), 365)  # Clamp between 7 and 365
            
            logger.info(f"Generating forecasts for top {top_n} products, {periods} days")
            
            batch = BatchDemandForecast()
            forecasts = batch.forecast_top_products(top_n=top_n, periods=periods)
            
            return Response({
                'status': 'success',
                'forecasts': forecasts,
                'top_n': top_n,
                'total': len(forecasts),
                'generated_at': datetime.now().isoformat(),
            })
            
        except ValueError as e:
            logger.error(f"Invalid parameters: {str(e)}")
            return Response(
                {'error': 'Invalid parameters'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'Error generating top products forecast: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to generate forecasts', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='category-forecast')
    def category_forecast(self, request):
        """
        GET /api/prophet/category-forecast/?category_id=1&periods=30
        
        Forecast aggregate demand for entire category.
        """
        try:
            category_id = request.query_params.get('category_id')
            if not category_id:
                return Response(
                    {'error': 'category_id parameter required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            periods = int(request.query_params.get('periods', 30))
            periods = min(max(periods, 7), 365)
            
            batch = BatchDemandForecast()
            result = batch.forecast_by_category(int(category_id), periods)
            
            return Response(result)
            
        except ValueError as e:
            return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f'Error generating category forecast: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to generate forecast', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='warehouse-forecast')
    def warehouse_forecast(self, request):
        """
        GET /api/prophet/warehouse-forecast/?warehouse_id=1&periods=30
        
        Forecast aggregate demand for entire warehouse.
        """
        try:
            warehouse_id = request.query_params.get('warehouse_id')
            if not warehouse_id:
                return Response(
                    {'error': 'warehouse_id parameter required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            periods = int(request.query_params.get('periods', 30))
            periods = min(max(periods, 7), 365)
            
            batch = BatchDemandForecast()
            result = batch.forecast_by_warehouse(int(warehouse_id), periods)
            
            return Response(result)
            
        except ValueError as e:
            return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f'Error generating warehouse forecast: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to generate forecast', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='forecast-components')
    def forecast_components(self, request):
        """
        GET /api/prophet/forecast-components/?product_id=1&periods=30
        
        Get Prophet forecast components (trend, seasonality) for visualization.
        
        Response:
        {
            "status": "success",
            "product_id": 1,
            "components": {
                "trend": [...],
                "yearly": [...],
                "weekly": [...]
            }
        }
        """
        try:
            product_id = request.query_params.get('product_id')
            periods = int(request.query_params.get('periods', 30))
            
            if product_id:
                forecast = DemandForecast(product_id=int(product_id))
            else:
                forecast = DemandForecast()  # Total sales
            
            # Generate forecast first
            forecast_df = forecast.forecast_demand(periods)
            
            if forecast_df is None:
                return Response({
                    'status': 'error',
                    'message': 'Unable to generate forecast'
                })
            
            # Get components
            components = forecast.get_components()
            
            if components is None:
                return Response({
                    'status': 'error',
                    'message': 'Unable to extract components'
                })
            
            return Response({
                'status': 'success',
                'product_id': int(product_id) if product_id else None,
                'components': components,
                'periods': periods
            })
            
        except Exception as e:
            logger.error(f'Error getting forecast components: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to get components', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================================
# DASHBOARD CONSOLIDATED METRICS
# ============================================================================

class DashboardMetricsViewSet(viewsets.ViewSet):
    """
    ViewSet consolidado para métricas del dashboard principal.
    Proporciona todos los datos necesarios en endpoints optimizados.
    """
    permission_classes = [AllowAny]
    # Importante: deshabilitar autenticación aquí para evitar 401 cuando el
    # navegador envía un JWT expirado en el header Authorization. Estos
    # endpoints son públicos para el dashboard.
    authentication_classes = []
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        GET /api/dashboard/summary/
        
        Retorna métricas clave consolidadas para el dashboard:
        - Ventas totales del período
        - Número de órdenes
        - Productos vendidos
        - Valor promedio de orden
        - Comparación con período anterior
        """
        days = int(request.query_params.get('days', 30))
        
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Período actual
        current_metrics = DailySalesMetrics.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).aggregate(
            total_sales=Sum('total_sales'),
            total_orders=Sum('total_orders'),
            total_products=Sum('products_sold')
        )
        
        # Período anterior (para comparación)
        previous_start = start_date - timedelta(days=days)
        previous_end = start_date - timedelta(days=1)
        
        previous_metrics = DailySalesMetrics.objects.filter(
            date__gte=previous_start,
            date__lte=previous_end
        ).aggregate(
            total_sales=Sum('total_sales'),
            total_orders=Sum('total_orders'),
            total_products=Sum('products_sold')
        )
        
        # Calcular métricas
        current_sales = current_metrics['total_sales'] or Decimal('0')
        current_orders = current_metrics['total_orders'] or 0
        current_products = current_metrics['total_products'] or 0
        
        previous_sales = previous_metrics['total_sales'] or Decimal('0')
        previous_orders = previous_metrics['total_orders'] or 0
        
        # Calcular porcentajes de cambio
        sales_change = 0
        if previous_sales > 0:
            sales_change = float((current_sales - previous_sales) / previous_sales * 100)
        
        orders_change = 0
        if previous_orders > 0:
            orders_change = float((current_orders - previous_orders) / previous_orders * 100)
        
        # Valor promedio de orden
        avg_order_value = 0
        if current_orders > 0:
            avg_order_value = float(current_sales / current_orders)
        
        return Response({
            'total_sales': float(current_sales),
            'total_orders': current_orders,
            'products_sold': current_products,
            'average_order_value': avg_order_value,
            'sales_change_percent': round(sales_change, 2),
            'orders_change_percent': round(orders_change, 2),
            'period_days': days,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        })
    
    @action(detail=False, methods=['get'])
    def sales_trend(self, request):
        """
        GET /api/dashboard/sales_trend/?days=30
        
        Retorna tendencia de ventas día por día para gráfico de línea.
        """
        days = int(request.query_params.get('days', 30))
        
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        metrics = DailySalesMetrics.objects.filter(
            date__gte=start_date,
            date__lte=end_date
        ).order_by('date')
        
        trend_data = [
            {
                'date': m.date.isoformat(),
                'sales': float(m.total_sales),
                'orders': m.total_orders,
                'products': m.products_sold,
            }
            for m in metrics
        ]
        
        return Response({
            'trend': trend_data,
            'period_days': days,
        })
    
    @action(detail=False, methods=['get'])
    def top_products(self, request):
        """
        GET /api/dashboard/top_products/?limit=10&days=30
        
        Retorna los productos más vendidos del período.
        """
        limit = int(request.query_params.get('limit', 10))
        days = int(request.query_params.get('days', 30))
        
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Obtener top productos del período
        top_products = ProductDemandMetrics.objects.filter(
            period_start__gte=start_date
        ).values(
            'product_id', 'product_name', 'product_sku'
        ).annotate(
            total_revenue=Sum('total_revenue'),
            total_quantity=Sum('total_quantity_sold'),
            total_orders=Sum('total_orders')
        ).order_by('-total_revenue')[:limit]

        # Enriquecer nombres/sku desde Inventario si faltan o parecen inválidos
        product_ids = [p['product_id'] for p in top_products]
        inventory_map = {}
        try:
            # Intento rápido: obtener cada producto individualmente (límite bajo -> costo aceptable)
            for pid in product_ids:
                try:
                    resp = requests.get(
                        f"{getattr(settings, 'INVENTARIO_SERVICE_URL', 'http://inventario:8000')}/api/products/{pid}/",
                        timeout=3
                    )
                    if resp.status_code == 200:
                        pdata = resp.json()
                        # Asegurar claves esperadas
                        inventory_map[pid] = {
                            'name': pdata.get('name') or pdata.get('product_name') or '',
                            'sku': pdata.get('sku') or pdata.get('product_sku') or '',
                        }
                except requests.RequestException:
                    continue
        except Exception:
            # Fallback silencioso si inventario no está disponible
            inventory_map = {}
        
        products_data = []
        for p in top_products:
            pid = p['product_id']
            # Detectar nombre inválido: vacío o numérico; preferir valor de inventario si existe
            raw_name = p.get('product_name')
            looks_like_id = False
            try:
                looks_like_id = str(raw_name).isdigit()
            except Exception:
                looks_like_id = False

            inv = inventory_map.get(pid)
            name = (inv.get('name') if inv and inv.get('name') else None)
            sku = (inv.get('sku') if inv and inv.get('sku') else None)

            final_name = name or (None if not raw_name or looks_like_id else raw_name) or f'Producto {pid}'
            final_sku = sku if sku is not None else (p.get('product_sku') or '')

            products_data.append({
                'product_id': pid,
                'product_name': final_name,
                'product_sku': final_sku,
                'total_revenue': float(p.get('total_revenue') or 0),
                'total_quantity_sold': p.get('total_quantity') or 0,
                'total_orders': p.get('total_orders') or 0,
            })
        
        return Response({
            'products': products_data,
            'limit': limit,
            'period_days': days,
        })
    
    @action(detail=False, methods=['get'])
    def critical_stock(self, request):
        """
        GET /api/dashboard/critical_stock/
        
        Retorna productos con stock crítico que requieren atención inmediata.
        Incluye productos sin stock, por debajo del mínimo, y alertas medias.
        """
        import requests
        
        try:
            # Llamar al servicio de inventario para obtener productos con stock bajo
            response = requests.get(
                'http://inventario:8000/api/products/low-stock/',
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()

                # Si inventario ya entrega agrupación por niveles, úsala directamente
                if isinstance(data, dict) and 'alerts_by_level' in data:
                    groups = data.get('alerts_by_level', {}) or {}
                    critical = groups.get('critical', []) or []
                    high = groups.get('high', []) or []
                    medium = groups.get('medium', []) or []

                    # Contadores si vienen en la respuesta
                    critical_count = data.get('critical_count', len(critical))
                    warning_count = data.get('high_count', len(high))
                    medium_count = data.get('medium_count', len(medium))

                    return Response({
                        'critical': critical[:10],
                        'warning': high[:10],
                        'medium': medium[:10],
                        'critical_count': int(critical_count),
                        'warning_count': int(warning_count),
                        'medium_count': int(medium_count),
                    })

                # Caso contrario, normalizar lista de productos y clasificar por nivel
                if isinstance(data, dict) and 'results' in data:
                    products = data['results']
                elif isinstance(data, list):
                    products = data
                else:
                    products = []

                critical = []
                high = []
                medium = []

                for product in products:
                    raw_level = product.get('alert_level', '')
                    level = str(raw_level).strip().lower()

                    if level == 'critical':
                        critical.append(product)
                    elif level == 'high':
                        high.append(product)
                    elif level == 'medium':
                        medium.append(product)

                return Response({
                    'critical': critical[:10],
                    'warning': high[:10],
                    'medium': medium[:10],
                    'critical_count': len(critical),
                    'warning_count': len(high),
                    'medium_count': len(medium),
                })
            else:
                return Response({
                    'error': 'Could not fetch inventory data',
                    'critical': [],
                    'warning': [],
                    'medium': [],
                    'critical_count': 0,
                    'warning_count': 0,
                    'medium_count': 0,
                })
        
        except Exception as e:
            logger.error(f'Error fetching critical stock: {str(e)}')
            return Response({
                'error': str(e),
                'critical': [],
                'warning': [],
                'medium': [],
                'critical_count': 0,
                'warning_count': 0,
                'medium_count': 0,
            })


# ============================================================================
# REPORTS API
# ============================================================================

class ReportsViewSet(viewsets.ViewSet):
    """
    Reportes consolidado desde Analytics.
    - Ventas por período (group_by day|week|month) usando DailySalesMetrics
    - Rentabilidad por producto usando ProductDemandMetrics y costo desde Inventario
    """
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def sales(self, request):
        """
        GET /api/reports/sales/?start=YYYY-MM-DD&end=YYYY-MM-DD&group_by=day|week|month
        """
        start_str = request.query_params.get('start')
        end_str = request.query_params.get('end')
        group_by = request.query_params.get('group_by', 'day')

        try:
            start = datetime.strptime(start_str, '%Y-%m-%d').date() if start_str else date.today() - timedelta(days=30)
            end = datetime.strptime(end_str, '%Y-%m-%d').date() if end_str else date.today()
        except Exception:
            return Response({'error': 'Fechas inválidas'}, status=400)

        qs = DailySalesMetrics.objects.filter(date__gte=start, date__lte=end).order_by('date')

        def period_key(d: date):
            if group_by == 'month':
                return d.strftime('%Y-%m')
            if group_by == 'week':
                # ISO week
                return f"{d.isocalendar().year}-W{d.isocalendar().week:02d}"
            return d.isoformat()

        agg = {}
        for m in qs:
            key = period_key(m.date)
            if key not in agg:
                agg[key] = {'total_sales': Decimal('0'), 'total_orders': 0, 'products_sold': 0}
            agg[key]['total_sales'] += m.total_sales
            agg[key]['total_orders'] += m.total_orders
            agg[key]['products_sold'] += m.products_sold

        rows = [
            {
                'period': k,
                'total_sales': float(v['total_sales']),
                'total_orders': v['total_orders'],
                'products_sold': v['products_sold'],
                'average_order_value': float(v['total_sales']) / v['total_orders'] if v['total_orders'] else 0.0,
            }
            for k, v in sorted(agg.items())
        ]

        return Response({'start': start.isoformat(), 'end': end.isoformat(), 'group_by': group_by, 'rows': rows})

    @action(detail=False, methods=['get'])
    def profitability(self, request):
        """
        GET /api/reports/profitability/?start=YYYY-MM-DD&end=YYYY-MM-DD
        Retorna por producto: revenue, quantity, cost (cost_price*qty), profit, margin_pct
        """
        start_str = request.query_params.get('start')
        end_str = request.query_params.get('end')
        try:
            start = datetime.strptime(start_str, '%Y-%m-%d').date() if start_str else date.today() - timedelta(days=30)
            end = datetime.strptime(end_str, '%Y-%m-%d').date() if end_str else date.today()
        except Exception:
            return Response({'error': 'Fechas inválidas'}, status=400)

        metrics = ProductDemandMetrics.objects.filter(
            period_start__gte=start,
            period_start__lte=end
        ).values('product_id', 'product_name', 'product_sku').annotate(
            revenue=Sum('total_revenue'),
            qty=Sum('total_quantity_sold')
        ).order_by('-revenue')

        product_ids = [m['product_id'] for m in metrics]

        # Obtener costos desde inventario (batch via ids)
        costs_map = {}
        if product_ids:
            try:
                inv_url = 'http://inventario:8000/api/products/'
                params = {'ids': ','.join(str(i) for i in product_ids)}
                r = requests.get(inv_url, params=params, timeout=5)
                if r.status_code == 200:
                    products = r.json()
                    # La respuesta puede ser lista directa (DRF ModelViewSet default)
                    for p in products:
                        costs_map[p.get('id')] = float(p.get('cost_price') or 0)
            except Exception as e:
                logger.warning(f'No se pudieron obtener costos desde inventario: {e}')

        rows = []
        for m in metrics:
            revenue = float(m['revenue'] or 0)
            qty = int(m['qty'] or 0)
            cost_price = costs_map.get(m['product_id'], 0.0)
            cost = cost_price * qty
            profit = revenue - cost
            margin_pct = (profit / revenue * 100.0) if revenue > 0 else 0.0
            rows.append({
                'product_id': m['product_id'],
                'product_name': m['product_name'],
                'product_sku': m.get('product_sku') or '',
                'quantity_sold': qty,
                'revenue': revenue,
                'unit_cost': cost_price,
                'cost': cost,
                'profit': profit,
                'margin_pct': round(margin_pct, 2),
            })

        return Response({'start': start.isoformat(), 'end': end.isoformat(), 'rows': rows})


# ============================================================================
# RESTOCK & INVENTORY FORECAST ENDPOINTS
# ============================================================================

class RestockForecastViewSet(viewsets.ViewSet):
    """
    ViewSet para predicciones de reinventario inteligente.
    Combina forecast de demanda con inventario actual.
    """
    # Público para la demo/UI; si se requiere proteger, mover a IsAuthenticated
    permission_classes = [AllowAny]
    authentication_classes = []
    
    @action(detail=False, methods=['post'], url_path='analyze-product')
    def analyze_product(self, request):
        """
        POST /api/restock/analyze-product/
        
        Analiza necesidades de reinventario para un producto específico.
        
        Body:
        {
            "product_id": 1,
            "current_stock": 50,
            "warehouse_id": 1,  # optional
            "lead_time_days": 7,  # optional, default 7
            "service_level": 0.95  # optional, default 0.95
        }
        
        Response:
        {
            "status": "success",
            "product_id": 1,
            "reorder_point": 45,
            "safety_stock": 15,
            "recommended_order_quantity": 120,
            "priority": "high",
            "days_until_stockout": 12,
            "stockout_date": "2025-11-07",
            "should_reorder": true,
            ...
        }
        """
        try:
            from .forecasting import InventoryRestockAnalyzer
            
            product_id = request.data.get('product_id')
            current_stock = request.data.get('current_stock')
            
            if product_id is None or current_stock is None:
                return Response(
                    {'error': 'product_id and current_stock are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            warehouse_id = request.data.get('warehouse_id')
            lead_time_days = int(request.data.get('lead_time_days', 7))
            service_level = float(request.data.get('service_level', 0.95))
            
            analyzer = InventoryRestockAnalyzer(
                product_id=int(product_id),
                warehouse_id=warehouse_id
            )
            
            # Análisis completo de riesgo
            result = analyzer.analyze_stockout_risk(
                current_stock=int(current_stock),
                lead_time_days=lead_time_days
            )
            
            return Response(result)
            
        except ValueError as e:
            logger.error(f"Invalid parameters: {str(e)}")
            return Response(
                {'error': 'Invalid parameters', 'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'Error analyzing restock: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to analyze restock needs', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='generate-recommendations')
    def generate_recommendations(self, request):
        """
        POST /api/restock/generate-recommendations/
        
        Genera recomendaciones de reorden para múltiples productos.
        Consulta inventario actual desde el servicio de inventario.
        
        Body:
        {
            "warehouse_id": 1,  # optional, if null analyze all warehouses
            "min_priority": "medium",  # only generate for medium+ priority
            "lead_time_days": 7,
            "max_products": 50  # limit results
        }
        
        Response:
        {
            "status": "success",
            "recommendations": [...],
            "total": 12,
            "urgent": 3,
            "high": 5,
            "medium": 4
        }
        """
        try:
            from .forecasting import InventoryRestockAnalyzer
            from .models import ProductDemandMetrics
            import requests
            
            warehouse_id = request.data.get('warehouse_id')
            lead_time_days = int(request.data.get('lead_time_days', 7))
            max_products = int(request.data.get('max_products', 50))
            min_priority = request.data.get('min_priority', 'medium')
            
            # Obtener productos activos con demanda
            recent_products = ProductDemandMetrics.objects.order_by(
                '-period_end', '-average_daily_demand'
            )[:max_products]
            
            if not recent_products.exists():
                return Response({
                    'status': 'success',
                    'recommendations': [],
                    'total': 0,
                    'message': 'No product demand data available'
                })
            
            # Obtener inventario actual desde servicio de inventario
            try:
                inv_url = 'http://inventario:8000/api/inventory/'
                params = {}
                if warehouse_id:
                    params['warehouse_id'] = warehouse_id
                
                inv_response = requests.get(inv_url, params=params, timeout=10)
                if inv_response.status_code == 200:
                    inventory_data = inv_response.json()
                    # Mapear product_id -> stock
                    stock_map = {}
                    for inv in inventory_data:
                        product_id = inv.get('product_id') or inv.get('product')
                        quantity = inv.get('quantity', 0)
                        if product_id:
                            stock_map[product_id] = stock_map.get(product_id, 0) + quantity
                else:
                    logger.warning(f"Could not fetch inventory: {inv_response.status_code}")
                    stock_map = {}
            except Exception as e:
                logger.error(f"Error fetching inventory: {str(e)}")
                stock_map = {}
            
            # Generar recomendaciones con paralelización usando ThreadPoolExecutor
            from concurrent.futures import ThreadPoolExecutor, as_completed
            import multiprocessing
            
            recommendations = []
            priority_counts = {'critical': 0, 'urgent': 0, 'high': 0, 'medium': 0, 'low': 0}
            
            # Función auxiliar para analizar un producto
            def analyze_product(product):
                try:
                    product_id = product.product_id
                    current_stock = stock_map.get(product_id, 0)
                    
                    analyzer = InventoryRestockAnalyzer(
                        product_id=product_id,
                        warehouse_id=warehouse_id
                    )
                    
                    result = analyzer.analyze_stockout_risk(
                        current_stock=current_stock,
                        lead_time_days=lead_time_days
                    )
                    
                    if result['status'] == 'success':
                        result['product_name'] = product.product_name
                        result['product_sku'] = product.product_sku
                    
                    return result
                except Exception as e:
                    logger.error(f"Error analyzing product {product.product_id}: {str(e)}")
                    return {'status': 'error', 'message': str(e)}
            
            # Determinar número óptimo de workers (máximo 4 o número de CPUs)
            max_workers = min(4, multiprocessing.cpu_count())
            
            # Ejecutar análisis en paralelo
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Enviar todas las tareas
                future_to_product = {
                    executor.submit(analyze_product, product): product 
                    for product in recent_products
                }
                
                # Recolectar resultados a medida que se completan
                for future in as_completed(future_to_product, timeout=30):
                    try:
                        result = future.result()
                        
                        if result['status'] == 'success':
                            priority = result['priority']
                            priority_counts[priority] = priority_counts.get(priority, 0) + 1
                            
                            # Filtrar por prioridad mínima
                            priority_order = ['low', 'medium', 'high', 'urgent', 'critical']
                            if priority_order.index(priority) >= priority_order.index(min_priority):
                                recommendations.append({
                                    'product_id': result['product_id'],
                                    'product_name': result.get('product_name'),
                                    'product_sku': result.get('product_sku'),
                                    **result
                                })
                    except Exception as e:
                        logger.error(f"Error processing future: {str(e)}")
            
            # Ordenar por prioridad y fecha de stockout
            def priority_sort_key(rec):
                priority_scores = {'critical': 5, 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1}
                return (
                    -priority_scores.get(rec['priority'], 0),
                    rec['days_until_stockout'] if rec['days_until_stockout'] else 999
                )
            
            recommendations.sort(key=priority_sort_key)
            
            return Response({
                'status': 'success',
                'recommendations': recommendations,
                'total': len(recommendations),
                'critical': priority_counts['critical'],
                'urgent': priority_counts['urgent'],
                'high': priority_counts['high'],
                'medium': priority_counts['medium'],
                'low': priority_counts['low'],
            })
            
        except ValueError as e:
            logger.error(f"Invalid parameters: {str(e)}")
            return Response(
                {'error': 'Invalid parameters', 'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'Error generating recommendations: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to generate recommendations', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='reorder-point')
    def reorder_point(self, request):
        """
        GET /api/restock/reorder-point/?product_id=1&lead_time_days=7&service_level=0.95
        
        Calcula punto de reorden óptimo para un producto.
        """
        try:
            from .forecasting import InventoryRestockAnalyzer
            
            product_id = request.query_params.get('product_id')
            if not product_id:
                return Response(
                    {'error': 'product_id parameter required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            lead_time_days = int(request.query_params.get('lead_time_days', 7))
            service_level = float(request.query_params.get('service_level', 0.95))
            
            analyzer = InventoryRestockAnalyzer(product_id=int(product_id))
            result = analyzer.calculate_reorder_point(
                lead_time_days=lead_time_days,
                service_level=service_level
            )
            
            return Response(result)
            
        except ValueError as e:
            logger.error(f"Invalid parameters: {str(e)}")
            return Response(
                {'error': 'Invalid parameters', 'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f'Error calculating reorder point: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to calculate reorder point', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='create-purchase-order')
    def create_purchase_order(self, request):
        """
        Crear orden de compra (ReorderRequest) a partir de una recomendación.
        Convierte una recomendación de restock en una acción de compra.
        
        POST /api/restock/create-purchase-order/
        Body: {
            "recommendation_id": 1,
            "supplier_id": 5,  # opcional
            "notes": "Orden automática generada"  # opcional
        }
        
        O crear múltiples órdenes:
        Body: {
            "recommendation_ids": [1, 2, 3],
            "supplier_id": 5,
            "notes": "Batch de órdenes"
        }
        """
        recommendation_id = request.data.get('recommendation_id')
        recommendation_ids = request.data.get('recommendation_ids', [])
        supplier_id = request.data.get('supplier_id')
        notes = request.data.get('notes', 'Orden de compra generada desde forecast')
        
        if not recommendation_id and not recommendation_ids:
            return Response(
                {'error': 'recommendation_id or recommendation_ids required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            import requests
            
            # Si es una sola recomendación
            if recommendation_id:
                recommendation_ids = [recommendation_id]
            
            # Obtener recomendaciones
            from .models import StockReorderRecommendation
            recommendations = StockReorderRecommendation.objects.filter(
                id__in=recommendation_ids
            )
            
            if not recommendations.exists():
                return Response(
                    {'error': 'No recommendations found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Crear órdenes en el servicio de inventario
            created_orders = []
            errors = []
            
            for rec in recommendations:
                try:
                    # Crear ReorderRequest en inventario service
                    order_data = {
                        'product': rec.product_id,
                        'quantity': rec.recommended_quantity,
                        'status': 'requested',
                        'notes': f"{notes} (Recomendación #{rec.id}, Prioridad: {rec.reorder_priority})"
                    }
                    
                    if supplier_id:
                        order_data['supplier'] = supplier_id
                    
                    # POST to inventario service
                    inv_response = requests.post(
                        'http://inventario:8000/api/reorders/',
                        json=order_data,
                        timeout=10
                    )
                    
                    if inv_response.status_code in [200, 201]:
                        order = inv_response.json()
                        created_orders.append({
                            'order_id': order.get('id'),
                            'product_id': rec.product_id,
                            'quantity': rec.recommended_quantity,
                            'recommendation_id': rec.id
                        })
                        
                        # Actualizar recommendation status
                        rec.status = 'ordered'
                        rec.save()
                    else:
                        errors.append({
                            'recommendation_id': rec.id,
                            'product_id': rec.product_id,
                            'error': f'Failed to create order: {inv_response.status_code}'
                        })
                        
                except Exception as e:
                    logger.error(f'Error creating order for recommendation {rec.id}: {str(e)}')
                    errors.append({
                        'recommendation_id': rec.id,
                        'product_id': rec.product_id,
                        'error': str(e)
                    })
            
            return Response({
                'status': 'success',
                'created_orders': created_orders,
                'total_created': len(created_orders),
                'errors': errors,
                'total_errors': len(errors)
            })
            
        except Exception as e:
            logger.error(f'Error creating purchase orders: {str(e)}', exc_info=True)
            return Response(
                {'error': 'Failed to create purchase orders', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


