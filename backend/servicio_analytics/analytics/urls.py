"""
URLs para la aplicación analytics.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DailySalesMetricsViewSet,
    ProductDemandMetricsViewSet,
    InventoryTurnoverMetricsViewSet,
    StockReorderRecommendationViewSet,
    AnalyticsActionsViewSet,
    CeleryMonitorViewSet,
    CacheViewSet,
    ProphetForecastViewSet,
    DashboardMetricsViewSet,
    ReportsViewSet,
    RestockForecastViewSet,
    TaskRunViewSet,
    task_runs_page,
)
from .events import EventStreamView

router = DefaultRouter()
router.register(r'daily-sales', DailySalesMetricsViewSet, basename='daily-sales-metrics')
router.register(r'product-demand', ProductDemandMetricsViewSet, basename='product-demand-metrics')
router.register(r'inventory-turnover', InventoryTurnoverMetricsViewSet, basename='inventory-turnover-metrics')
router.register(r'reorder-recommendations', StockReorderRecommendationViewSet, basename='reorder-recommendations')
router.register(r'actions', AnalyticsActionsViewSet, basename='analytics-actions')
router.register(r'celery', CeleryMonitorViewSet, basename='celery-monitor')
router.register(r'cache', CacheViewSet, basename='cache-manager')
router.register(r'prophet', ProphetForecastViewSet, basename='prophet-forecast')
router.register(r'restock', RestockForecastViewSet, basename='restock-forecast')
router.register(r'dashboard', DashboardMetricsViewSet, basename='dashboard-metrics')
router.register(r'reports', ReportsViewSet, basename='reports')
router.register(r'task-runs', TaskRunViewSet, basename='task-runs')
from .views import ForecastAccuracyProductViewSet, ForecastAccuracyCategoryViewSet
router.register(r'forecast-accuracy/products', ForecastAccuracyProductViewSet, basename='forecast-accuracy-product')
router.register(r'forecast-accuracy/categories', ForecastAccuracyCategoryViewSet, basename='forecast-accuracy-category')

urlpatterns = [
    path('', include(router.urls)),
    path('events/stream/', EventStreamView.as_view(), name='event-stream'),
    path('tasks/runs/', task_runs_page, name='task-runs-page'),
]

# Agregar endpoints de monitoreo si están habilitados
from django.conf import settings

if getattr(settings, 'PROMETHEUS_ENABLED', True):
    from django.http import HttpResponse
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from .prometheus_metrics import update_all_metrics
    
    def metrics_view(request):
        """Endpoint de métricas de Prometheus."""
        # Actualizar métricas antes de exponerlas
        update_all_metrics()
        
        # Generar y devolver métricas
        metrics = generate_latest()
        return HttpResponse(metrics, content_type=CONTENT_TYPE_LATEST)
    
    urlpatterns += [
        path('metrics/', metrics_view, name='prometheus-metrics'),
    ]
