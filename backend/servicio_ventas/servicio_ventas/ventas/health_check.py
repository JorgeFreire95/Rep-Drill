"""
Health checks periodicos entre servicios.
Monitorea conectividad y disponibilidad de microservicios.
"""
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from .models import ServiceHealthCheck

logger = logging.getLogger(__name__)


def check_service_health(service_name, service_url, timeout=5):
    """
    Verifica la salud de un servicio específico.
    
    Args:
        service_name: Nombre del servicio ('personas', 'inventario', etc.)
        service_url: URL base del servicio (e.g., 'http://personas:8000')
        timeout: Timeout en segundos
        
    Returns:
        dict con resultado del health check
    """
    from .service_client import RobustServiceClient
    import time
    
    try:
        client = RobustServiceClient(base_url=service_url, service_name=service_name, timeout=timeout)
        start_time = time.time()
        
        # Intentar endpoint de salud o raíz
        endpoints_to_try = [
            '/health/',
            '/api/health/',
            '/api/',
            '/'
        ]
        
        response = None
        for endpoint in endpoints_to_try:
            try:
                response = client.get(endpoint)
                if response:
                    break
            except:
                continue
        
        response_time_ms = int((time.time() - start_time) * 1000)
        
        if response:
            status = 'healthy'
            error_message = None
        else:
            status = 'unhealthy'
            error_message = "No response from service"
        
        # Registrar en base de datos
        health_check, created = ServiceHealthCheck.objects.get_or_create(
            service_name=service_name
        )
        
        if status == 'healthy':
            health_check.consecutive_failures = 0
        else:
            health_check.consecutive_failures += 1
        
        health_check.status = status
        health_check.response_time_ms = response_time_ms
        health_check.error_message = error_message
        health_check.save()
        
        logger.info(
            f"Health check para {service_name}: {status} "
            f"({response_time_ms}ms)"
        )
        
        return {
            'service': service_name,
            'status': status,
            'response_time_ms': response_time_ms,
            'error': error_message
        }
        
    except Exception as e:
        logger.error(
            f"Error verificando salud de {service_name}: {str(e)}"
        )
        
        # Registrar fallo en base de datos
        health_check, created = ServiceHealthCheck.objects.get_or_create(
            service_name=service_name
        )
        health_check.status = 'unhealthy'
        health_check.consecutive_failures += 1
        health_check.error_message = str(e)
        health_check.save()
        
        return {
            'service': service_name,
            'status': 'unhealthy',
            'response_time_ms': 0,
            'error': str(e)
        }


class ServiceHealthCheckTask:
    """Wrapper para usar en Celery tasks."""
    
    SERVICE_CONFIG = {
        'personas': 'http://personas:8000',
        'inventario': 'http://inventario:8000',
        'analytics': 'http://analytics:8000',
        'auth': 'http://auth:8000',
    }
    
    @staticmethod
    def check_all_services():
        """Verifica salud de todos los servicios."""
        results = []
        
        for service_name, service_url in ServiceHealthCheckTask.SERVICE_CONFIG.items():
            try:
                result = check_service_health(service_name, service_url)
                results.append(result)
            except Exception as e:
                logger.error(
                    f"Error en health check de {service_name}: {str(e)}"
                )
                results.append({
                    'service': service_name,
                    'status': 'unknown',
                    'error': str(e)
                })
        
        return results
    
    @staticmethod
    def get_service_status():
        """Obtiene estado actual de todos los servicios."""
        health_checks = ServiceHealthCheck.objects.all()
        
        status_map = {}
        for check in health_checks:
            status_map[check.service_name] = {
                'status': check.status,
                'response_time_ms': check.response_time_ms,
                'last_check': check.last_check,
                'consecutive_failures': check.consecutive_failures,
                'error': check.error_message
            }
        
        return status_map
    
    @staticmethod
    def get_overall_health():
        """
        Obtiene salud general del sistema.
        
        Returns:
            'healthy': todos los servicios funcionando
            'degraded': algunos servicios lentos o con fallos intermitentes
            'unhealthy': servicios críticos no disponibles
        """
        health_checks = ServiceHealthCheck.objects.all()
        
        if not health_checks.exists():
            return 'unknown'
        
        statuses = [check.status for check in health_checks]
        
        if all(s == 'healthy' for s in statuses):
            return 'healthy'
        elif all(s == 'unhealthy' for s in statuses):
            return 'unhealthy'
        else:
            return 'degraded'
