"""
Gestor de caché para datos frecuentemente accedidos de otros servicios.
Utiliza Redis para caché distribuido con TTL configurable.
"""
import logging
import json
from datetime import timedelta
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class CacheManager:
    """
    Gestor centralizado de caché para datos de otros servicios.
    Implementa patrones de cache-aside y ttl configurable.
    """
    
    # Configuración de TTL por tipo de dato
    TTL_CONFIG = {
        'customer': getattr(settings, 'CACHE_TTL_CUSTOMER', 3600),  # 1 hora
        'product': getattr(settings, 'CACHE_TTL_PRODUCT', 1800),    # 30 minutos
        'inventory': getattr(settings, 'CACHE_TTL_INVENTORY', 300), # 5 minutos
        'default': 600  # 10 minutos
    }
    
    @staticmethod
    def get_cache_key(data_type, identifier):
        """Genera una clave de caché consistente."""
        return f"service_data:{data_type}:{identifier}"
    
    @staticmethod
    def get_customer(customer_id, service_client):
        """
        Obtiene datos de cliente con caché.
        
        Args:
            customer_id: ID del cliente
            service_client: Instancia de RobustServiceClient configurada
            
        Returns:
            dict con datos del cliente o None si hay error
        """
        cache_key = CacheManager.get_cache_key('customer', customer_id)
        
        # Intentar obtener del caché
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.debug(f"Cliente {customer_id} obtenido del caché")
            return cached_data
        
        # Si no está en caché, obtener del servicio
        try:
            response = service_client.get(f'/api/personas/{customer_id}/')
            
            if response and response.get('success') is not False:
                customer_data = response.get('data', {}) if isinstance(response, dict) else response
                
                # Guardar en caché
                ttl = CacheManager.TTL_CONFIG['customer']
                cache.set(cache_key, customer_data, ttl)
                logger.info(f"Cliente {customer_id} cacheado por {ttl}s")
                
                return customer_data
            else:
                error = response.get('error', 'Unknown error') if isinstance(response, dict) else 'Connection failed'
                logger.warning(f"Error obteniendo cliente {customer_id}: {error}")
                return None
                
        except Exception as e:
            logger.error(f"Excepción obteniendo cliente {customer_id}: {str(e)}")
            return None
    
    @staticmethod
    def get_product(product_id, service_client):
        """
        Obtiene datos de producto con caché.
        
        Args:
            product_id: ID del producto
            service_client: Instancia de RobustServiceClient configurada
            
        Returns:
            dict con datos del producto o None si hay error
        """
        cache_key = CacheManager.get_cache_key('product', product_id)
        
        # Intentar obtener del caché
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.debug(f"Producto {product_id} obtenido del caché")
            return cached_data
        
        # Si no está en caché, obtener del servicio
        try:
            response = service_client.get(f'/api/productos/{product_id}/')
            
            if response and response.get('success') is not False:
                product_data = response.get('data', {}) if isinstance(response, dict) else response
                
                # Guardar en caché
                ttl = CacheManager.TTL_CONFIG['product']
                cache.set(cache_key, product_data, ttl)
                logger.info(f"Producto {product_id} cacheado por {ttl}s")
                
                return product_data
            else:
                error = response.get('error', 'Unknown error') if isinstance(response, dict) else 'Connection failed'
                logger.warning(f"Error obteniendo producto {product_id}: {error}")
                return None
                
        except Exception as e:
            logger.error(f"Excepción obteniendo producto {product_id}: {str(e)}")
            return None
    
    @staticmethod
    def get_inventory_level(product_id, service_client):
        """
        Obtiene nivel de inventario con caché corto.
        
        Args:
            product_id: ID del producto
            service_client: Instancia de RobustServiceClient configurada
            
        Returns:
            dict con datos de inventario o None si hay error
        """
        cache_key = CacheManager.get_cache_key('inventory', product_id)
        
        # Intentar obtener del caché
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.debug(f"Inventario {product_id} obtenido del caché")
            return cached_data
        
        # Si no está en caché, obtener del servicio
        try:
            response = service_client.get(f'/api/inventario/{product_id}/')
            
            if response and response.get('success') is not False:
                inventory_data = response.get('data', {}) if isinstance(response, dict) else response
                
                # Guardar en caché con TTL corto para datos más frescos
                ttl = CacheManager.TTL_CONFIG['inventory']
                cache.set(cache_key, inventory_data, ttl)
                logger.info(f"Inventario {product_id} cacheado por {ttl}s")
                
                return inventory_data
            else:
                error = response.get('error', 'Unknown error') if isinstance(response, dict) else 'Connection failed'
                logger.warning(f"Error obteniendo inventario {product_id}: {error}")
                return None
                
        except Exception as e:
            logger.error(f"Excepción obteniendo inventario {product_id}: {str(e)}")
            return None
    
    @staticmethod
    def invalidate_customer(customer_id):
        """Invalida caché de cliente específico."""
        cache_key = CacheManager.get_cache_key('customer', customer_id)
        cache.delete(cache_key)
        logger.info(f"Caché de cliente {customer_id} invalidado")
    
    @staticmethod
    def invalidate_product(product_id):
        """Invalida caché de producto específico."""
        cache_key = CacheManager.get_cache_key('product', product_id)
        cache.delete(cache_key)
        logger.info(f"Caché de producto {product_id} invalidado")
    
    @staticmethod
    def invalidate_inventory(product_id):
        """Invalida caché de inventario específico."""
        cache_key = CacheManager.get_cache_key('inventory', product_id)
        cache.delete(cache_key)
        logger.info(f"Caché de inventario {product_id} invalidado")
    
    @staticmethod
    def clear_all_service_cache():
        """Limpia todo el caché de datos de servicios."""
        # En Django con Redis, podemos usar pattern matching
        try:
            cache.delete_pattern("service_data:*")
            logger.info("Todo caché de servicios ha sido limpiado")
        except Exception as e:
            # Si el backend de caché no soporta delete_pattern, hacer reset
            logger.warning(f"No se pudo limpiar patrón de caché: {str(e)}")
            cache.clear()
    
    @staticmethod
    def get_cache_stats():
        """
        Retorna estadísticas del caché.
        Nota: Solo funciona con algunos backends de caché (Redis).
        """
        try:
            stats = {
                'cache_backend': settings.CACHES['default']['BACKEND'],
                'location': settings.CACHES['default'].get('LOCATION', 'N/A'),
                'ttl_config': CacheManager.TTL_CONFIG
            }
            return stats
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas de caché: {str(e)}")
            return None
