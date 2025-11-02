"""
Tests para RobustServiceClient (cliente HTTP robusto).
"""
import pytest
from unittest.mock import patch, Mock
import requests
from ventas.service_client import RobustServiceClient


class TestRobustServiceClient:
    """Tests para RobustServiceClient."""

    def test_get_request_success(self):
        """
        Test: solicitud GET exitosa con reintentos.
        """
        with patch('requests.Session.get') as mock_get:
            # Mock respuesta exitosa
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {'data': 'success'}
            mock_get.return_value = mock_response
            
            client = RobustServiceClient(
                base_url='http://test-api.com',
                service_name='test-service'
            )
            result = client.get('/endpoint', params={'id': 1})
            
            assert result == {'data': 'success'}
            assert mock_get.call_count == 1

    def test_post_request_success(self):
        """
        Test: solicitud POST exitosa.
        """
        with patch('requests.Session.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 201
            mock_response.json.return_value = {'id': 123}
            mock_post.return_value = mock_response
            
            client = RobustServiceClient(
                base_url='http://test-api.com',
                service_name='test-service'
            )
            result = client.post('/create', data={'name': 'test'})
            
            assert result == {'id': 123}
            assert mock_post.call_count == 1
