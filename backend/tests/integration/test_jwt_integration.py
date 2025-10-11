"""
Tests de integración para JWT entre microservicios.
Verifica que el token JWT funcione correctamente en todos los servicios.
"""
import pytest
import requests


@pytest.mark.jwt
@pytest.mark.integration
class TestJWTIntegration:
    """Suite de tests para verificar la integración JWT entre servicios."""
    
    def test_obtain_jwt_token(self, services_config, admin_credentials, wait_for_services):
        """Verifica que se pueda obtener un token JWT del servicio de auth."""
        url = f"{services_config['auth']['base_url']}/api/v1/auth/token/"
        
        response = requests.post(
            url,
            json=admin_credentials,
            timeout=10
        )
        
        assert response.status_code == 200, f"Failed to obtain token: {response.text}"
        
        data = response.json()
        
        # Verificar que el response contenga los campos esperados
        assert 'access' in data, "Response doesn't contain access token"
        assert 'refresh' in data, "Response doesn't contain refresh token"
        assert 'user' in data, "Response doesn't contain user data"
        
        # Verificar datos del usuario
        user = data['user']
        assert 'email' in user
        assert user['email'] == admin_credentials['email']
        assert 'permissions' in user
        assert len(user['permissions']) > 0, "User should have permissions"
        
        # Verificar que el token sea una cadena no vacía
        assert isinstance(data['access'], str)
        assert len(data['access']) > 50  # Los JWT son largos
    
    def test_jwt_token_structure(self, auth_response_data):
        """Verifica la estructura del token JWT y sus claims."""
        import base64
        import json
        
        token = auth_response_data['access']
        
        # JWT tiene 3 partes separadas por puntos
        parts = token.split('.')
        assert len(parts) == 3, "JWT should have 3 parts (header.payload.signature)"
        
        # Decodificar el payload (parte 2)
        # Agregar padding si es necesario
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload_json = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_json)
        
        # Verificar claims esperados
        assert 'user_id' in payload or 'sub' in payload, "Token should contain user ID"
        assert 'exp' in payload, "Token should have expiration time"
        assert 'iat' in payload, "Token should have issued at time"
        assert 'email' in payload, "Token should contain email"
        assert 'permissions' in payload, "Token should contain permissions"
        assert 'role' in payload, "Token should contain role"
        
        # Verificar que hay permisos
        assert len(payload['permissions']) > 0
    
    def test_jwt_works_on_personas_service(self, services_config, auth_headers, wait_for_services):
        """Verifica que el JWT funcione en el servicio de personas."""
        url = f"{services_config['personas']['base_url']}/api/personas/customers/"
        
        response = requests.get(
            url,
            headers=auth_headers,
            timeout=10
        )
        
        # Debería permitir el acceso con token válido
        assert response.status_code in [200, 404], \
            f"Expected 200 or 404, got {response.status_code}: {response.text}"
    
    def test_jwt_works_on_inventario_service(self, services_config, auth_headers, wait_for_services):
        """Verifica que el JWT funcione en el servicio de inventario."""
        url = f"{services_config['inventario']['base_url']}/api/inventario/inventory/"
        
        response = requests.get(
            url,
            headers=auth_headers,
            timeout=10
        )
        
        assert response.status_code in [200, 404], \
            f"Expected 200 or 404, got {response.status_code}: {response.text}"
    
    def test_jwt_works_on_ventas_service(self, services_config, auth_headers, wait_for_services):
        """Verifica que el JWT funcione en el servicio de ventas."""
        url = f"{services_config['ventas']['base_url']}/api/ventas/orders/"
        
        response = requests.get(
            url,
            headers=auth_headers,
            timeout=10
        )
        
        assert response.status_code in [200, 404], \
            f"Expected 200 or 404, got {response.status_code}: {response.text}"
    
    def test_jwt_works_across_all_services(self, services_config, auth_token, wait_for_services):
        """Verifica que el MISMO token JWT funcione en TODOS los servicios."""
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }
        
        endpoints = {
            'personas': f"{services_config['personas']['base_url']}/api/personas/customers/",
            'inventario': f"{services_config['inventario']['base_url']}/api/inventario/inventory/",
            'ventas': f"{services_config['ventas']['base_url']}/api/ventas/orders/"
        }
        
        results = {}
        
        for service_name, url in endpoints.items():
            response = requests.get(url, headers=headers, timeout=10)
            results[service_name] = response.status_code
        
        # Todos deberían devolver 200 o 404 (no 401 Unauthorized)
        for service_name, status_code in results.items():
            assert status_code in [200, 404], \
                f"{service_name} returned {status_code}, expected 200 or 404. Results: {results}"
    
    def test_request_without_token_fails(self, services_config, wait_for_services):
        """Verifica que las requests sin token sean rechazadas."""
        endpoints = {
            'personas': f"{services_config['personas']['base_url']}/api/personas/customers/",
            'inventario': f"{services_config['inventario']['base_url']}/api/inventario/inventory/",
            'ventas': f"{services_config['ventas']['base_url']}/api/ventas/orders/"
        }
        
        for service_name, url in endpoints.items():
            response = requests.get(url, timeout=10)
            
            # Debería devolver 401 Unauthorized
            assert response.status_code == 401, \
                f"{service_name} should return 401 without token, got {response.status_code}"
    
    def test_request_with_invalid_token_fails(self, services_config, wait_for_services):
        """Verifica que tokens inválidos sean rechazados."""
        invalid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        
        headers = {
            'Authorization': f'Bearer {invalid_token}',
            'Content-Type': 'application/json'
        }
        
        endpoints = {
            'personas': f"{services_config['personas']['base_url']}/api/personas/customers/",
            'inventario': f"{services_config['inventario']['base_url']}/api/inventario/inventory/",
            'ventas': f"{services_config['ventas']['base_url']}/api/ventas/orders/"
        }
        
        for service_name, url in endpoints.items():
            response = requests.get(url, headers=headers, timeout=10)
            
            # Debería devolver 401 Unauthorized
            assert response.status_code == 401, \
                f"{service_name} should reject invalid token, got {response.status_code}"
    
    def test_token_permissions_included(self, auth_response_data):
        """Verifica que el token incluya los permisos del usuario."""
        user = auth_response_data['user']
        permissions = user['permissions']
        
        # Verificar que hay permisos configurados
        assert len(permissions) >= 10, f"Expected at least 10 permissions, got {len(permissions)}"
        
        # Verificar algunos permisos esperados del admin
        expected_permissions = [
            'create_customers',
            'read_customers',
            'update_customers',
            'delete_customers',
            'create_products',
            'read_products',
            'create_sales',
            'read_sales'
        ]
        
        for expected in expected_permissions:
            assert expected in permissions, \
                f"Admin should have '{expected}' permission. Found: {permissions}"
    
    def test_refresh_token_works(self, services_config, auth_response_data, wait_for_services):
        """Verifica que el refresh token funcione correctamente."""
        refresh_url = f"{services_config['auth']['base_url']}/api/v1/auth/token/refresh/"
        
        response = requests.post(
            refresh_url,
            json={'refresh': auth_response_data['refresh']},
            timeout=10
        )
        
        assert response.status_code == 200, f"Refresh token failed: {response.text}"
        
        data = response.json()
        assert 'access' in data, "Refresh response should contain new access token"
        
        # El nuevo token debería ser diferente del original
        assert data['access'] != auth_response_data['access'], \
            "New access token should be different from original"
