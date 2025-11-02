"""
Health Check System para servicios de Rep Drill
Proporciona endpoints de salud para monitoreo y orquestación
"""
from django.http import JsonResponse
from django.utils import timezone
from django.db import connection
from django.core.cache import cache
import os
import shutil
from typing import Dict, Any


def check_database() -> Dict[str, Any]:
    """
    Verificar conectividad y salud de la base de datos.
    
    Returns:
        Dict con status y detalles
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            result = cursor.fetchone()
            
            if result and result[0] == 1:
                # Verificar latencia
                import time
                start = time.time()
                cursor.execute('SELECT COUNT(*) FROM django_migrations')
                latency = (time.time() - start) * 1000
                
                return {
                    'status': 'healthy',
                    'latency_ms': round(latency, 2),
                    'message': 'Database connection OK'
                }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e),
            'message': 'Database connection failed'
        }


def check_redis() -> Dict[str, Any]:
    """
    Verificar conectividad con Redis.
    
    Returns:
        Dict con status y detalles
    """
    try:
        # Test básico de set/get
        test_key = 'health_check_test'
        test_value = 'ok'
        
        cache.set(test_key, test_value, timeout=10)
        result = cache.get(test_key)
        
        if result == test_value:
            cache.delete(test_key)
            return {
                'status': 'healthy',
                'message': 'Redis connection OK'
            }
        else:
            return {
                'status': 'unhealthy',
                'message': 'Redis read/write test failed'
            }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e),
            'message': 'Redis connection failed'
        }


def check_celery() -> Dict[str, Any]:
    """
    Verificar estado de workers de Celery.
    
    Returns:
        Dict con status y detalles
    """
    try:
        from celery import current_app
        
        # Inspeccionar workers activos
        inspect = current_app.control.inspect()
        stats = inspect.stats()
        
        if stats:
            active_workers = list(stats.keys())
            return {
                'status': 'healthy',
                'active_workers': len(active_workers),
                'workers': active_workers,
                'message': f'{len(active_workers)} Celery worker(s) active'
            }
        else:
            return {
                'status': 'unhealthy',
                'message': 'No Celery workers found'
            }
    except ImportError:
        return {
            'status': 'not_configured',
            'message': 'Celery not configured for this service'
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e),
            'message': 'Celery check failed'
        }


def check_disk_space(threshold_percent: float = 90.0) -> Dict[str, Any]:
    """
    Verificar espacio en disco disponible.
    
    Args:
        threshold_percent: Umbral de alerta (%)
        
    Returns:
        Dict con status y detalles
    """
    try:
        # Obtener uso de disco
        total, used, free = shutil.disk_usage('/')
        
        used_percent = (used / total) * 100
        free_gb = free / (1024 ** 3)
        
        status = 'healthy' if used_percent < threshold_percent else 'warning'
        
        return {
            'status': status,
            'used_percent': round(used_percent, 2),
            'free_gb': round(free_gb, 2),
            'message': f'{round(used_percent, 1)}% disk used, {round(free_gb, 1)}GB free'
        }
    except Exception as e:
        return {
            'status': 'unknown',
            'error': str(e),
            'message': 'Disk space check failed'
        }


def check_memory() -> Dict[str, Any]:
    """
    Verificar uso de memoria (si psutil está disponible).
    
    Returns:
        Dict con status y detalles
    """
    try:
        import psutil
        
        memory = psutil.virtual_memory()
        used_percent = memory.percent
        available_gb = memory.available / (1024 ** 3)
        
        status = 'healthy' if used_percent < 90 else 'warning'
        
        return {
            'status': status,
            'used_percent': round(used_percent, 2),
            'available_gb': round(available_gb, 2),
            'message': f'{round(used_percent, 1)}% memory used'
        }
    except ImportError:
        return {
            'status': 'not_available',
            'message': 'psutil not installed'
        }
    except Exception as e:
        return {
            'status': 'unknown',
            'error': str(e),
            'message': 'Memory check failed'
        }


def health_check(request):
    """
    Endpoint principal de health check.
    
    Verifica:
    - Base de datos
    - Redis/Cache
    - Celery (si aplica)
    - Espacio en disco
    - Memoria (si psutil disponible)
    
    Returns:
        JsonResponse con estado de salud
    """
    checks = {
        'database': check_database(),
        'redis': check_redis(),
        'celery': check_celery(),
        'disk': check_disk_space(),
        'memory': check_memory(),
    }
    
    # Determinar estado general
    critical_checks = ['database', 'redis']
    all_critical_healthy = all(
        checks[check]['status'] == 'healthy'
        for check in critical_checks
        if checks[check]['status'] not in ['not_configured', 'not_available']
    )
    
    has_warnings = any(
        check['status'] == 'warning' for check in checks.values()
    )
    
    if all_critical_healthy and not has_warnings:
        overall_status = 'healthy'
        status_code = 200
    elif all_critical_healthy and has_warnings:
        overall_status = 'degraded'
        status_code = 200
    else:
        overall_status = 'unhealthy'
        status_code = 503
    
    response_data = {
        'status': overall_status,
        'timestamp': timezone.now().isoformat(),
        'service': os.getenv('SERVICE_NAME', 'unknown'),
        'checks': checks,
        'version': os.getenv('APP_VERSION', '1.0.0')
    }
    
    return JsonResponse(response_data, status=status_code)


def liveness_check(request):
    """
    Liveness probe (básico - servicio está vivo).
    
    Usado por Kubernetes/Docker para reiniciar contenedores muertos.
    
    Returns:
        JsonResponse simple
    """
    return JsonResponse({
        'status': 'alive',
        'timestamp': timezone.now().isoformat()
    })


def readiness_check(request):
    """
    Readiness probe (servicio listo para recibir tráfico).
    
    Usado por Kubernetes/Docker para enrutamiento de tráfico.
    
    Returns:
        JsonResponse con estado de readiness
    """
    # Solo verificar componentes críticos
    db_status = check_database()
    redis_status = check_redis()
    
    is_ready = (
        db_status['status'] == 'healthy' and
        redis_status['status'] == 'healthy'
    )
    
    status_code = 200 if is_ready else 503
    
    return JsonResponse({
        'status': 'ready' if is_ready else 'not_ready',
        'timestamp': timezone.now().isoformat(),
        'checks': {
            'database': db_status,
            'redis': redis_status
        }
    }, status=status_code)
