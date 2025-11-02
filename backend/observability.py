"""
Sistema de Observabilidad y Logging Estructurado
Proporciona logging en formato JSON para mejor análisis y monitoreo
"""
import logging
import json
import traceback
from datetime import datetime
from typing import Any, Dict, Optional
from functools import wraps
import time


class StructuredLogger:
    """
    Logger con formato JSON estructurado.
    
    Beneficios:
    - Fácil parseo y análisis
    - Compatible con herramientas de log aggregation (ELK, Splunk, etc.)
    - Contexto rico con metadata
    """
    
    def __init__(self, name: str, service_name: str = 'rep_drill'):
        """
        Inicializar logger estructurado.
        
        Args:
            name: Nombre del logger (típicamente __name__)
            service_name: Nombre del servicio (auth, analytics, etc.)
        """
        self.logger = logging.getLogger(name)
        self.service_name = service_name
        self.module_name = name
    
    def _build_log_entry(
        self,
        level: str,
        message: str,
        **context: Any
    ) -> Dict[str, Any]:
        """
        Construir entrada de log estructurada.
        
        Args:
            level: Nivel de log (info, warning, error, etc.)
            message: Mensaje principal
            **context: Contexto adicional
            
        Returns:
            Diccionario con estructura de log
        """
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': level.upper(),
            'service': self.service_name,
            'module': self.module_name,
            'message': message,
        }
        
        # Agregar contexto adicional
        if context:
            log_entry['context'] = context
        
        return log_entry
    
    def _log(self, level: str, message: str, **context: Any) -> None:
        """Método interno para logging."""
        log_entry = self._build_log_entry(level, message, **context)
        
        # Convertir a JSON
        log_json = json.dumps(log_entry, default=str)
        
        # Loggear según nivel
        log_level = getattr(logging, level.upper())
        self.logger.log(log_level, log_json)
    
    def debug(self, message: str, **context: Any) -> None:
        """Log nivel DEBUG."""
        self._log('debug', message, **context)
    
    def info(self, message: str, **context: Any) -> None:
        """Log nivel INFO."""
        self._log('info', message, **context)
    
    def warning(self, message: str, **context: Any) -> None:
        """Log nivel WARNING."""
        self._log('warning', message, **context)
    
    def error(
        self,
        message: str,
        exc_info: Optional[Exception] = None,
        **context: Any
    ) -> None:
        """
        Log nivel ERROR con información de excepción opcional.
        
        Args:
            message: Mensaje de error
            exc_info: Excepción capturada (opcional)
            **context: Contexto adicional
        """
        if exc_info:
            context['error_type'] = type(exc_info).__name__
            context['error_message'] = str(exc_info)
            context['traceback'] = traceback.format_exc()
        
        self._log('error', message, **context)
    
    def critical(self, message: str, **context: Any) -> None:
        """Log nivel CRITICAL."""
        self._log('critical', message, **context)


def log_execution_time(logger: StructuredLogger):
    """
    Decorador para medir y loggear tiempo de ejecución.
    
    Args:
        logger: Instancia de StructuredLogger
        
    Usage:
        @log_execution_time(logger)
        def my_function():
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            func_name = func.__name__
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                logger.info(
                    f"Function executed successfully: {func_name}",
                    function=func_name,
                    duration_seconds=round(duration, 3),
                    status='success'
                )
                
                return result
            
            except Exception as e:
                duration = time.time() - start_time
                
                logger.error(
                    f"Function failed: {func_name}",
                    exc_info=e,
                    function=func_name,
                    duration_seconds=round(duration, 3),
                    status='error'
                )
                raise
        
        return wrapper
    return decorator


def log_api_request(logger: StructuredLogger):
    """
    Decorador para loggear requests de API (Django views).
    
    Args:
        logger: Instancia de StructuredLogger
        
    Usage:
        @log_api_request(logger)
        def my_view(request):
            pass
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, request, *args, **kwargs):
            start_time = time.time()
            
            # Información del request
            request_data = {
                'method': request.method,
                'path': request.path,
                'user': str(request.user) if request.user.is_authenticated else 'anonymous',
                'ip': request.META.get('REMOTE_ADDR'),
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:100],
            }
            
            logger.info(
                f"API request received: {request.method} {request.path}",
                **request_data
            )
            
            try:
                response = func(self, request, *args, **kwargs)
                duration = time.time() - start_time
                
                logger.info(
                    f"API request completed: {request.method} {request.path}",
                    **request_data,
                    status_code=response.status_code,
                    duration_seconds=round(duration, 3),
                    status='success'
                )
                
                return response
            
            except Exception as e:
                duration = time.time() - start_time
                
                logger.error(
                    f"API request failed: {request.method} {request.path}",
                    exc_info=e,
                    **request_data,
                    duration_seconds=round(duration, 3),
                    status='error'
                )
                raise
        
        return wrapper
    return decorator


class PerformanceMonitor:
    """
    Monitor de performance para operaciones críticas.
    
    Usage:
        with PerformanceMonitor(logger, 'database_query') as monitor:
            # operación
            monitor.add_context(rows_returned=100)
    """
    
    def __init__(self, logger: StructuredLogger, operation_name: str):
        """
        Args:
            logger: Logger estructurado
            operation_name: Nombre de la operación
        """
        self.logger = logger
        self.operation_name = operation_name
        self.start_time = None
        self.context = {}
    
    def __enter__(self):
        """Iniciar monitoreo."""
        self.start_time = time.time()
        self.logger.debug(
            f"Starting operation: {self.operation_name}",
            operation=self.operation_name
        )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Finalizar monitoreo y loggear."""
        duration = time.time() - self.start_time
        
        if exc_type is None:
            self.logger.info(
                f"Operation completed: {self.operation_name}",
                operation=self.operation_name,
                duration_seconds=round(duration, 3),
                status='success',
                **self.context
            )
        else:
            self.logger.error(
                f"Operation failed: {self.operation_name}",
                operation=self.operation_name,
                duration_seconds=round(duration, 3),
                status='error',
                error_type=exc_type.__name__,
                error_message=str(exc_val),
                **self.context
            )
        
        return False  # No suprimir excepción
    
    def add_context(self, **kwargs):
        """Agregar contexto adicional al log."""
        self.context.update(kwargs)


# Crear instancias por defecto para cada servicio
def get_logger(module_name: str, service_name: str = 'rep_drill') -> StructuredLogger:
    """
    Factory para obtener logger estructurado.
    
    Args:
        module_name: Nombre del módulo (típicamente __name__)
        service_name: Nombre del servicio
        
    Returns:
        Instancia de StructuredLogger
    """
    return StructuredLogger(module_name, service_name)
