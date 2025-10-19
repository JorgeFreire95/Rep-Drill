"""
Tests de integración para Health Check endpoints.
Verifica que todos los servicios estén saludables y respondiendo correctamente.
"""
import pytest
import requests


@pytest.mark.health
@pytest.mark.integration
class TestHealthChecks:
    """Suite de tests para verificar health checks de todos los servicios."""
    
    def test_auth_service_health(self, services_config, wait_for_services):
        """Verifica que el servicio de autenticación esté saludable."""
        url = f"{services_config['auth']['base_url']}/health/"
        
        response = requests.get(url, timeout=5)
        
        assert response.status_code == 200, \
            f"Auth service health check failed with status {response.status_code}"
        
        # Verificar que el contenido no esté vacío
        assert len(response.content) > 0, "Health check response is empty"
    
    def test_personas_service_health(self, services_config, wait_for_services):
        """Verifica que el servicio de personas esté saludable."""
        url = f"{services_config['personas']['base_url']}/health/"
        
        response = requests.get(url, timeout=5)
        
        assert response.status_code == 200, \
            f"Personas service health check failed with status {response.status_code}"
        assert len(response.content) > 0
    
    def test_inventario_service_health(self, services_config, wait_for_services):
        """Verifica que el servicio de inventario esté saludable."""
        url = f"{services_config['inventario']['base_url']}/health/"
        
        response = requests.get(url, timeout=5)
        
        assert response.status_code == 200, \
            f"Inventario service health check failed with status {response.status_code}"
        assert len(response.content) > 0
    
    def test_ventas_service_health(self, services_config, wait_for_services):
        """Verifica que el servicio de ventas esté saludable."""
        url = f"{services_config['ventas']['base_url']}/health/"
        
        response = requests.get(url, timeout=5)
        
        assert response.status_code == 200, \
            f"Ventas service health check failed with status {response.status_code}"
        assert len(response.content) > 0
    
    def test_all_services_health(self, services_config, wait_for_services):
        """Verifica que TODOS los servicios estén saludables simultáneamente."""
        results = {}
        
        for service_name, config in services_config.items():
            url = f"{config['base_url']}/health/"
            
            try:
                response = requests.get(url, timeout=5)
                results[service_name] = {
                    'status_code': response.status_code,
                    'healthy': response.status_code == 200
                }
            except requests.exceptions.RequestException as e:
                results[service_name] = {
                    'status_code': None,
                    'healthy': False,
                    'error': str(e)
                }
        
        # Verificar que todos estén saludables
        unhealthy_services = [
            name for name, result in results.items() 
            if not result['healthy']
        ]
        
        assert len(unhealthy_services) == 0, \
            f"Los siguientes servicios no están saludables: {unhealthy_services}\nResultados: {results}"
    
    def test_health_check_response_time(self, services_config, wait_for_services):
        """Verifica que los health checks respondan en menos de 3 segundos."""
        import time
        
        for service_name, config in services_config.items():
            url = f"{config['base_url']}/health/"
            
            start_time = time.time()
            response = requests.get(url, timeout=5)
            elapsed_time = time.time() - start_time
            
            assert response.status_code == 200
            assert elapsed_time < 3.0, \
                f"{config['name']} health check took {elapsed_time:.2f}s (should be < 3s)"
