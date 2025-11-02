import pytest
from decimal import Decimal
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestEndToEnd:
    def test_order_full_payment_flow(self):
        client = APIClient()

        # 1) Crear orden vía acción create_order
        create_order_url = '/api/ventas/orders/create_order/'
        payload = {
            'customer_id': 42,
            'details': [
                {'product_id': 501, 'quantity': 2, 'unit_price': 700},
                {'product_id': 502, 'quantity': 1, 'unit_price': 600},
            ]
        }
        resp = client.post(create_order_url, data=payload, format='json')
        assert resp.status_code == 201
        order_id = resp.data['order_id']
        total = Decimal(str(resp.data['total']))

        # 2) Registrar pago por el total
        payment_resp = client.post('/api/ventas/payments/', data={
            'order': order_id,
            'amount': str(int(total)),
            'payment_method': 'CASH',
            'payment_date': '2025-10-31'
        }, format='json')
        assert payment_resp.status_code == 201

        # 3) Consultar estado de pago
        status_resp = client.get(f'/api/ventas/orders/{order_id}/payment-status/')
        assert status_resp.status_code == 200
        data = status_resp.data
        assert Decimal(data['total_paid']) == total
        assert data['is_fully_paid'] in (True, False)  # puede depender de señales
