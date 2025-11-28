"""
Tareas asíncronas de Celery para el servicio de ventas.
"""
from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task
def sync_customer_caches_daily():
    """
    Sincroniza el cache de clientes para todas las órdenes activas.
    
    Esta tarea se ejecuta diariamente a las 3:00 AM para mantener
    los datos de clientes actualizados en las órdenes pendientes y en proceso.
    
    Returns:
        dict: Estadísticas de la sincronización
    """
    from ventas.models import Order
    
    logger.info("Iniciando sincronización diaria de cache de clientes")
    
    try:
        result = Order.sync_all_customer_caches()
        
        logger.info(
            f"Sincronización completada: {result['success']} éxitos, "
            f"{result['errors']} errores de {result['total']} órdenes"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error en sincronización diaria: {str(e)}", exc_info=True)
        return {
            'success': 0,
            'errors': 0,
            'total': 0,
            'error': str(e)
        }


@shared_task
def sync_order_customer_cache(order_id):
    """
    Sincroniza el cache del cliente para una orden específica.
    
    Args:
        order_id (int): ID de la orden a sincronizar
        
    Returns:
        dict: Resultado de la sincronización
    """
    from ventas.models import Order
    
    try:
        order = Order.objects.get(id=order_id)
        
        if order.sync_customer_cache():
            logger.info(f"Cache sincronizado para orden {order_id}")
            return {
                'success': True,
                'order_id': order_id,
                'customer_name': order.customer_name,
                'customer_email': order.customer_email
            }
        else:
            logger.warning(f"No se pudo sincronizar cache para orden {order_id}")
            return {
                'success': False,
                'order_id': order_id,
                'error': 'Error al obtener datos del servicio Personas'
            }
            
    except Order.DoesNotExist:
        logger.error(f"Orden {order_id} no encontrada")
        return {
            'success': False,
            'order_id': order_id,
            'error': 'Orden no encontrada'
        }
    except Exception as e:
        logger.error(f"Error sincronizando orden {order_id}: {str(e)}", exc_info=True)
        return {
            'success': False,
            'order_id': order_id,
            'error': str(e)
        }
