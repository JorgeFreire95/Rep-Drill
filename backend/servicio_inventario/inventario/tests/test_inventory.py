"""
Tests básicos para el servicio de inventario
"""
import pytest
from rest_framework.test import APIClient
from rest_framework import status
from inventario.models import Product, Category, Warehouse


@pytest.fixture
def api_client():
    """Cliente API para tests"""
    return APIClient()


@pytest.fixture
def sample_category(db):
    """Categoría de prueba"""
    return Category.objects.create(
        name='Electrónicos',
        description='Productos electrónicos'
    )


@pytest.fixture
def sample_warehouse(db):
    """Bodega de prueba"""
    return Warehouse.objects.create(
        name='Almacén Central',
        location='Lima, Perú'
    )


@pytest.fixture
def sample_product(db, sample_category, sample_warehouse):
    """Producto de prueba"""
    return Product.objects.create(
        sku='PROD-001',
        name='Laptop HP',
        description='Laptop HP Pavilion 15',
        category=sample_category,
        warehouse=sample_warehouse,
        price=2500.00,
        cost_price=2000.00,
        quantity=10,
        min_stock=5
    )


class TestProductsAPI:
    """Tests para endpoints de productos"""
    
    def test_list_products(self, api_client, sample_product):
        """Test listar productos"""
        response = api_client.get('/api/products/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
    
    def test_create_product(self, api_client, sample_category, sample_warehouse):
        """Test crear nuevo producto"""
        data = {
            'sku': 'PROD-002',
            'name': 'Mouse Logitech',
            'description': 'Mouse inalámbrico',
            'category': sample_category.id,
            'warehouse': sample_warehouse.id,
            'price': 50.00,
            'cost_price': 30.00,
            'quantity': 100,
            'min_stock': 20
        }
        
        response = api_client.post('/api/products/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['sku'] == 'PROD-002'
        assert response.data['name'] == 'Mouse Logitech'
    
    def test_retrieve_product(self, api_client, sample_product):
        """Test obtener producto por ID"""
        response = api_client.get(f'/api/products/{sample_product.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['sku'] == 'PROD-001'
    
    def test_update_product_quantity(self, api_client, sample_product):
        """Test actualizar cantidad de producto"""
        data = {
            'sku': 'PROD-001',
            'name': 'Laptop HP',
            'description': 'Laptop HP Pavilion 15',
            'category': sample_product.category.id,
            'warehouse': sample_product.warehouse.id,
            'price': 2500.00,
            'cost_price': 2000.00,
            'quantity': 15,  # Actualizado
            'min_stock': 5
        }
        
        response = api_client.put(f'/api/products/{sample_product.id}/', data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['quantity'] == 15
    
    def test_low_stock_alert(self, api_client, sample_product):
        """Test alerta de stock bajo"""
        # Reducir stock por debajo del mínimo
        sample_product.quantity = 3
        sample_product.save()
        
        response = api_client.get('/api/products/low_stock/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
    
    def test_delete_product(self, api_client, sample_product):
        """Test eliminar producto"""
        response = api_client.delete(f'/api/products/{sample_product.id}/')
        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestCategoriesAPI:
    """Tests para endpoints de categorías"""
    
    def test_list_categories(self, api_client, sample_category):
        """Test listar categorías"""
        response = api_client.get('/api/categories/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) > 0
    
    def test_create_category(self, api_client):
        """Test crear categoría"""
        data = {
            'name': 'Muebles',
            'description': 'Muebles de oficina'
        }
        
        response = api_client.post('/api/categories/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Muebles'


class TestWarehousesAPI:
    """Tests para endpoints de bodegas"""
    
    def test_list_warehouses(self, api_client, sample_warehouse):
        """Test listar bodegas"""
        response = api_client.get('/api/warehouses/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) > 0
    
    def test_create_warehouse(self, api_client):
        """Test crear bodega"""
        data = {
            'name': 'Almacén Norte',
            'location': 'Trujillo, Perú'
        }
        
        response = api_client.post('/api/warehouses/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Almacén Norte'
