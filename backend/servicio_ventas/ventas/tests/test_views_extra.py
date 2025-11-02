import pytest
from unittest.mock import patch, Mock
from rest_framework.test import APIClient
from django.urls import reverse
from ventas.models import Order


@pytest.mark.django_db
class TestViewsExtra:
    def setup_method(self):
        self.client = APIClient()

    def test_customer_history_missing_customer_id(self):
        url = '/api/ventas/orders/customer_history/'
        resp = self.client.get(url)
        assert resp.status_code == 400
        assert 'customer_id is required' in resp.data.get('error', '')

    def test_customer_history_invalid_limit(self):
        url = '/api/ventas/orders/customer_history/?customer_id=1&limit=abc'
        resp = self.client.get(url)
        assert resp.status_code == 400
        assert 'Invalid parameter' in resp.data.get('error', '')

    def test_create_order_missing_customer_id(self):
        url = '/api/ventas/orders/create_order/'
        resp = self.client.post(url, data={}, format='json')
        assert resp.status_code == 400
        assert 'customer_id is required' in resp.data.get('error', '')

    def test_create_order_missing_details(self):
        url = '/api/ventas/orders/create_order/'
        payload = {'customer_id': 1, 'details': []}
        resp = self.client.post(url, data=payload, format='json')
        assert resp.status_code == 400
        assert 'At least one product detail is required' in resp.data.get('error', '')

    def test_create_order_missing_fields_in_detail(self):
        url = '/api/ventas/orders/create_order/'
        payload = {'customer_id': 1, 'details': [{'product_id': 1, 'quantity': 2}]}
        resp = self.client.post(url, data=payload, format='json')
        assert resp.status_code == 400
        assert 'product_id, quantity, and unit_price are required' in resp.data.get('error', '')

    def test_create_order_success(self):
        url = '/api/ventas/orders/create_order/'
        payload = {
            'customer_id': 10,
            'details': [
                {'product_id': 101, 'quantity': 2, 'unit_price': 1000},
                {'product_id': 102, 'quantity': 1, 'unit_price': 500},
            ]
        }
        resp = self.client.post(url, data=payload, format='json')
        assert resp.status_code == 201
        assert resp.data['status'] == 'created'
        assert resp.data['items_count'] == 2

    def test_dashboard_stats(self):
        url = '/api/ventas/dashboard/stats/'
        resp = self.client.get(url)
        assert resp.status_code == 200
        assert 'ventas_hoy' in resp.data
        assert 'ventas_diarias' in resp.data

    def test_check_product_availability_no_products(self):
        url = '/api/ventas/check-availability/'
        resp = self.client.post(url, data={'products': []}, format='json')
        assert resp.status_code == 400

    def test_check_product_availability_with_products(self):
        url = '/api/ventas/check-availability/'
        with patch('ventas.services.InventoryService.check_product_availability') as mock_check:
            mock_check.side_effect = [
                {'product_id': 1, 'available': True, 'available_quantity': 10},
                {'product_id': 2, 'available': False, 'available_quantity': 0},
            ]
            resp = self.client.post(url, data={'products': [
                {'product_id': 1, 'quantity': 2},
                {'product_id': 2, 'quantity': 5},
            ]}, format='json')
            assert resp.status_code == 200
            data = resp.data
            assert data['all_available'] is False
            assert len(data['products']) == 2

    def test_process_order_payment_manually_not_found(self):
        url = '/api/ventas/orders/9999/process-payment/'
        resp = self.client.post(url, data={}, format='json')
        assert resp.status_code == 404

    def test_order_payment_status_not_found(self):
        url = '/api/ventas/orders/9999/payment-status/'
        resp = self.client.get(url)
        assert resp.status_code == 404

    def test_validate_stock_empty_items(self):
        url = '/api/ventas/validate-stock/'
        resp = self.client.post(url, data={'items': []}, format='json')
        assert resp.status_code == 400

    def test_validate_stock_with_products(self):
        url = '/api/ventas/validate-stock/'
        products_payload = [
            {'id': 1, 'name': 'Prod A', 'sku': 'A001', 'quantity': 10, 'min_stock': 2, 'reorder_quantity': 1, 'price': 1000, 'cost_price': 700, 'profit_margin': 42.8},
            {'id': 2, 'name': 'Prod B', 'sku': 'B001', 'quantity': 3, 'min_stock': 5, 'reorder_quantity': 4, 'price': 2000, 'cost_price': 1500, 'profit_margin': 33.3},
        ]
        with patch('requests.get') as mock_get:
            mock_resp = Mock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = products_payload
            mock_get.return_value = mock_resp

            payload = {'items': [
                {'product_id': 1, 'quantity': 2},  # in_stock
                {'product_id': 2, 'quantity': 5},  # out_of_stock (3 < 5)
            ]}
            resp = self.client.post(url, data=payload, format='json')
            assert resp.status_code == 200
            data = resp.data
            assert data['summary']['total_items'] == 2
            assert any(i['status'] in ('in_stock', 'out_of_stock', 'partial') for i in data['items'])
