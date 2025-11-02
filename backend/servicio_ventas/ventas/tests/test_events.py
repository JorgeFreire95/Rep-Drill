"""
Tests para el sistema de eventos (EventPublisher).
"""
import pytest
from unittest.mock import patch, Mock
from decimal import Decimal
from ventas.events import EventPublisher


@pytest.mark.django_db
class TestEventPublisher:
    """Tests para EventPublisher."""

    def test_publish_event_no_redis(self):
        """
        Test: publicar evento sin Redis disponible.
        """
        with patch('ventas.events.REDIS_AVAILABLE', False):
            # Mock order
            order = Mock()
            order.id = 5
            order.customer_id = 300
            order.total = Decimal('1000.00')
            order.status = 'PENDING'
            order.order_date = None
            order.details.all.return_value = []
            
            publisher = EventPublisher()
            result = publisher.publish_order_created(order)
            
            # Debe devolver 'no-redis' cuando Redis no está disponible
            assert result == 'no-redis'

    def test_publish_event_redis_connection_fail(self):
        """
        Test: fallo de conexión a Redis durante inicialización.
        """
        with patch('ventas.events.redis') as mock_redis_module:
            # Mock fallo en la conexión
            mock_redis_module.from_url.side_effect = Exception("Connection failed")
            
            # Mock order
            order = Mock()
            order.id = 6
            order.customer_id = 400
            order.total = Decimal('750.00')
            order.status = 'PENDING'
            order.order_date = None
            order.details.all.return_value = []
            
            publisher = EventPublisher()
            result = publisher.publish_order_created(order)
            
            # Debe manejar el error gracefully
            assert result == 'no-redis'
