"""
Métricas de Prometheus para Analytics Service
Expone métricas de performance y estado del sistema
"""
from prometheus_client import Counter, Histogram, Gauge, Info
from functools import wraps
import time
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# Contadores
# ============================================================================

forecast_requests_total = Counter(
    'analytics_forecast_requests_total',
    'Total número de solicitudes de forecast',
    ['product_id', 'status']
)

recommendations_generated_total = Counter(
    'analytics_recommendations_generated_total',
    'Total de recomendaciones de restock generadas',
    ['priority']
)

data_quality_checks_total = Counter(
    'analytics_data_quality_checks_total',
    'Total de validaciones de calidad de datos',
    ['result']
)

celery_task_execution_total = Counter(
    'analytics_celery_task_execution_total',
    'Total de ejecuciones de tareas Celery',
    ['task_name', 'status']
)

cache_operations_total = Counter(
    'analytics_cache_operations_total',
    'Total de operaciones de caché',
    ['operation', 'hit']
)

# ============================================================================
# Histogramas (Duración)
# ============================================================================

forecast_duration_seconds = Histogram(
    'analytics_forecast_duration_seconds',
    'Tiempo de generación de forecast',
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0]
)

recommendation_generation_duration_seconds = Histogram(
    'analytics_recommendation_generation_duration_seconds',
    'Tiempo de generación de recomendaciones',
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0]
)

api_request_duration_seconds = Histogram(
    'analytics_api_request_duration_seconds',
    'Duración de requests de API',
    ['endpoint', 'method', 'status'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0]
)

