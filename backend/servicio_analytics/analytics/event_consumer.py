"""
Consumidor de eventos desde Redis Streams.
Analytics consume eventos de órdenes para calcular métricas.
"""

import json
import redis
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, date
from django.conf import settings
from decimal import Decimal

logger = logging.getLogger(__name__)


class EventConsumer:
    """
    Consumidor de eventos desde Redis Streams.
    Mantiene posición de lectura para garantizar procesamiento de todos los eventos.
    """
    
    # Prefijo para guardar posición del consumer
    CONSUMER_PREFIX = 'consumer:position:'
    
    # Streams a monitorear
    STREAM_ORDERS = 'events:orders'
    STREAM_PAYMENTS = 'events:payments'
    STREAM_SHIPMENTS = 'events:shipments'
    
    def __init__(self, consumer_name: str = 'analytics'):
        """
        Inicializar consumer.
        
        Args:
            consumer_name: Identificador del consumer
        """
        self.consumer_name = consumer_name
        try:
            self.redis_client = redis.from_url(
                settings.CELERY_BROKER_URL or 'redis://redis:6379/0',
                decode_responses=False
            )
            self.redis_client.ping()
            logger.info(f"EventConsumer '{consumer_name}' conectado a Redis")
        except Exception as e:
            logger.error(f"Error conectando Redis: {e}")
            raise
    
    def _get_last_position(self, stream: str) -> str:
        """
        Obtener posición del último evento procesado.
        
        Args:
            stream: Nombre del stream
        
        Returns:
            ID del último evento procesado o '0' si es la primera vez
        """
        try:
            position_key = f"{self.CONSUMER_PREFIX}{self.consumer_name}:{stream}"
            position = self.redis_client.get(position_key)
            
            if position:
                return position.decode() if isinstance(position, bytes) else position
            
            # Primera vez: procesar desde el inicio
            logger.info(f"Primera lectura de {stream}, procesando desde el inicio")
            return '0'
        
        except Exception as e:
            logger.error(f"Error obteniendo posición: {e}")
            return '0'
    
    def _save_position(self, stream: str, event_id: str):
        """
        Guardar posición del último evento procesado.
        
        Args:
            stream: Nombre del stream
            event_id: ID del evento procesado
        """
        try:
            position_key = f"{self.CONSUMER_PREFIX}{self.consumer_name}:{stream}"
            self.redis_client.set(position_key, event_id)
        except Exception as e:
            logger.error(f"Error guardando posición: {e}")
    
    def consume_order_events(self, count: int = 100) -> int:
        """
        Consumir eventos de órdenes.
        
        Args:
            count: Máximo de eventos a procesar
        
        Returns:
            Número de eventos procesados
        """
        processed = 0
        
        try:
            last_position = self._get_last_position(self.STREAM_ORDERS)
            
            # Leer eventos desde la última posición
            events = self.redis_client.xrange(
                self.STREAM_ORDERS,
                min=f'({last_position}' if last_position != '0' else '-',
                count=count
            )
            
            for event_id, event_data in events:
                try:
                    event_json = event_data[b'data'].decode()
                    event = json.loads(event_json)
                    
                    # Procesar evento
                    if event['event_type'] == 'order.created':
                        self._process_order_created(event)
                    
                    elif event['event_type'] == 'order.updated':
                        self._process_order_updated(event)
                    
                    elif event['event_type'] == 'order.cancelled':
                        self._process_order_cancelled(event)
                    
                    # Guardar posición
                    event_id_str = event_id.decode() if isinstance(event_id, bytes) else event_id
                    self._save_position(self.STREAM_ORDERS, event_id_str)
                    processed += 1
                
                except Exception as e:
                    logger.error(f"Error procesando evento: {e}")
                    continue
            
            if processed > 0:
                logger.info(f"Procesados {processed} eventos de órdenes")
        
        except Exception as e:
            logger.error(f"Error consumiendo eventos: {e}")
        
        return processed
    
    def consume_payment_events(self, count: int = 100) -> int:
        """
        Consumir eventos de pagos.
        
        Args:
            count: Máximo de eventos a procesar
        
        Returns:
            Número de eventos procesados
        """
        processed = 0
        
        try:
            last_position = self._get_last_position(self.STREAM_PAYMENTS)
            
            events = self.redis_client.xrange(
                self.STREAM_PAYMENTS,
                min=f'({last_position}' if last_position != '0' else '-',
                count=count
            )
            
            for event_id, event_data in events:
                try:
                    event_json = event_data[b'data'].decode()
                    event = json.loads(event_json)
                    
                    if event['event_type'] == 'payment.created':
                        self._process_payment_created(event)
                    
                    event_id_str = event_id.decode() if isinstance(event_id, bytes) else event_id
                    self._save_position(self.STREAM_PAYMENTS, event_id_str)
                    processed += 1
                
                except Exception as e:
                    logger.error(f"Error procesando evento de pago: {e}")
                    continue
            
            if processed > 0:
                logger.info(f"Procesados {processed} eventos de pagos")
        
        except Exception as e:
            logger.error(f"Error consumiendo eventos de pago: {e}")
        
        return processed
    
    def _process_order_created(self, event: Dict[str, Any]):
        """Procesar evento: Orden creada."""
        from .models import DailySalesMetrics
        
        try:
            order_date = event.get('order_date')
            if not order_date:
                order_date = event['timestamp'].split('T')[0]
            
            order_date = datetime.fromisoformat(order_date).date()
            total_sales = Decimal(str(event['total']))
            
            # Actualizar métrica diaria
            metric, created = DailySalesMetrics.objects.get_or_create(
                date=order_date,
                defaults={
                    'total_sales': total_sales,
                    'total_orders': 1,
                    'products_sold': sum(
                        d['quantity'] for d in event.get('details', [])
                    ),
                    'unique_customers': 1,
                }
            )
            
            if not created:
                # Actualizar métrica existente
                metric.total_sales += total_sales
                metric.total_orders += 1
                metric.products_sold += sum(
                    d['quantity'] for d in event.get('details', [])
                )
                metric.save()
            
            logger.info(f"Procesada orden {event['order_id']} para {order_date}")
        
        except Exception as e:
            logger.error(f"Error procesando order.created: {e}")
    
    def _process_order_updated(self, event: Dict[str, Any]):
        """Procesar evento: Orden actualizada."""
        logger.debug(f"Orden actualizada: {event['order_id']}")
    
    def _process_order_cancelled(self, event: Dict[str, Any]):
        """Procesar evento: Orden cancelada."""
        from .models import DailySalesMetrics
        
        try:
            order_date = datetime.now().date()
            
            # Decrementar métrica diaria
            metric = DailySalesMetrics.objects.filter(date=order_date).first()
            if metric:
                metric.total_orders = max(0, metric.total_orders - 1)
                metric.total_sales = max(
                    Decimal('0'),
                    metric.total_sales - Decimal(str(event['total']))
                )
                metric.save()
            
            logger.info(f"Orden cancelada {event['order_id']}")
        
        except Exception as e:
            logger.error(f"Error procesando order.cancelled: {e}")
    
    def _process_payment_created(self, event: Dict[str, Any]):
        """Procesar evento: Pago creado."""
        logger.debug(f"Pago registrado: {event['payment_id']}")
    
    def health_check(self) -> bool:
        """Verificar que Redis está disponible."""
        try:
            self.redis_client.ping()
            logger.info("EventConsumer Redis health check: OK")
            return True
        except Exception as e:
            logger.error(f"EventConsumer Redis health check FAILED: {e}")
            return False


# Singleton
_consumer = None


def get_event_consumer(consumer_name: str = 'analytics') -> EventConsumer:
    """Obtener instancia singleton del consumidor de eventos."""
    global _consumer
    if _consumer is None:
        _consumer = EventConsumer(consumer_name)
    return _consumer
