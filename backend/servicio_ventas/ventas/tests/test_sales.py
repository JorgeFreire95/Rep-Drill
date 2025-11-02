"""
Tests básicos para el servicio de ventas
"""
import pytest
from decimal import Decimal
from rest_framework.test import APIClient
from rest_framework import status
from ventas.models import Order, OrderDetails
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    """Cliente API para tests"""
    return APIClient()


@pytest.fixture
def test_user(db):
    """Usuario de prueba"""
    return User.objects.create_user(
        username='vendedor',
        password='testpass123'
    )


@pytest.fixture
def sample_order(db, test_user):
    """Orden de prueba"""
    from django.utils import timezone
    return Order.objects.create(
        customer_id=1,
        created_by_id=1,
        employee_id=1,
        warehouse_id=1,
        order_date=timezone.now().date(),
        status='PENDING',
        total=Decimal('1180')  # CLP sin decimales
    )


@pytest.fixture
def sample_order_item(db, sample_order):
    """Item de orden de prueba"""
    return OrderDetails.objects.create(
        order=sample_order,
        product_id=1,
        quantity=2,
        unit_price=Decimal('500'),
        discount=Decimal('0'),
        subtotal=Decimal('1000')
    )


class TestOrdersAPI:
    """Tests para endpoints de órdenes"""
    
    def test_list_orders(self, api_client, sample_order, test_user):
        """Test listar órdenes"""
        api_client.force_authenticate(user=test_user)
        response = api_client.get('/api/ventas/orders/')
        assert response.status_code == status.HTTP_200_OK
        # La API puede retornar lista directa o dict con 'results'
        if isinstance(response.data, list):
            assert len(response.data) > 0
        else:
            assert len(response.data.get('results', [])) > 0
    
    def test_create_order(self, api_client, test_user):
        """Test crear nueva orden"""
        api_client.force_authenticate(user=test_user)
        from django.utils import timezone
        data = {
            'customer_id': 1,
            'created_by_id': 1,
            'employee_id': 1,
            'warehouse_id': 1,
            'order_date': timezone.now().date().isoformat(),
            'status': 'PENDING',
            'total': 300,
            'notes': 'Orden de prueba'
        }
        
        response = api_client.post('/api/ventas/orders/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['customer_id'] == 1
        # El total se calcula desde los detalles; sin detalles debe ser 0
        assert int(response.data['total']) == 0
    
    def test_retrieve_order(self, api_client, sample_order, test_user):
        """Test obtener orden por ID"""
        api_client.force_authenticate(user=test_user)
        response = api_client.get(f'/api/ventas/orders/{sample_order.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['customer_id'] == 1
    
    def test_update_order_status(self, api_client, sample_order, test_user):
        """Test actualizar estado de orden"""
        api_client.force_authenticate(user=test_user)
        data = {'status': 'COMPLETED'}
        
        response = api_client.patch(f'/api/ventas/orders/{sample_order.id}/', data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'COMPLETED'
    
    def test_cancel_order(self, api_client, sample_order, test_user):
        """Test cancelar orden"""
        api_client.force_authenticate(user=test_user)
        data = {'status': 'CANCELLED'}
        
        response = api_client.patch(f'/api/ventas/orders/{sample_order.id}/', data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'CANCELLED'
    
    def test_order_total_calculation(self, sample_order):
        """Test cálculo de totales de orden"""
        assert sample_order.customer_id == 1
        assert sample_order.total == Decimal('1180')
        assert sample_order.status == 'PENDING'


class TestOrderDetailsAPI:
    """Tests para detalles de órdenes"""
    
    def test_order_items_in_order(self, api_client, sample_order, sample_order_item, test_user):
        """Test obtener items de una orden"""
        api_client.force_authenticate(user=test_user)
        response = api_client.get(f'/api/ventas/orders/{sample_order.id}/')
        assert response.status_code == status.HTTP_200_OK
        # Verificar que la orden tiene detalles relacionados
        assert sample_order.details.count() > 0
    
    def test_order_item_subtotal(self, sample_order_item):
        """Test cálculo de subtotal de item"""
        expected_subtotal = sample_order_item.quantity * sample_order_item.unit_price
        assert sample_order_item.subtotal == expected_subtotal


class TestOrderModel:
    """Tests para el modelo Order"""
    
    def test_order_creation(self, sample_order):
        """Test creación de orden"""
        assert sample_order.customer_id == 1
        assert sample_order.status == 'PENDING'
        assert sample_order.total > 0
    
    def test_order_str_representation(self, sample_order):
        """Test representación en string de orden"""
        expected = f"Order #{sample_order.id} - Customer: {sample_order.customer_id} - Status: {sample_order.status}"
        assert str(sample_order) == expected


class TestPaymentsAPI:
    """Tests para endpoints de pagos"""
    
    def test_create_payment(self, api_client, sample_order, test_user):
        """Test registrar pago"""
        api_client.force_authenticate(user=test_user)
        data = {
            'order': sample_order.id,
            'amount': '1180',
            'payment_method': 'CASH',
            'payment_date': '2025-10-31'
        }
        
        response = api_client.post('/api/ventas/payments/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert Decimal(str(response.data['amount'])) == Decimal('1180')


class TestShipmentsAPI:
    """Tests para endpoints de envíos"""
    
    def test_create_shipment(self, api_client, sample_order, test_user):
        """Test crear envío"""
        api_client.force_authenticate(user=test_user)
        data = {
            'order': sample_order.id,
            'warehouse_id': 1,
            'shipment_date': '2025-10-31',
            'delivered': False,
            'delivery_status': 'Pendiente'
        }
        
        response = api_client.post('/api/ventas/shipments/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['warehouse_id'] == 1
        assert response.data['delivery_status'] == 'Pendiente'