database_query_duration_seconds = Histogram(
    'analytics_database_query_duration_seconds',
    'Duración de queries de base de datos',
    ['query_type'],
    buckets=[0.001, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
)

# ============================================================================
# Gauges (Valores actuales)
# ============================================================================

active_recommendations = Gauge(
    'analytics_active_recommendations',
    'Número de recomendaciones activas',
    ['priority']
)

cached_models_count = Gauge(
    'analytics_cached_models_count',
    'Número de modelos Prophet en caché'
)

daily_sales_total = Gauge(
    'analytics_daily_sales_total',
    'Ventas totales del día actual'
)

products_monitored = Gauge(
    'analytics_products_monitored',
    'Número de productos monitoreados'
)

forecast_accuracy_mape = Gauge(
    'analytics_forecast_accuracy_mape',
    'MAPE promedio de forecasts recientes',
    ['forecast_type']
)

celery_queue_length = Gauge(
    'analytics_celery_queue_length',
    'Longitud de la cola de Celery',
    ['queue_name']
)

# ============================================================================
# Info (Metadata)
# ============================================================================

analytics_info = Info(
    'analytics_service',
    'Información del servicio de Analytics'
)

# Establecer información del servicio
analytics_info.info({
    'version': '1.0.0',
    'prophet_version': '1.1',
    'environment': 'production'
})

# ============================================================================
# Decoradores para instrumentación automática
# ============================================================================

def track_forecast_time(func):
    """
    Decorador para medir tiempo de forecast.
    
    Usage:
        @track_forecast_time
        def forecast_demand(self, ...):
            pass
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        product_id = kwargs.get('product_id', 'total')
        
        with forecast_duration_seconds.time():
            try:
                result = func(*args, **kwargs)
                forecast_requests_total.labels(
                    product_id=product_id,
                    status='success'
                ).inc()
                return result
            except Exception as e:
                forecast_requests_total.labels(
                    product_id=product_id,
                    status='error'
                ).inc()
                raise
    
    return wrapper


def track_api_request(endpoint: str):
    """
    Decorador para medir duración de API requests.
    
    Usage:
        @track_api_request('/api/forecast/')
        def my_view(request):
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            start_time = time.time()
            
            try:
                response = func(request, *args, **kwargs)
                duration = time.time() - start_time
                
                api_request_duration_seconds.labels(
                    endpoint=endpoint,
                    method=request.method,
                    status=response.status_code
                ).observe(duration)
                
                return response
            except Exception as e:
                duration = time.time() - start_time
                api_request_duration_seconds.labels(
                    endpoint=endpoint,
                    method=request.method,
                    status=500
                ).observe(duration)
                raise
        
        return wrapper
    return decorator


def track_celery_task(task_name: str):
    """
    Decorador para medir ejecución de tareas Celery.
    
    Usage:
        @track_celery_task('calculate_metrics')
        def calculate_metrics():
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                celery_task_execution_total.labels(
                    task_name=task_name,
                    status='success'
                ).inc()
                return result
            except Exception as e:
                celery_task_execution_total.labels(
                    task_name=task_name,
                    status='error'
                ).inc()
                raise
        
        return wrapper
    return decorator


# ============================================================================
# Funciones auxiliares para actualizar métricas
# ============================================================================

def update_active_recommendations():
    """Actualizar gauge de recomendaciones activas por prioridad."""
    try:
        from .models import StockReorderRecommendation
        
        for priority in ['urgent', 'high', 'medium', 'low']:
            count = StockReorderRecommendation.objects.filter(
                reorder_priority=priority,
                status='pending'
            ).count()
            
            active_recommendations.labels(priority=priority).set(count)
    
    except Exception as e:
        logger.error(f"Error updating recommendations metric: {e}")


def update_daily_sales():
    """Actualizar gauge de ventas diarias."""
    try:
        from .models import DailySalesMetrics
        from datetime import date
        
        today_metrics = DailySalesMetrics.objects.filter(
            date=date.today()
        ).first()
        
        if today_metrics:
            daily_sales_total.set(float(today_metrics.total_sales))
    
    except Exception as e:
        logger.error(f"Error updating daily sales metric: {e}")


def update_forecast_accuracy():
    """Actualizar gauge de precisión de forecasts."""
    try:
        from .models import ForecastAccuracyHistory
        from datetime import date, timedelta
        
        # Calcular MAPE de los últimos 30 días
        cutoff = date.today() - timedelta(days=30)
        
        for forecast_type in ['sales', 'product_demand']:
            records = ForecastAccuracyHistory.objects.filter(
                forecast_type=forecast_type,
                forecast_date__gte=cutoff,
                actual_value__isnull=False
            )
            
            if records.exists():
                # Calcular MAPE promedio
                total_mape = 0
                count = 0
                
                for record in records:
                    if record.actual_value and record.actual_value != 0:
                        mape = abs(
                            (record.actual_value - record.predicted_value) / 
                            record.actual_value
                        ) * 100
                        total_mape += mape
                        count += 1
                
                if count > 0:
                    avg_mape = total_mape / count
                    forecast_accuracy_mape.labels(
                        forecast_type=forecast_type
                    ).set(avg_mape)
    
    except Exception as e:
        logger.error(f"Error updating forecast accuracy: {e}")


def update_celery_queue_metrics():
    """Actualizar métricas de cola de Celery."""
    try:
        from celery import current_app
        
        inspect = current_app.control.inspect()
        
        # Obtener tasks activos y scheduled
        active = inspect.active()
        scheduled = inspect.scheduled()
        
        if active:
            total_active = sum(len(tasks) for tasks in active.values())
            celery_queue_length.labels(queue_name='active').set(total_active)
        
        if scheduled:
            total_scheduled = sum(len(tasks) for tasks in scheduled.values())
            celery_queue_length.labels(queue_name='scheduled').set(total_scheduled)
    
    except Exception as e:
        logger.error(f"Error updating Celery metrics: {e}")


# ============================================================================
# Tarea periódica para actualizar métricas
# ============================================================================

def update_all_metrics():
    """
    Actualizar todas las métricas de Prometheus.
    Debe ser llamado periódicamente (ej: cada minuto).
    """
    update_active_recommendations()
    update_daily_sales()
    update_forecast_accuracy()
    update_celery_queue_metrics()
    
    logger.debug("Prometheus metrics updated")
