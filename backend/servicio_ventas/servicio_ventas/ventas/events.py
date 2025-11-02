"""
Publicador de eventos usando Redis Streams.
Desacopla servicios mediante eventos asíncronos.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from django.conf import settings
from decimal import Decimal

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder que maneja Decimal."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


class EventPublisher:
    """
    Publicador de eventos de negocio usando Redis Streams.
    
    Eventos soportados:
    - order.created: Nueva orden creada
    - order.updated: Orden actualizada
    - order.cancelled: Orden cancelada
    - payment.created: Pago registrado
    - shipment.created: Envío creado
    """
    
    # Streams de eventos
    STREAM_ORDERS = 'events:orders'
    STREAM_PAYMENTS = 'events:payments'
    STREAM_SHIPMENTS = 'events:shipments'
    
    def __init__(self):
        """Inicializar conexión a Redis."""
        self.redis_client = None
        if REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(
                    settings.CELERY_BROKER_URL or 'redis://redis:6379/0',
                    decode_responses=False  # Para manejar bytes directamente
                )
                # Verificar conexión
                self.redis_client.ping()
                logger.info("EventPublisher conectado a Redis")
            except Exception as e:
                logger.warning(f"Redis no disponible: {e}. Los eventos no se publicarán.")
                self.redis_client = None
        else:
            logger.warning("Redis no instalado. Los eventos no se publicarán.")
    
    def _publish_event(
        self,
        stream: str,
        event_type: str,
        data: Dict[str, Any]
    ) -> str:
        """
        Publicar evento genérico a stream.
        
        Args:
            stream: Nombre del stream
            event_type: Tipo de evento
            data: Datos del evento
        
        Returns:
            ID del evento en el stream
        """
        if not self.redis_client:
            logger.debug(f"Redis no disponible. Evento {event_type} no fue publicado.")
            return "no-redis"
        
        try:
            event = {
                'event_type': event_type,
                'timestamp': datetime.now().isoformat(),
                **data
            }
            
            event_json = json.dumps(event, cls=DecimalEncoder)
            
            event_id = self.redis_client.xadd(
                stream,
                {'data': event_json}
            )
            
            logger.info(
                f"Evento publicado {event_type} en {stream}: {event_id}"
            )
            return event_id.decode() if isinstance(event_id, bytes) else event_id
        
        except Exception as e:
            logger.error(f"Error publicando evento {event_type}: {e}")
            return "error"
    
    def publish_order_created(self, order) -> str:
        """
        Publicar evento: Orden creada.
        
        Args:
            order: Instancia de Order
        
        Returns:
            ID del evento
        """
        data = {
            'order_id': order.id,
            'customer_id': order.customer_id,
            'total': str(order.total),
            'status': order.status,
            'order_date': order.order_date.isoformat() if order.order_date else None,
            'details': [
                {
                    'product_id': d.product_id,
                    'quantity': d.quantity,
                    'unit_price': str(d.unit_price),
                    'discount': str(d.discount) if d.discount else '0',
                }
                for d in order.details.all()
            ]
        }
        
        return self._publish_event(self.STREAM_ORDERS, 'order.created', data)
    
    def publish_order_updated(self, order, old_status: Optional[str] = None) -> str:
        """
        Publicar evento: Orden actualizada.
        
        Args:
            order: Instancia de Order
            old_status: Status anterior (para auditoría)
        
        Returns:
            ID del evento
        """
        data = {
            'order_id': order.id,
            'status': order.status,
            'old_status': old_status,
            'total': str(order.total),
            'updated_at': datetime.now().isoformat(),
        }
        
        return self._publish_event(self.STREAM_ORDERS, 'order.updated', data)
    
    def publish_order_cancelled(self, order, reason: str = '') -> str:
        """
        Publicar evento: Orden cancelada.
        
        Args:
            order: Instancia de Order
            reason: Razón de cancelación
        
        Returns:
            ID del evento
        """
        data = {
            'order_id': order.id,
            'reason': reason,
            'cancelled_at': datetime.now().isoformat(),
            'total': str(order.total),
        }
        
        return self._publish_event(self.STREAM_ORDERS, 'order.cancelled', data)
    
    def publish_payment_created(self, payment) -> str:
        """
        Publicar evento: Pago registrado.
        
        Args:
            payment: Instancia de Payment
        
        Returns:
            ID del evento
        """
        data = {
            'payment_id': payment.id,
            'order_id': payment.order_id,
            'amount': str(payment.amount),
            'payment_method': payment.payment_method,
            'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
        }
        
        return self._publish_event(self.STREAM_PAYMENTS, 'payment.created', data)
    
    def publish_shipment_created(self, shipment) -> str:
        """
        Publicar evento: Envío creado.
        
        Args:
            shipment: Instancia de Shipment
        
        Returns:
            ID del evento
        """
        data = {
            'shipment_id': shipment.id,
            'order_id': shipment.order_id,
            'carrier': shipment.carrier,
            'tracking_number': shipment.tracking_number,
            'shipment_date': shipment.shipment_date.isoformat() if shipment.shipment_date else None,
            'status': shipment.status,
        }
        
        return self._publish_event(self.STREAM_SHIPMENTS, 'shipment.created', data)
    
    def get_last_event_id(self, stream: str) -> Optional[str]:
        """
        Obtener el ID del último evento en un stream.
        
        Args:
            stream: Nombre del stream
        
        Returns:
            ID del último evento o None
        """
        try:
            result = self.redis_client.xrevrange(stream, count=1)
            if result:
                return result[0][0].decode() if isinstance(result[0][0], bytes) else result[0][0]
            return None
        except Exception as e:
            logger.error(f"Error obteniendo último evento: {e}")
            return None
    
    def get_events_since(self, stream: str, event_id: str, count: int = 100):
        """
        Obtener eventos desde un ID específico.
        
        Args:
            stream: Nombre del stream
            event_id: ID de inicio (exclusive)
            count: Número máximo de eventos
        
        Yields:
            Tuplas (event_id, event_data)
        """
        try:
            events = self.redis_client.xrange(stream, min=f'({event_id}', count=count)
            for event_id, event_data in events:
                try:
                    event_json = event_data[b'data'].decode()
                    event = json.loads(event_json)
                    yield (event_id.decode(), event)
                except Exception as e:
                    logger.error(f"Error procesando evento {event_id}: {e}")
                    continue
        except Exception as e:
            logger.error(f"Error leyendo eventos: {e}")
    
    def health_check(self) -> bool:
        """Verificar que Redis está disponible."""
        try:
            self.redis_client.ping()
            logger.info("EventPublisher Redis health check: OK")
            return True
        except Exception as e:
            logger.error(f"EventPublisher Redis health check FAILED: {e}")
            return False


# Singleton para evento
_publisher = None


def get_event_publisher() -> EventPublisher:
    """Obtener instancia singleton del publicador de eventos."""
    global _publisher
    if _publisher is None:
        _publisher = EventPublisher()
    return _publisher
