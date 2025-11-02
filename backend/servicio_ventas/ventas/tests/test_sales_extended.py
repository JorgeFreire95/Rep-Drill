"""
Tests adicionales para el servicio de ventas - Coverage Enhancement
"""
import pytest
from decimal import Decimal
from django.utils import timezone
from ventas.models import Order, OrderDetails, Payment, Shipment


@pytest.mark.django_db
class TestOrderMethods:
    """Tests para métodos del modelo Order"""
    
    def test_get_total_paid_with_payments(self):
        """Test calcular total pagado con pagos"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('5000')
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('3000'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('2000'),
            payment_method='CARD',
            payment_date=timezone.now().date()
        )
        
        assert order.get_total_paid() == Decimal('5000')
    
    def test_get_total_paid_no_payments(self):
        """Test calcular total pagado sin pagos"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('5000')
        )
        
        assert order.get_total_paid() == 0
    
    def test_is_fully_paid_true(self):
        """Test verificar orden completamente pagada"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('1000'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        assert order.is_fully_paid() is True
    
    def test_is_fully_paid_false(self):
        """Test verificar orden no pagada completamente"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('500'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        assert order.is_fully_paid() is False
    
    def test_update_status_from_payment_completed(self):
        """Test actualizar estado cuando está completamente pagada"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='PENDING',
            total=Decimal('1000')
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('1000'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        order.update_status_from_payment()
        order.refresh_from_db()
        
        assert order.status == 'COMPLETED'
    
    def test_update_status_from_payment_not_completed(self):
        """Test no actualizar estado cuando no está completamente pagada"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='PENDING',
            total=Decimal('1000')
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('500'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        order.update_status_from_payment()
        order.refresh_from_db()
        
        assert order.status == 'PENDING'
    
    def test_order_save_sets_order_date(self):
        """Test que save() asigna order_date automáticamente"""
        order = Order.objects.create(
            customer_id=1,
            total=Decimal('1000')
        )
        
        assert order.order_date is not None
        assert order.order_date == timezone.localdate()


@pytest.mark.django_db
class TestOrderDetailsModel:
    """Tests para el modelo OrderDetails"""
    
    def test_order_detail_creation(self):
        """Test creación de detalle de orden"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        detail = OrderDetails.objects.create(
            order=order,
            product_id=1,
            quantity=2,
            unit_price=Decimal('500'),
            subtotal=Decimal('1000')
        )
        
        assert detail.order == order
        assert detail.product_id == 1
        assert detail.quantity == 2
    
    def test_order_detail_str(self):
        """Test representación string de detalle"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        detail = OrderDetails.objects.create(
            order=order,
            product_id=5,
            quantity=2,
            unit_price=Decimal('500'),
            subtotal=Decimal('1000')
        )
        
        expected = f"OrderDetail for Order #{order.id} - Product 5"
        assert str(detail) == expected


@pytest.mark.django_db
class TestPaymentModel:
    """Tests para el modelo Payment"""
    
    def test_payment_creation(self):
        """Test creación de pago"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        payment = Payment.objects.create(
            order=order,
            amount=Decimal('1000'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        assert payment.order == order
        assert payment.amount == Decimal('1000')
        assert payment.payment_method == 'CASH'
    
    def test_payment_str(self):
        """Test representación string de pago"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        payment = Payment.objects.create(
            order=order,
            amount=Decimal('1000'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        assert f"Payment for Order #{order.id}" in str(payment)


@pytest.mark.django_db
class TestShipmentModel:
    """Tests para el modelo Shipment"""
    
    def test_shipment_creation(self):
        """Test creación de envío"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        shipment = Shipment.objects.create(
            order=order,
            shipment_date=timezone.now().date(),
            warehouse_id=1,
            delivered=False,
            delivery_status='Pendiente'
        )
        
        assert shipment.order == order
        assert shipment.warehouse_id == 1
        assert shipment.delivered is False
        assert shipment.delivery_status == 'Pendiente'
    
    def test_shipment_str(self):
        """Test representación string de envío"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000')
        )
        
        shipment = Shipment.objects.create(
            order=order,
            shipment_date=timezone.now().date(),
            warehouse_id=1,
            delivered=False,
            delivery_status='Pendiente'
        )
        
        assert f"Shipment for Order #{order.id}" in str(shipment)


@pytest.mark.django_db
class TestOrderStatusChoices:
    """Tests para estados de orden"""
    
    def test_order_pending_status(self):
        """Test orden con estado PENDING"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='PENDING',
            total=Decimal('1000')
        )
        
        assert order.status == 'PENDING'
    
    def test_order_confirmed_status(self):
        """Test orden con estado CONFIRMED"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='CONFIRMED',
            total=Decimal('1000')
        )
        
        assert order.status == 'CONFIRMED'
    
    def test_order_cancelled_status(self):
        """Test orden con estado CANCELLED"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='CANCELLED',
            total=Decimal('1000')
        )
        
        assert order.status == 'CANCELLED'
