"""
Sistema de Caché Distribuido con Redis
Proporciona caché compartido entre instancias de Django con soporte para:
- Serialización automática de objetos Python
- TTL (Time To Live) configurable
- Invalidación por patrón
- Estadísticas de uso
"""

import json
import logging
import pickle
from typing import Any, Optional, List, Dict
from datetime import timedelta
from django.core.cache import cache
from django.conf import settings
from functools import wraps
import hashlib

logger = logging.getLogger(__name__)


class DistributedCache:
    """
    Wrapper para Django cache (Redis) con funcionalidades adicionales.
    """
    
    def __init__(self, prefix: str = 'repdrill'):
        self.prefix = prefix
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
        }
    
    def _make_key(self, key: str) -> str:
        """Generar key completo con prefix."""
        return f"{self.prefix}:{key}"
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Obtener valor del caché.
        
        Args:
            key: Clave del caché
            default: Valor por defecto si no existe
            
        Returns:
            Valor del caché o default
        """
        full_key = self._make_key(key)
        try:
            value = cache.get(full_key)
            if value is not None:
                self.stats['hits'] += 1
                logger.debug(f"[Cache HIT] {full_key}")
                return value
            else:
                self.stats['misses'] += 1
                logger.debug(f"[Cache MISS] {full_key}")
                return default
        except Exception as e:
            logger.error(f"Error getting from cache: {e}")
            return default
    
    def set(
        self, 
        key: str, 
        value: Any, 
        timeout: Optional[int] = None
    ) -> bool:
        """
        Guardar valor en caché.
        
        Args:
            key: Clave del caché
            value: Valor a guardar
            timeout: TTL en segundos (None = sin expiración)
            
        Returns:
            True si se guardó exitosamente
        """
        full_key = self._make_key(key)
        try:
            cache.set(full_key, value, timeout=timeout)
            self.stats['sets'] += 1
            logger.debug(f"[Cache SET] {full_key} (TTL: {timeout}s)")
            return True
        except Exception as e:
            logger.error(f"Error setting cache: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Eliminar valor del caché.
        
        Args:
            key: Clave a eliminar
            
        Returns:
            True si se eliminó
        """
        full_key = self._make_key(key)
        try:
            cache.delete(full_key)
            self.stats['deletes'] += 1
            logger.debug(f"[Cache DELETE] {full_key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting from cache: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """
        Eliminar todas las keys que coincidan con el patrón.
        
        Args:
            pattern: Patrón de búsqueda (ej: 'forecast:*')
            
        Returns:
            Número de keys eliminadas
        """
        full_pattern = self._make_key(pattern)
        try:
            # Django cache no tiene delete_pattern nativo
            # Necesitamos acceder al cliente Redis directamente
            from django_redis import get_redis_connection
            redis_conn = get_redis_connection("default")
            
            keys = redis_conn.keys(full_pattern)
            count = 0
            for key in keys:
                redis_conn.delete(key)
                count += 1
                
            logger.info(f"[Cache DELETE_PATTERN] {full_pattern} ({count} keys)")
            self.stats['deletes'] += count
            return count
        except ImportError:
            logger.warning("django-redis not available, pattern delete not supported")
            return 0
        except Exception as e:
            logger.error(f"Error deleting pattern: {e}")
            return 0
    
    def get_many(self, keys: List[str]) -> Dict[str, Any]:
        """
        Obtener múltiples valores en una sola operación.
        
        Args:
            keys: Lista de claves
            
        Returns:
            Diccionario con valores encontrados
        """
        full_keys = [self._make_key(k) for k in keys]
        try:
            values = cache.get_many(full_keys)
            # Remover prefix de las keys en el resultado
            result = {}
            for full_key, value in values.items():
                original_key = full_key.replace(f"{self.prefix}:", "", 1)
                result[original_key] = value
                self.stats['hits'] += 1
            
            # Contar misses
            missing = len(keys) - len(result)
            self.stats['misses'] += missing
            
            logger.debug(f"[Cache GET_MANY] {len(result)}/{len(keys)} found")
            return result
        except Exception as e:
            logger.error(f"Error getting many from cache: {e}")
            return {}
    
    def set_many(self, data: Dict[str, Any], timeout: Optional[int] = None) -> bool:
        """
        Guardar múltiples valores en una sola operación.
        
        Args:
            data: Diccionario de key-value a guardar
            timeout: TTL en segundos
            
        Returns:
            True si se guardaron exitosamente
        """
        full_data = {self._make_key(k): v for k, v in data.items()}
        try:
            cache.set_many(full_data, timeout=timeout)
            self.stats['sets'] += len(data)
            logger.debug(f"[Cache SET_MANY] {len(data)} items (TTL: {timeout}s)")
            return True
        except Exception as e:
            logger.error(f"Error setting many in cache: {e}")
            return False
    
    def clear_all(self) -> bool:
        """
        Limpiar todo el caché del prefix actual.
        
        Returns:
            True si se limpió exitosamente
        """
        try:
            pattern = f"{self.prefix}:*"
            count = self.delete_pattern(pattern)
            logger.info(f"[Cache CLEAR_ALL] Cleared {count} keys")
            return True
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return False
    
    def get_stats(self) -> Dict[str, int]:
        """
        Obtener estadísticas de uso del caché.
        
        Returns:
            Diccionario con estadísticas
        """
        total_ops = (
            self.stats['hits'] + 
            self.stats['misses'] + 
            self.stats['sets'] + 
            self.stats['deletes']
        )
        
        hit_rate = (
            (self.stats['hits'] / (self.stats['hits'] + self.stats['misses']) * 100)
            if (self.stats['hits'] + self.stats['misses']) > 0
            else 0
        )
        
        return {
            **self.stats,
            'total_operations': total_ops,
            'hit_rate': round(hit_rate, 2),
        }
    
    def reset_stats(self):
        """Resetear estadísticas."""
        self.stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
        }


# Instancia global del caché
distributed_cache = DistributedCache(prefix='repdrill')


def cache_key_from_args(*args, **kwargs) -> str:
    """
    Generar key único basado en argumentos de función.
    
    Args:
        *args: Argumentos posicionales
        **kwargs: Argumentos nombrados
        
    Returns:
        Hash MD5 de los argumentos
    """
    key_data = {
        'args': args,
        'kwargs': kwargs,
    }
    key_str = json.dumps(key_data, sort_keys=True, default=str)
    return hashlib.md5(key_str.encode()).hexdigest()


def cached(
    timeout: int = 300,
    key_prefix: str = 'func',
    use_args: bool = True
):
    """
    Decorator para cachear resultado de funciones.
    
    Args:
        timeout: TTL en segundos (default: 5 minutos)
        key_prefix: Prefix para la key del caché
        use_args: Si True, incluir argumentos en la key
        
    Example:
        @cached(timeout=600, key_prefix='forecast')
        def get_sales_forecast(days=30):
            # cálculos costosos
            return forecast_data
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generar key única
            if use_args:
                args_key = cache_key_from_args(*args, **kwargs)
                cache_key = f"{key_prefix}:{func.__name__}:{args_key}"
            else:
                cache_key = f"{key_prefix}:{func.__name__}"
            
            # Intentar obtener del caché
            cached_value = distributed_cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Ejecutar función y cachear resultado
            result = func(*args, **kwargs)
            distributed_cache.set(cache_key, result, timeout=timeout)
            
            return result
        
        return wrapper
    return decorator


# Funciones helper para casos de uso comunes

def cache_forecast(forecast_type: str, product_id: Optional[int] = None):
    """
    Decorator específico para cachear forecasts de Prophet.
    TTL: 10 minutos (forecasts no cambian frecuentemente)
    """
    prefix = f"forecast:{forecast_type}"
    if product_id:
        prefix += f":product_{product_id}"
    
    return cached(timeout=600, key_prefix=prefix, use_args=True)


def cache_restock(warehouse_id: Optional[int] = None):
    """
    Decorator específico para cachear recomendaciones de restock.
    TTL: 5 minutos (cambian más frecuentemente)
    """
    prefix = "restock"
    if warehouse_id:
        prefix += f":warehouse_{warehouse_id}"
    
    return cached(timeout=300, key_prefix=prefix, use_args=True)


def invalidate_forecast_cache(product_id: Optional[int] = None):
    """
    Invalidar caché de forecasts.
    
    Args:
        product_id: Si se especifica, solo invalida ese producto
    """
    if product_id:
        pattern = f"forecast:*:product_{product_id}:*"
    else:
        pattern = "forecast:*"
    
    count = distributed_cache.delete_pattern(pattern)
    logger.info(f"Invalidated {count} forecast cache entries")
    return count


def invalidate_restock_cache(warehouse_id: Optional[int] = None):
    """
    Invalidar caché de restock.
    
    Args:
        warehouse_id: Si se especifica, solo invalida ese warehouse
    """
    if warehouse_id:
        pattern = f"restock:warehouse_{warehouse_id}:*"
    else:
        pattern = "restock:*"
    
    count = distributed_cache.delete_pattern(pattern)
    logger.info(f"Invalidated {count} restock cache entries")
    return count
