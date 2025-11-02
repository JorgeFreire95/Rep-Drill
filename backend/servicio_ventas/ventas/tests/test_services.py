"""
Tests para los servicios de ventas - InventoryService y OrderService
"""
import pytest
from decimal import Decimal
from unittest.mock import patch, Mock
from django.utils import timezone
from ventas.models import Order, OrderDetails, Payment
from ventas.services import InventoryService, OrderService


@pytest.mark.django_db
class TestInventoryService:
    """Tests para InventoryService"""
    
    @patch('ventas.services.requests.get')
    def test_check_product_availability_success(self, mock_get):
        """Test verificar disponibilidad de producto exitosamente"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'quantity': 100,
            'name': 'Producto Test'
        }
        mock_get.return_value = mock_response
        
        result = InventoryService.check_product_availability(1, 50)
        
        assert result['success'] is True
        assert result['available'] is True
        assert result['current_quantity'] == 100
        assert result['required_quantity'] == 50
        assert result['product_name'] == 'Producto Test'
    
    @patch('ventas.services.requests.get')
    def test_check_product_availability_insufficient_stock(self, mock_get):
        """Test verificar disponibilidad con stock insuficiente"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'quantity': 10,
            'name': 'Producto Test'
        }
        mock_get.return_value = mock_response
        
        result = InventoryService.check_product_availability(1, 50)
        
        assert result['success'] is True
        assert result['available'] is False
        assert result['current_quantity'] == 10
    
    @patch('ventas.services.requests.get')
    def test_check_product_availability_not_found(self, mock_get):
        """Test verificar disponibilidad de producto no encontrado"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        result = InventoryService.check_product_availability(999, 10)
        
        assert result['success'] is False
        assert 'error' in result
    
    @patch('ventas.services.requests.get')
    def test_check_product_availability_connection_error(self, mock_get):
        """Test verificar disponibilidad con error de conexión"""
        mock_get.side_effect = Exception('Connection error')
        
        result = InventoryService.check_product_availability(1, 10)
        
        assert result['success'] is False
        assert 'error' in result
    
    @patch('ventas.services.requests.patch')
    @patch('ventas.services.requests.get')
    def test_update_product_stock_success(self, mock_get, mock_patch):
        """Test actualizar stock de producto exitosamente"""
        mock_get_response = Mock()
        mock_get_response.status_code = 200
        mock_get_response.json.return_value = {
            'quantity': 100,
            'name': 'Producto Test'
        }
        mock_get.return_value = mock_get_response
        
        mock_patch_response = Mock()
        mock_patch_response.status_code = 200
        mock_patch.return_value = mock_patch_response
        
        result = InventoryService.update_product_stock(1, 20)
        
        assert result['success'] is True
        assert result['product_id'] == 1
        assert result['previous_quantity'] == 100
        assert result['new_quantity'] == 80
        assert result['reduced_quantity'] == 20
    
    @patch('ventas.services.requests.get')
    def test_update_product_stock_product_not_found(self, mock_get):
        """Test actualizar stock de producto no encontrado"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = 'Not found'
        mock_get.return_value = mock_response
        
        result = InventoryService.update_product_stock(999, 10)
        
        assert result['success'] is False
        assert 'error' in result
    
    @patch('ventas.services.requests.patch')
    @patch('ventas.services.requests.get')
    def test_update_product_stock_update_error(self, mock_get, mock_patch):
        """Test error al actualizar stock"""
        mock_get_response = Mock()
        mock_get_response.status_code = 200
        mock_get_response.json.return_value = {'quantity': 100}
        mock_get.return_value = mock_get_response
        
        mock_patch_response = Mock()
        mock_patch_response.status_code = 500
        mock_patch_response.text = 'Internal error'
        mock_patch.return_value = mock_patch_response
        
        result = InventoryService.update_product_stock(1, 10)
        
        assert result['success'] is False
        assert 'error' in result
    
    @patch('ventas.services.InventoryService.update_product_stock')
    def test_update_inventory_for_order(self, mock_update_stock):
        """Test actualizar inventario para toda una orden"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('2000')
        )
        
        OrderDetails.objects.create(
            order=order,
            product_id=1,
            quantity=5,
            unit_price=Decimal('200'),
            subtotal=Decimal('1000')
        )
        
        OrderDetails.objects.create(
            order=order,
            product_id=2,
            quantity=10,
            unit_price=Decimal('100'),
            subtotal=Decimal('1000')
        )
        
        mock_update_stock.return_value = {'success': True}
        
        result = InventoryService.update_inventory_for_order(order)
        
        assert result['success'] is True
        assert result['order_id'] == order.id
        assert len(result['results']) == 2
        assert mock_update_stock.call_count == 2


@pytest.mark.django_db
class TestOrderService:
    """Tests para OrderService"""
    
    def test_process_payment_completion_inventory_already_updated(self):
        """Test procesar orden con inventario ya actualizado"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            total=Decimal('1000'),
            inventory_updated=True
        )
        
        result = OrderService.process_payment_completion(order)
        
        assert result['success'] is False
        assert 'inventario ya fue actualizado' in result['message'].lower()
    
    def test_process_payment_completion_not_fully_paid(self):
        """Test procesar orden no completamente pagada"""
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
        
        result = OrderService.process_payment_completion(order)
        
        assert result['success'] is False
        assert 'no está completamente pagada' in result['message'].lower()
    
    def test_process_payment_completion_no_details(self):
        """Test procesar orden sin detalles"""
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
        
        result = OrderService.process_payment_completion(order)
        
        assert result['success'] is False
        assert 'no tiene productos' in result['message'].lower()
    
    @patch('ventas.services.InventoryService.update_inventory_for_order')
    def test_process_payment_completion_success(self, mock_update_inventory):
        """Test procesar orden exitosamente"""
        # Deshabilitar señales para controlar el flujo
        from django.db.models.signals import post_save
        from ventas.signals import update_order_status_on_payment_save
        post_save.disconnect(update_order_status_on_payment_save, sender=Payment)
        
        try:
            order = Order.objects.create(
                customer_id=1,
                order_date=timezone.now().date(),
                total=Decimal('1000'),
                status='PENDING',
                inventory_updated=False  # Explícitamente False
            )
            
            OrderDetails.objects.create(
                order=order,
                product_id=1,
                quantity=2,
                unit_price=Decimal('500'),
                subtotal=Decimal('1000')
            )
            
            Payment.objects.create(
                order=order,
                amount=Decimal('1000'),
                payment_method='CASH',
                payment_date=timezone.now().date()
            )
            
            mock_update_inventory.return_value = {
                'success': True,
                'results': [{'product_id': 1, 'result': {'success': True}}]
            }
            
            result = OrderService.process_payment_completion(order)
            
            assert result['success'] is True
            assert 'exitosamente' in result['message'].lower()
            
            order.refresh_from_db()
            assert order.inventory_updated is True
            assert order.status == 'COMPLETED'
        finally:
            post_save.connect(update_order_status_on_payment_save, sender=Payment)
    
    @patch('ventas.services.InventoryService.update_inventory_for_order')
    def test_process_payment_completion_inventory_error(self, mock_update_inventory):
        """Test error al actualizar inventario"""
        # Deshabilitar señales
        from django.db.models.signals import post_save
        from ventas.signals import update_order_status_on_payment_save
        post_save.disconnect(update_order_status_on_payment_save, sender=Payment)
        
        try:
            order = Order.objects.create(
                customer_id=1,
                order_date=timezone.now().date(),
                total=Decimal('1000'),
                inventory_updated=False
            )
            
            OrderDetails.objects.create(
                order=order,
                product_id=1,
                quantity=2,
                unit_price=Decimal('500'),
                subtotal=Decimal('1000')
            )
            
            Payment.objects.create(
                order=order,
                amount=Decimal('1000'),
                payment_method='CASH',
                payment_date=timezone.now().date()
            )
            
            mock_update_inventory.return_value = {
                'success': False,
                'results': [{'product_id': 1, 'result': {'success': False, 'error': 'Stock insufficient'}}]
            }
            
            result = OrderService.process_payment_completion(order)
            
            assert result['success'] is False
            assert ('error' in result['message'].lower() or 'inventario' in result['message'].lower())
        finally:
            post_save.connect(update_order_status_on_payment_save, sender=Payment)
