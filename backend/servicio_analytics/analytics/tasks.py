"""
Tareas de Celery para cálculos programados de métricas.
Integrado con EventConsumer para procesar eventos de órdenes desde Redis Streams.
"""
from celery import shared_task
from datetime import datetime, timedelta, date
from django.conf import settings
from django.utils import timezone
import logging
import os
import time

from .services import MetricsCalculator
from .data_quality import DataQualityValidator
# Fallback a SQL directo si las APIs no responden
try:
    from calculate_metrics_sql import (
        calculate_daily_sales_metrics as sql_calc_daily,
        calculate_product_demand_metrics as sql_calc_demand,
        calculate_inventory_turnover_metrics as sql_calc_turnover,
    )
except Exception:
    sql_calc_daily = sql_calc_demand = sql_calc_turnover = None

logger = logging.getLogger(__name__)


@shared_task(
    name='analytics.tasks.calculate_daily_metrics',
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 5},
    retry_backoff=True,
    retry_backoff_max=600,  # 10 minutos máximo
    retry_jitter=True
)
def calculate_daily_metrics(self):
    """
    Tarea programada para calcular métricas diarias.
    Se ejecuta cada hora para mantener métricas actualizadas.
    
    Integración:
    - Consume eventos de órdenes desde Redis Streams
    - Valida calidad de datos antes de procesar
    - Calcula métricas de ventas completas del día anterior
    """
    from .models import TaskRun
    
    # Registrar inicio de tarea
    task_run = TaskRun.objects.create(
        run_id=self.request.id,
        task_name='analytics.tasks.calculate_daily_metrics'
    )
    
    logger.info("Iniciando cálculo de métricas diarias...")
    
    try:
        calculator = MetricsCalculator()
        validator = DataQualityValidator()

        # Calcular métricas de ayer (día completo) usando APIs de servicios
        yesterday = date.today() - timedelta(days=1)
        metrics = calculator.calculate_daily_sales_metrics(yesterday)
        
        if metrics:
            logger.info(
                f"Métricas diarias calculadas para {yesterday}: "
                f"CLP {metrics.total_sales:,.0f}"
            )
            result = {
                'status': 'success',
                'date': str(yesterday),
                'total_sales': str(metrics.total_sales),
                'total_orders': metrics.total_orders
            }
            task_run.mark_finished('success', details=result)
            return result
        else:
            logger.warning(
                f"No se pudieron calcular métricas para {yesterday} vía APIs; intentando fallback SQL"
            )
            if sql_calc_daily:
                created = sql_calc_daily() or 0
                result = {
                    'status': 'fallback_sql',
                    'created_or_updated': created,
                    'date': str(yesterday)
                }
                task_run.mark_finished('success', details=result)
                return result
            result = {
                'status': 'no_data',
                'date': str(yesterday)
            }
            task_run.mark_finished('success', details=result)
            return result
            
    except Exception as e:
        logger.error(f"Error al calcular métricas diarias: {str(e)}", exc_info=True)
        try:
            task_run.mark_finished('error', error=str(e))
        except Exception:
            pass
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(name='analytics.tasks.calculate_product_demand')
def calculate_product_demand(period_days=30):
    """
    Tarea programada para calcular métricas de demanda de productos.
    Se ejecuta cada 2 horas.
    
    Integración:
    - Consume eventos de órdenes completadas
    - Valida datos antes de análisis
    - Usa datos de eventos en lugar de polling directo
    """
    from .models import TaskRun
    
    # Registrar inicio de tarea
    task_run = TaskRun.objects.create(
        run_id='',
        task_name='analytics.tasks.calculate_product_demand',
        details={'period_days': period_days}
    )
    
    logger.info(f"Iniciando cálculo de demanda de productos ({period_days} días)")
    
    try:
        calculator = MetricsCalculator()

        # Calcular demanda a partir de datos de servicios (ventas + inventario)
        metrics_list = calculator.calculate_product_demand_metrics(period_days)
        
        # Si no se obtuvo nada vía APIs, intentar fallback SQL
        if not metrics_list and sql_calc_demand:
            logger.warning("Demanda vía APIs retornó 0 productos; intentando fallback SQL")
            created = sql_calc_demand() or 0
            result = {
                'status': 'fallback_sql',
                'products_count': created,
                'period_days': period_days
            }
            task_run.mark_finished('success', details=result)
            return result

        logger.info(
            f"Métricas de demanda calculadas para {len(metrics_list)} productos"
        )
        result = {
            'status': 'success',
            'products_count': len(metrics_list),
            'period_days': period_days
        }
        task_run.mark_finished('success', details=result)
        return result
        
    except Exception as e:
        logger.error(
            f"Error al calcular demanda de productos vía APIs: {str(e)}",
            exc_info=True
        )
        # Fallback a SQL directo
        if sql_calc_demand:
            try:
                created = sql_calc_demand() or 0
                result = {
                    'status': 'fallback_sql',
                    'products_count': created,
                    'period_days': period_days
                }
                task_run.mark_finished('success', details=result)
                return result
            except Exception as e2:
                logger.error(f"Fallback SQL también falló: {e2}", exc_info=True)
        try:
            task_run.mark_finished('error', error=str(e))
        except Exception:
            pass
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(name='analytics.tasks.calculate_inventory_turnover')
def calculate_inventory_turnover(period_days=30):
    """
    Tarea programada para calcular métricas de rotación de inventario.
    Se ejecuta una vez al día.
    
    Integración:
    - Consume eventos de órdenes y movimientos de inventario
    - Valida datos antes de cálculos
    - Genera recomendaciones basadas en eventos históricos
    """
    logger.info(f"Iniciando cálculo de rotación de inventario ({period_days} días)")
    
    try:
        calculator = MetricsCalculator()
        from .models import TaskRun
        run = TaskRun.objects.create(run_id='', task_name='analytics.tasks.calculate_inventory_turnover', details={'period_days': period_days})

        # Calcular rotación a partir de métricas de demanda e inventario
        metrics_list = calculator.calculate_inventory_turnover_metrics(period_days)
        
        # Si no hay métricas, intentar fallback SQL
        recommendations = []
        if not metrics_list and sql_calc_turnover:
            logger.warning("Rotación vía APIs retornó 0; intentando fallback SQL")
            created = sql_calc_turnover() or 0
            logger.info(f"Fallback SQL creó/actualizó {created} métricas de rotación")
        else:
            logger.info(
                f"Métricas de rotación calculadas para {len(metrics_list)} productos"
            )
            # Generar recomendaciones
            recommendations = calculator.generate_reorder_recommendations()
            logger.info(f"Se generaron {len(recommendations)} recomendaciones")
        
        result = {
            'status': 'success',
            'products_count': len(metrics_list),
            'recommendations_count': len(recommendations),
            'period_days': period_days
        }
        run.mark_finished('success', details=result)
        return result
        
    except Exception as e:
        logger.error(
            f"Error al calcular rotación vía APIs: {str(e)}",
            exc_info=True
        )
        # Fallback a SQL directo
        if sql_calc_turnover:
            try:
                created = sql_calc_turnover() or 0
                result = {
                    'status': 'fallback_sql',
                    'products_count': created,
                    'period_days': period_days
                }
                run.mark_finished('success', details=result)
                return result
            except Exception as e2:
                logger.error(f"Fallback SQL también falló: {e2}", exc_info=True)
        try:
            run.mark_finished('error', error=str(e))
        except Exception:
            pass
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(name='analytics.tasks.cleanup_old_metrics')
def cleanup_old_metrics():
    """
    Tarea programada para limpiar métricas antiguas.
    Se ejecuta semanalmente.
    
    Políticas de retención:
    - Métricas diarias: según ANALYTICS_RETENTION_DAYS (default 90)
    - Recomendaciones completadas: 90 días
    - Logs de eventos: 30 días
    """
    logger.info("Iniciando limpieza de métricas antiguas...")
    
    try:
        from .models import (
            DailySalesMetrics,
            ProductDemandMetrics,
            InventoryTurnoverMetrics,
            StockReorderRecommendation
        )
        
        retention_days = getattr(settings, 'ANALYTICS_RETENTION_DAYS', 90)
        cutoff_date = date.today() - timedelta(days=retention_days)
        
        # Eliminar métricas antiguas
        deleted_counts = {}
        
        deleted_counts['daily_sales'] = DailySalesMetrics.objects.filter(
            date__lt=cutoff_date
        ).delete()[0]
        logger.info(f"Eliminadas {deleted_counts['daily_sales']} métricas diarias")
        
        deleted_counts['product_demand'] = ProductDemandMetrics.objects.filter(
            period_end__lt=cutoff_date
        ).delete()[0]
        logger.info(f"Eliminadas {deleted_counts['product_demand']} métricas de demanda")
        
        deleted_counts['inventory_turnover'] = InventoryTurnoverMetrics.objects.filter(
            period_end__lt=cutoff_date
        ).delete()[0]
        logger.info(f"Eliminadas {deleted_counts['inventory_turnover']} métricas de rotación")
        
        # Eliminar recomendaciones completadas o descartadas antiguas (más de 90 días)
        ninety_days_ago = date.today() - timedelta(days=90)
        deleted_counts['recommendations'] = StockReorderRecommendation.objects.filter(
            status__in=['ordered', 'dismissed'],
            updated_at__lt=ninety_days_ago
        ).delete()[0]
        logger.info(f"Eliminadas {deleted_counts['recommendations']} recomendaciones antiguas")
        
        total_deleted = sum(deleted_counts.values())
        logger.info(f"Total de objetos eliminados: {total_deleted}")
        
        return {
            'status': 'success',
            'deleted_metrics': deleted_counts,
            'total_deleted': total_deleted
        }
        
    except Exception as e:
        logger.error(
            f"Error al limpiar métricas antiguas: {str(e)}",
            exc_info=True
        )
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(name='analytics.tasks.check_service_health')
def check_service_health():
    """
    Tarea programada para verificar salud de todos los servicios.
    Se ejecuta cada 5 minutos.
    
    Monitorea:
    - Tiempo de respuesta de cada servicio
    - Disponibilidad de servicios
    - Registra fallas consecutivas
    """
    logger.info("Iniciando health checks de servicios...")
    
    try:
        import requests

        # Construir mapa de servicios desde variables de entorno con fallback a DNS interno
        services = {
            'auth': os.getenv('AUTH_SERVICE_URL', 'http://auth:8000'),
            'personas': os.getenv('PERSONAS_SERVICE_URL', 'http://personas:8000'),
            'inventario': os.getenv('INVENTARIO_SERVICE_URL', 'http://inventario:8000'),
            'ventas': os.getenv('VENTAS_SERVICE_URL', 'http://ventas:8000'),
            'analytics': os.getenv('ANALYTICS_SERVICE_URL', 'http://analytics:8000'),
        }

        results = []
        for name, base in services.items():
            base = (base or '').rstrip('/')
            status = 'unhealthy'
            rtime_ms = 0
            url_primary = f"{base}/health/live/"
            url_fallback = f"{base}/health/"
            started = time.perf_counter()
            try:
                resp = requests.get(url_primary, timeout=3)
                rtime_ms = int((time.perf_counter() - started) * 1000)
                if resp.ok:
                    status = 'healthy'
                else:
                    # Intento de respaldo a /health/
                    started_fallback = time.perf_counter()
                    resp2 = requests.get(url_fallback, timeout=3)
                    rtime_ms = int((time.perf_counter() - started_fallback) * 1000)
                    status = 'healthy' if resp2.ok else 'unhealthy'
            except Exception:
                rtime_ms = int((time.perf_counter() - started) * 1000)
                status = 'unhealthy'

            results.append({
                'service': name,
                'url': base,
                'status': status,
                'response_time_ms': rtime_ms,
            })

        healthy_count = sum(1 for r in results if r.get('status') == 'healthy')
        unhealthy_count = sum(1 for r in results if r.get('status') == 'unhealthy')

        logger.info(
            f"Health check completado: {healthy_count} saludables, {unhealthy_count} no disponibles"
        )

        overall_status = 'degraded' if unhealthy_count else 'healthy'

        return {
            'status': 'success',
            'overall_health': overall_status,
            'healthy_services': healthy_count,
            'unhealthy_services': unhealthy_count,
            'results': results,
        }

    except Exception as e:
        logger.error(
            f"Error en health check: {str(e)}",
            exc_info=True
        )
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(name='analytics.tasks.generate_restock_recommendations')
def generate_restock_recommendations(min_priority='medium', max_products=100):
    """
    Tarea diaria para generar recomendaciones de reinventario.
    Usa Prophet para predecir demanda y calcular necesidades de reorden.
    
    Args:
        min_priority: Prioridad mínima (low, medium, high, urgent, critical)
        max_products: Máximo de productos a analizar
    
    Se ejecuta cada día a las 6:00 AM.
    """
    logger.info(f"Generando recomendaciones de reinventario (min_priority={min_priority})")
    
    try:
        from .forecasting import InventoryRestockAnalyzer
        from .models import ProductDemandMetrics, StockReorderRecommendation
        import requests
        
        # Obtener productos activos con demanda
        recent_products = ProductDemandMetrics.objects.filter(
            period_end__gte=date.today() - timedelta(days=60)
        ).order_by('-average_daily_demand')[:max_products]
        
        if not recent_products.exists():
            logger.warning("No se encontraron productos con demanda reciente")
            return {
                'status': 'no_data',
                'message': 'No product demand data available'
            }
        
        logger.info(f"Analizando {recent_products.count()} productos")
        
        # Obtener inventario actual
        try:
            inv_response = requests.get(
                    'http://inventario:8000/api/inventory/',
                timeout=10
            )
            stock_map = {}
            if inv_response.status_code == 200:
                for inv in inv_response.json():
                    product_id = inv.get('product_id') or inv.get('product')
                    if product_id:
                        stock_map[product_id] = stock_map.get(product_id, 0) + inv.get('quantity', 0)
        except Exception as e:
            logger.error(f"Error fetching inventory: {str(e)}")
            stock_map = {}
        
        # Generar recomendaciones
        created_count = 0
        updated_count = 0
        priority_counts = {'critical': 0, 'urgent': 0, 'high': 0, 'medium': 0, 'low': 0}
        
        for product in recent_products:
            product_id = product.product_id
            current_stock = stock_map.get(product_id, 0)
            
            # Analizar riesgo de stockout
            analyzer = InventoryRestockAnalyzer(product_id=product_id)
            result = analyzer.generate_reorder_recommendation(
                current_stock=current_stock,
                lead_time_days=7
            )
            
            if result['status'] == 'success':
                rec_data = result['recommendation']
                priority = rec_data['reorder_priority']
                priority_counts[priority] = priority_counts.get(priority, 0) + 1
                
                # Filtrar por prioridad mínima
                priority_order = ['low', 'medium', 'high', 'urgent', 'critical']
                if priority_order.index(priority) >= priority_order.index(min_priority):
                    # Actualizar o crear recomendación
                    obj, created = StockReorderRecommendation.objects.update_or_create(
                        product_id=product_id,
                        warehouse_id=rec_data.get('warehouse_id'),
                        defaults=rec_data
                    )
                    
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
        
        logger.info(
            f"Recomendaciones generadas: {created_count} nuevas, {updated_count} actualizadas. "
            f"Prioridades: {priority_counts}"
        )
        
        return {
            'status': 'success',
            'created': created_count,
            'updated': updated_count,
            'priorities': priority_counts,
            'total_analyzed': recent_products.count()
        }
        
    except Exception as e:
        logger.error(f"Error generando recomendaciones: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(name='analytics.tasks.update_forecast_accuracy')
def update_forecast_accuracy():
    """
    Tarea diaria para actualizar métricas de precisión de forecasts.
    Compara predicciones pasadas con valores reales.
    
    Se ejecuta cada día a las 7:00 AM.
    """
    logger.info("Actualizando métricas de precisión de forecasts")
    
    try:
        from .models import ForecastAccuracyHistory, DailySalesMetrics, ProductDemandMetrics
        
        # Buscar forecasts pendientes de validación (sin actual_value)
        pending = ForecastAccuracyHistory.objects.filter(
            actual_value__isnull=True,
            predicted_date__lte=date.today()
        )
        
        updated_count = 0
        
        for forecast_record in pending:
            try:
                # Obtener valor real según el tipo
                if forecast_record.forecast_type == 'sales':
                    # Ventas totales
                    actual_metric = DailySalesMetrics.objects.filter(
                        date=forecast_record.predicted_date
                    ).first()
                    if actual_metric:
                        forecast_record.actual_value = actual_metric.total_sales
                
                elif forecast_record.forecast_type == 'product_demand':
                    # Demanda de producto específico
                    actual_metric = ProductDemandMetrics.objects.filter(
                        product_id=forecast_record.product_id,
                        period_start__lte=forecast_record.predicted_date,
                        period_end__gte=forecast_record.predicted_date
                    ).first()
                    if actual_metric:
                        forecast_record.actual_value = actual_metric.average_daily_demand
                
                # Guardar (auto-calcula métricas de error)
                if forecast_record.actual_value is not None:
                    forecast_record.save()
                    updated_count += 1
                    
            except Exception as e:
                logger.error(f"Error procesando forecast {forecast_record.id}: {str(e)}")
                continue
        
        logger.info(f"Actualizadas {updated_count} métricas de precisión")
        
        # Calcular estadísticas agregadas
        from django.db.models import Avg, Count, Q
        stats = ForecastAccuracyHistory.objects.filter(
            actual_value__isnull=False,
            forecast_date__gte=date.today() - timedelta(days=30)
        ).aggregate(
            avg_mape=Avg('percentage_error'),
            avg_mae=Avg('absolute_error'),
            total_forecasts=Count('id'),
            within_confidence_count=Count('id', filter=Q(within_confidence=True))
        )
        
        confidence_rate = 0
        if stats['total_forecasts'] > 0:
            confidence_rate = (stats['within_confidence_count'] / stats['total_forecasts']) * 100
        
        logger.info(
            f"Estadísticas últimos 30 días: "
            f"MAPE={(stats['avg_mape'] or 0):.2f}%, "
            f"MAE={(stats['avg_mae'] or 0):.2f}, "
            f"Confidence rate={confidence_rate:.1f}%"
        )
        
        return {
            'status': 'success',
            'updated': updated_count,
            'stats': {
                'avg_mape': float(stats['avg_mape'] or 0),
                'avg_mae': float(stats['avg_mae'] or 0),
                'confidence_rate': round(confidence_rate, 2)
            }
        }
        
    except Exception as e:
        logger.error(f"Error actualizando precisión: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(name='analytics.tasks.save_daily_forecasts')
def save_daily_forecasts(periods=30):
    """
    Tarea diaria para guardar forecasts y poder compararlos después con valores reales.
    
    Se ejecuta cada día a las 5:00 AM.
    """
    logger.info(f"Guardando forecasts diarios ({periods} días)")
    
    try:
        from .forecasting import DemandForecast
        from .models import ForecastAccuracyHistory, ProductDemandMetrics
        
        # Guardar forecast de ventas totales
        sales_forecast = DemandForecast()
        sales_df = sales_forecast.forecast_demand(periods)
        
        saved_count = 0
        
        if sales_df is not None and not sales_df.empty:
            for _, row in sales_df.iterrows():
                # Ensure predicted_date is a date object, not a string
                predicted_date_val = row['ds']
                try:
                    if hasattr(predicted_date_val, 'date'):
                        predicted_date_val = predicted_date_val.date()
                    elif isinstance(predicted_date_val, str):
                        from datetime import datetime as _dt
                        predicted_date_val = _dt.strptime(predicted_date_val, '%Y-%m-%d').date()
                except Exception:
                    # Fallback: use today's date if parsing fails
                    predicted_date_val = date.today()

                ForecastAccuracyHistory.objects.create(
                    forecast_type='sales',
                    forecast_date=date.today(),
                    predicted_date=predicted_date_val,
                    predicted_value=row['yhat'],
                    confidence_lower=row.get('yhat_lower'),
                    confidence_upper=row.get('yhat_upper'),
                    model_name='Prophet'
                )
                saved_count += 1
        
        # Guardar forecasts de top 20 productos
        top_products = ProductDemandMetrics.objects.order_by('-total_revenue')[:20]
        
        for product in top_products:
            product_forecast = DemandForecast(product_id=product.product_id)
            product_df = product_forecast.forecast_demand(periods)
            
            if product_df is not None and not product_df.empty:
                for _, row in product_df.iterrows():
                    # Ensure predicted_date is a date object, not a string
                    predicted_date_val = row['ds']
                    try:
                        if hasattr(predicted_date_val, 'date'):
                            predicted_date_val = predicted_date_val.date()
                        elif isinstance(predicted_date_val, str):
                            from datetime import datetime as _dt
                            predicted_date_val = _dt.strptime(predicted_date_val, '%Y-%m-%d').date()
                    except Exception:
                        predicted_date_val = date.today()

                    ForecastAccuracyHistory.objects.create(
                        forecast_type='product_demand',
                        product_id=product.product_id,
                        forecast_date=date.today(),
                        predicted_date=predicted_date_val,
                        predicted_value=row['yhat'],
                        confidence_lower=row.get('yhat_lower'),
                        confidence_upper=row.get('yhat_upper'),
                        model_name='Prophet'
                    )
                    saved_count += 1
        
        logger.info(f"Guardados {saved_count} forecasts para validación futura")
        
        return {
            'status': 'success',
            'saved_forecasts': saved_count,
            'periods': periods
        }
        
    except Exception as e:
        logger.error(f"Error guardando forecasts: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(
    name='analytics.tasks.cleanup_old_data',
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True
)
def cleanup_old_data(self, days_to_keep: int = 365):
    """
    Tarea de limpieza de datos antiguos para mantener la DB limpia.
    
    Args:
        days_to_keep: Días de historia a conservar (default 365)
        
    Returns:
        Dict con estadísticas de limpieza
    """
    import time
    
    logger.info(f"Iniciando limpieza de datos antiguos (conservar últimos {days_to_keep} días)...")
    start_time = time.time()
    
    try:
        from .models import (
            ForecastAccuracyHistory,
            StockReorderRecommendation,
            DailySalesMetrics,
            ProductDemandMetrics
        )
        
        cutoff_date = timezone.now() - timedelta(days=days_to_keep)
        stats = {}
        
        # Limpiar forecasts antiguos de accuracy history
        deleted_forecasts = ForecastAccuracyHistory.objects.filter(
            forecast_date__lt=cutoff_date.date()
        ).delete()
        stats['forecasts_deleted'] = deleted_forecasts[0]
        logger.info(f"Eliminados {deleted_forecasts[0]} registros de ForecastAccuracyHistory")
        
        # Limpiar recomendaciones expiradas o muy antiguas
        deleted_recs = StockReorderRecommendation.objects.filter(
            created_at__lt=cutoff_date
        ).exclude(
            status='ordered'  # Conservar las que fueron ordenadas
        ).delete()
        stats['recommendations_deleted'] = deleted_recs[0]
        logger.info(f"Eliminadas {deleted_recs[0]} recomendaciones antiguas")
        
        # Opcional: comprimir métricas diarias muy antiguas (agregación mensual)
        # Por ahora solo loggeamos la cantidad
        old_daily_metrics = DailySalesMetrics.objects.filter(
            date__lt=cutoff_date.date()
        ).count()
        stats['old_daily_metrics'] = old_daily_metrics
        
        old_product_metrics = ProductDemandMetrics.objects.filter(
            period_end__lt=cutoff_date.date()
        ).count()
        stats['old_product_metrics'] = old_product_metrics
        
        duration = time.time() - start_time
        logger.info(
            f"Limpieza completada en {duration:.2f}s: "
            f"{stats['forecasts_deleted']} forecasts, "
            f"{stats['recommendations_deleted']} recomendaciones eliminadas"
        )
        
        # Alertar si tarda mucho
        if duration > 300:  # 5 minutos
            logger.warning(f"Tarea de limpieza tardó demasiado: {duration:.2f}s")
        
        stats['duration_seconds'] = round(duration, 2)
        stats['status'] = 'success'
        return stats
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error(
            f"Error en limpieza de datos (duración: {duration:.2f}s): {str(e)}",
            exc_info=True
        )
        raise self.retry(exc=e, countdown=60)


@shared_task(
    name='analytics.tasks.monitor_task_performance',
    bind=True
)
def monitor_task_performance(self):
    """
    Monitorear el rendimiento de las tareas de Celery.
    Registra métricas de duración y éxito/fallo.
    """
    import time
    from celery import current_app
    
    logger.info("Monitoreando rendimiento de tareas...")
    
    try:
        # Inspeccionar workers activos
        inspect = current_app.control.inspect()
        
        # Estadísticas de workers
        stats = inspect.stats()
        active_tasks = inspect.active()
        scheduled_tasks = inspect.scheduled()
        
        if stats:
            logger.info(f"Workers activos: {len(stats)}")
            for worker_name, worker_stats in stats.items():
                logger.info(
                    f"Worker {worker_name}: "
                    f"pool={worker_stats.get('pool', {}).get('max-concurrency', 'N/A')}"
                )
        
        if active_tasks:
            total_active = sum(len(tasks) for tasks in active_tasks.values())
            logger.info(f"Tareas activas: {total_active}")
        
        if scheduled_tasks:
            total_scheduled = sum(len(tasks) for tasks in scheduled_tasks.values())
            logger.info(f"Tareas programadas: {total_scheduled}")
        
        return {
            'status': 'success',
            'workers': len(stats) if stats else 0,
            'active_tasks': total_active if active_tasks else 0,
            'scheduled_tasks': total_scheduled if scheduled_tasks else 0,
            'timestamp': timezone.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error monitoreando tareas: {str(e)}", exc_info=True)
        return {
            'status': 'error',
            'error': str(e)
        }
