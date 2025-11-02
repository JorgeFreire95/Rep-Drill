"""
Cliente HTTP robusto para llamadas entre microservicios.
Implementa reintentos, backoff exponencial, manejo de errores y logging.
"""

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging
from typing import Optional, Dict, Any
from functools import wraps
import time

logger = logging.getLogger(__name__)


class ServiceException(Exception):
    """Excepción base para errores de servicios"""
    pass


class ServiceUnavailableException(ServiceException):
    """Servicio no disponible"""
    pass


class ServiceTimeoutException(ServiceException):
    """Timeout al conectar a servicio"""
    pass


class ServiceValidationException(ServiceException):
    """Error de validación en respuesta"""
    pass


def retry_on_exception(max_retries=3, backoff_factor=1):
    """Decorador para reintentos con backoff exponencial"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (ServiceTimeoutException, ServiceUnavailableException) as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        wait_time = backoff_factor * (2 ** attempt)
                        logger.warning(
                            f"Reintento {attempt + 1}/{max_retries} "
                            f"en {wait_time}s. Error: {e}"
                        )
                        time.sleep(wait_time)
                    else:
                        logger.error(
                            f"Falló después de {max_retries} intentos"
                        )
            
            raise last_exception
        return wrapper
    return decorator


class RobustServiceClient:
    """
    Cliente HTTP robusto para llamadas entre microservicios.
    
    Características:
    - Reintentos automáticos con backoff exponencial
    - Timeout configurable
    - Logging detallado
    - Manejo de errores específicos
    - Session reutilizable para eficiencia
    """
    
    def __init__(
        self,
        base_url: str,
        service_name: str,
        timeout: int = 5,
        max_retries: int = 3,
        backoff_factor: float = 1.0
    ):
        """
        Inicializar cliente de servicio.
        
        Args:
            base_url: URL base del servicio (ej: http://personas:8000)
            service_name: Nombre del servicio para logging
            timeout: Timeout en segundos
            max_retries: Número máximo de reintentos
            backoff_factor: Factor de backoff exponencial
        """
        self.base_url = base_url.rstrip('/')
        self.service_name = service_name
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """
        Crear sesión HTTP con reintentos configurados.
        
        Returns:
            requests.Session configurada
        """
        session = requests.Session()
        
        # Configurar estrategia de reintentos
        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=self.backoff_factor,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST", "PUT", "DELETE"]
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def _build_url(self, endpoint: str) -> str:
        """Construir URL completa."""
        if not endpoint.startswith('/'):
            endpoint = '/' + endpoint
        return f"{self.base_url}{endpoint}"
    
    def _log_request(
        self,
        method: str,
        url: str,
        status_code: Optional[int] = None,
        duration: float = 0
    ):
        """Log de request/response."""
        if status_code:
            logger.info(
                f"[{self.service_name}] {method} {url} "
                f"→ {status_code} ({duration:.2f}s)"
            )
        else:
            logger.info(f"[{self.service_name}] {method} {url}")
    
    def get(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        GET request a microservicio.
        
        Args:
            endpoint: Endpoint del servicio
            params: Query parameters
            **kwargs: Argumentos adicionales para requests
        
        Returns:
            Response JSON parseado
        
        Raises:
            ServiceTimeoutException: Timeout
            ServiceUnavailableException: Servicio no disponible
            ServiceException: Error general
        """
        url = self._build_url(endpoint)
        start_time = time.time()
        
        try:
            logger.debug(f"GET {url} con params {params}")
            
            response = self.session.get(
                url,
                params=params,
                timeout=self.timeout,
                **kwargs
            )
            
            duration = time.time() - start_time
            self._log_request("GET", url, response.status_code, duration)
            
            # Verificar status
            if response.status_code == 404:
                logger.warning(f"Recurso no encontrado: {url}")
                return None
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout calling {self.service_name}: {url}")
            raise ServiceTimeoutException(
                f"Timeout en {self.service_name} después de {self.timeout}s"
            ) from e
        
        except requests.exceptions.ConnectionError as e:
            logger.error(
                f"Conexión rechazada a {self.service_name}: {url}. Error: {e}"
            )
            raise ServiceUnavailableException(
                f"{self.service_name} no disponible"
            ) from e
        
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error en {self.service_name}: {e}")
            raise ServiceException(
                f"Error HTTP en {self.service_name}: {e.response.status_code}"
            ) from e
        
        except Exception as e:
            logger.error(f"Error inesperado en {self.service_name}: {e}")
            raise ServiceException(
                f"Error en {self.service_name}: {str(e)}"
            ) from e
    
    def post(
        self,
        endpoint: str,
        data: Optional[Dict] = None,
        json: Optional[Dict] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        POST request a microservicio.
        
        Args:
            endpoint: Endpoint del servicio
            data: Form data
            json: JSON payload
            **kwargs: Argumentos adicionales
        
        Returns:
            Response JSON parseado
        
        Raises:
            ServiceException: Errores de conexión/respuesta
        """
        url = self._build_url(endpoint)
        start_time = time.time()
        
        try:
            logger.debug(f"POST {url} con data {data or json}")
            
            response = self.session.post(
                url,
                data=data,
                json=json,
                timeout=self.timeout,
                **kwargs
            )
            
            duration = time.time() - start_time
            self._log_request("POST", url, response.status_code, duration)
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.Timeout:
            logger.error(f"Timeout en POST {url}")
            raise ServiceTimeoutException(
                f"Timeout en {self.service_name}"
            )
        
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Conexión rechazada: {url}")
            raise ServiceUnavailableException(
                f"{self.service_name} no disponible"
            ) from e
        
        except Exception as e:
            logger.error(f"Error en POST {url}: {e}")
            raise ServiceException(str(e)) from e
    
    def health_check(self) -> bool:
        """
        Verificar si el servicio está disponible.
        
        Returns:
            True si está disponible
        """
        try:
            # Intentar acceso a raíz del servicio
            self.session.get(
                self.base_url,
                timeout=2
            )
            logger.info(f"{self.service_name} está disponible")
            return True
        except Exception as e:
            logger.error(f"{self.service_name} NO disponible: {e}")
            return False


# Inicializar clientes globales
def get_personas_client() -> RobustServiceClient:
    """Obtener cliente del servicio de personas."""
    from django.conf import settings
    return RobustServiceClient(
        settings.PERSONAS_SERVICE_URL or 'http://personas:8000',
        'personas_service'
    )


def get_inventario_client() -> RobustServiceClient:
    """Obtener cliente del servicio de inventario."""
    from django.conf import settings
    return RobustServiceClient(
        settings.INVENTARIO_SERVICE_URL or 'http://inventario:8000',
        'inventario_service'
    )


def get_analytics_client() -> RobustServiceClient:
    """Obtener cliente del servicio de analytics."""
    from django.conf import settings
    return RobustServiceClient(
        settings.ANALYTICS_SERVICE_URL or 'http://analytics:8005',
        'analytics_service'
    )
