"""
Tests para los serializers de ventas - Validaciones
"""
import pytest
from decimal import Decimal
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from ventas.models import Order, OrderDetails, Payment
from ventas.serializers import PaymentSerializer, OrderSerializer, OrderDetailCreateSerializer


@pytest.mark.django_db
class TestPaymentSerializerValidations:
    """Tests para validaciones de PaymentSerializer"""
    
    def test_validate_order_completed(self):
        """Test no permitir pagos en órdenes completadas"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='COMPLETED',
            total=Decimal('1000')
        )
        
        serializer = PaymentSerializer(data={
            'order': order.id,
            'amount': '100',
            'payment_method': 'CASH',
            'payment_date': '2025-10-31'
        })
        
        with pytest.raises(ValidationError) as exc_info:
            serializer.is_valid(raise_exception=True)
        
        assert 'order' in exc_info.value.detail
        assert 'completadas' in str(exc_info.value.detail['order'][0]).lower()
    
    def test_validate_order_cancelled(self):
        """Test no permitir pagos en órdenes canceladas"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='CANCELLED',
            total=Decimal('1000')
        )
        
        serializer = PaymentSerializer(data={
            'order': order.id,
            'amount': '100',
            'payment_method': 'CASH',
            'payment_date': '2025-10-31'
        })
        
        with pytest.raises(ValidationError) as exc_info:
            serializer.is_valid(raise_exception=True)
        
        assert 'order' in exc_info.value.detail
        assert 'canceladas' in str(exc_info.value.detail['order'][0]).lower()
    
    def test_validate_amount_exceeds_pending(self):
        """Test no permitir pago que excede el monto pendiente"""
        # Deshabilitar señales temporalmente para este test
        from django.db.models.signals import post_save
        from ventas.signals import update_order_status_on_payment_save
        post_save.disconnect(update_order_status_on_payment_save, sender=Payment)
        
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='PENDING',
            total=Decimal('1000')
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('700'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        serializer = PaymentSerializer(data={
            'order': order.id,
            'amount': '500',  # 700 + 500 > 1000
            'payment_method': 'CARD',
            'payment_date': '2025-10-31'
        })
        
        # Reconectar señal antes de validar
        post_save.connect(update_order_status_on_payment_save, sender=Payment)
        
        # La validación debería fallar
        is_valid = serializer.is_valid()
        assert is_valid is False
        assert 'amount' in serializer.errors
        assert 'excede' in str(serializer.errors['amount'][0]).lower()
    
    def test_validate_payment_within_limit(self):
        """Test permitir pago dentro del límite pendiente"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='PENDING',
            total=Decimal('1000')
        )
        
        Payment.objects.create(
            order=order,
            amount=Decimal('700'),
            payment_method='CASH',
            payment_date=timezone.now().date()
        )
        
        serializer = PaymentSerializer(data={
            'order': order.id,
            'amount': '300',  # 700 + 300 = 1000
            'payment_method': 'CARD',
            'payment_date': '2025-10-31'
        })
        
        assert serializer.is_valid()
    
    def test_create_payment_removes_null_date(self):
        """Test que crear pago sin fecha usa la fecha por defecto del modelo"""
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='PENDING',
            total=Decimal('1000')
        )
        
        serializer = PaymentSerializer(data={
            'order': order.id,
            'amount': '500',
            'payment_method': 'CASH'
        })
        
        assert serializer.is_valid()
        payment = serializer.save()
        
        assert payment.payment_date is not None
        assert payment.payment_date == timezone.localdate()


@pytest.mark.django_db
class TestOrderDetailCreateSerializerValidations:
    """Tests para validaciones de OrderDetailCreateSerializer"""
    
    def test_validate_product_availability_success(self):
        """Test validar disponibilidad de producto exitosamente"""
        from unittest.mock import patch
        
        with patch('ventas.services.InventoryService.check_product_availability') as mock_check:
            mock_check.return_value = {
                'success': True,
                'available': True,
                'current_quantity': 100,
                'product_name': 'Producto Test'
            }
            
            serializer = OrderDetailCreateSerializer(data={
                'product_id': 1,
                'quantity': 10,
                'unit_price': '1000',
                'discount': '0'
            })
            
            assert serializer.is_valid()
    
    def test_validate_product_no_stock(self):
        """Test validar producto sin stock"""
        from unittest.mock import patch
        
        with patch('ventas.services.InventoryService.check_product_availability') as mock_check:
            mock_check.return_value = {
                'success': True,
                'available': False,
                'current_quantity': 0,
                'product_name': 'Producto Test'
            }
            
            serializer = OrderDetailCreateSerializer(data={
                'product_id': 1,
                'quantity': 10,
                'unit_price': '1000'
            })
            
            with pytest.raises(ValidationError) as exc_info:
                serializer.is_valid(raise_exception=True)
            
            assert 'product_id' in exc_info.value.detail
            assert 'no tiene stock' in str(exc_info.value.detail['product_id'][0]).lower()
    
    def test_validate_product_insufficient_stock(self):
        """Test validar producto con stock insuficiente"""
        from unittest.mock import patch
        
        with patch('ventas.services.InventoryService.check_product_availability') as mock_check:
            mock_check.return_value = {
                'success': True,
                'available': False,
                'current_quantity': 5,
                'product_name': 'Producto Test'
            }
            
            serializer = OrderDetailCreateSerializer(data={
                'product_id': 1,
                'quantity': 10,
                'unit_price': '1000'
            })
            
            with pytest.raises(ValidationError) as exc_info:
                serializer.is_valid(raise_exception=True)
            
            assert 'quantity' in exc_info.value.detail
            assert '5 unidades disponibles' in str(exc_info.value.detail['quantity'][0])
    
    def test_validate_product_service_error(self):
        """Test error al verificar producto"""
        from unittest.mock import patch
        
        with patch('ventas.services.InventoryService.check_product_availability') as mock_check:
            mock_check.return_value = {
                'success': False,
                'error': 'Service unavailable'
            }
            
            serializer = OrderDetailCreateSerializer(data={
                'product_id': 1,
                'quantity': 10,
                'unit_price': '1000'
            })
            
            with pytest.raises(ValidationError) as exc_info:
                serializer.is_valid(raise_exception=True)
            
            assert 'product_id' in exc_info.value.detail


@pytest.mark.django_db
class TestOrderSerializerCreateUpdate:
    """Tests para creación y actualización de órdenes"""
    
    def test_create_order_without_details(self):
        """Test crear orden sin detalles"""
        from unittest.mock import patch
        
        with patch('ventas.serializers.EventPublisher') as mock_publisher:
            mock_instance = mock_publisher.return_value
            
            serializer = OrderSerializer(data={
                'customer_id': 1,
                'status': 'PENDING',
                'order_date': '2025-10-31'
            })
            
            assert serializer.is_valid()
            order = serializer.save()
            
            assert order.total == Decimal('0')
            assert order.customer_id == 1
    
    def test_create_order_with_details(self):
        """Test crear orden con detalles"""
        from unittest.mock import patch
        
        with patch('ventas.serializers.EventPublisher') as mock_publisher:
            mock_instance = mock_publisher.return_value
            
            with patch('ventas.services.InventoryService.check_product_availability') as mock_check:
                mock_check.return_value = {
                    'success': True,
                    'available': True,
                    'current_quantity': 100
                }
                
                serializer = OrderSerializer(data={
                    'customer_id': 1,
                    'status': 'PENDING',
                    'details': [
                        {
                            'product_id': 1,
                            'quantity': 2,
                            'unit_price': '500',
                            'discount': '0'
                        }
                    ]
                })
                
                assert serializer.is_valid()
                order = serializer.save()
                
                assert order.total == Decimal('1000')
                assert order.details.count() == 1
    
    def test_update_order_status_publishes_event(self):
        """Test actualizar estado de orden publica evento"""
        from unittest.mock import patch
        
        order = Order.objects.create(
            customer_id=1,
            order_date=timezone.now().date(),
            status='PENDING',
            total=Decimal('1000')
        )
        
        with patch('ventas.serializers.EventPublisher') as mock_publisher:
            mock_instance = mock_publisher.return_value
            
            serializer = OrderSerializer(order, data={
                'status': 'COMPLETED'
            }, partial=True)
            
            assert serializer.is_valid()
            serializer.save()
            
            # Verificar que se publicó evento de orden completada
            assert mock_instance.publish_order_completed.called or mock_instance.publish_order_updated.called
