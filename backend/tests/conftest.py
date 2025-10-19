"""
Configuración compartida de pytest para tests de integración de Rep Drill.
"""
import pytest
import requests
import time
from typing import Dict, Any


# Configuración de servicios
SERVICES = {
    'auth': {
        'base_url': 'http://localhost:8003',
        'name': 'Authentication Service'
    },
    'personas': {
        'base_url': 'http://localhost:8000',
        'name': 'Personas Service'
    },
    'inventario': {
        'base_url': 'http://localhost:8001',
        'name': 'Inventario Service'
    },
    'ventas': {
        'base_url': 'http://localhost:8002',
        'name': 'Ventas Service'
    }
}


@pytest.fixture(scope="session")
def services_config():
    """Retorna la configuración de todos los servicios."""
    return SERVICES


@pytest.fixture(scope="session")
def wait_for_services(services_config):
    """
    Espera a que todos los servicios estén disponibles antes de ejecutar tests.
    Intenta conectarse a cada servicio con reintentos.
    """
    max_retries = 30
    retry_delay = 2  # segundos
    
    print("\n🔄 Esperando a que los servicios estén disponibles...")
    
    for service_name, config in services_config.items():
        url = f"{config['base_url']}/health/"
        
        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    print(f"✅ {config['name']} está disponible")
                    break
            except requests.exceptions.RequestException:
                if attempt < max_retries - 1:
                    print(f"⏳ Esperando {config['name']}... (intento {attempt + 1}/{max_retries})")
                    time.sleep(retry_delay)
                else:
                    pytest.fail(f"❌ {config['name']} no está disponible después de {max_retries} intentos")
    
    print("✅ Todos los servicios están disponibles\n")
    return True


@pytest.fixture(scope="session")
def admin_credentials():
    """Credenciales del usuario administrador para tests."""
    return {
        'email': 'admin@example.com',
        'password': 'admin123'
    }


@pytest.fixture(scope="function")
def auth_token(services_config, admin_credentials, wait_for_services):
    """
    Obtiene un token JWT válido del servicio de autenticación.
    Se ejecuta antes de cada test que lo requiera.
    """
    auth_url = f"{services_config['auth']['base_url']}/api/v1/auth/token/"
    
    response = requests.post(
        auth_url,
        json=admin_credentials,
        timeout=10
    )
    
    assert response.status_code == 200, f"Failed to get auth token: {response.text}"
    
    data = response.json()
    assert 'access' in data, "Response doesn't contain access token"
    
    return data['access']


@pytest.fixture(scope="function")
def auth_headers(auth_token):
    """
    Retorna headers HTTP con el token JWT para autenticación.
    """
    return {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }


@pytest.fixture(scope="function")
def auth_response_data(services_config, admin_credentials, wait_for_services):
    """
    Retorna la respuesta completa del login incluyendo información del usuario.
    """
    auth_url = f"{services_config['auth']['base_url']}/api/v1/auth/token/"
    
    response = requests.post(
        auth_url,
        json=admin_credentials,
        timeout=10
    )
    
    assert response.status_code == 200
    return response.json()


@pytest.fixture(scope="session")
def test_customer_data():
    """Datos de prueba para crear un cliente."""
    return {
        'name': 'Test Customer',
        'email': 'test.customer@example.com',
        'phone': '+56912345678',
        'address': 'Test Address 123'
    }


@pytest.fixture(scope="session")
def test_product_data():
    """Datos de prueba para crear un producto."""
    return {
        'name': 'Test Product',
        'description': 'Product for integration testing',
        'price': '99.99',
        'sku': 'TEST-SKU-001'
    }


@pytest.fixture(scope="session")
def test_order_data():
    """Datos de prueba para crear una orden."""
    return {
        'customer_id': 1,
        'total': 150.00,
        'status': 'pending'
    }


@pytest.fixture(scope="function")
def cleanup_test_data():
    """
    Fixture para limpiar datos de prueba después de cada test.
    Se puede expandir según necesidad.
    """
    created_resources = []
    
    yield created_resources
    
    # Aquí se podría agregar lógica para limpiar recursos creados
    # Por ejemplo, eliminar clientes, productos, órdenes de prueba
    pass


def pytest_configure(config):
    """
    Configuración inicial de pytest.
    """
    print("\n" + "="*70)
    print("🧪 REP DRILL - INTEGRATION TESTS")
    print("="*70)
    print("\n📋 Requisitos:")
    print("  • Todos los servicios deben estar corriendo en Docker")
    print("  • Base de datos PostgreSQL disponible")
    print("  • Puertos 8000-8003 disponibles")
    print("\n💡 Comando para levantar servicios:")
    print("  docker-compose -f docker-compose.dev.yml up -d")
    print("\n" + "="*70 + "\n")


def pytest_collection_modifyitems(config, items):
    """
    Modifica la colección de tests para agregar markers automáticamente.
    """
    for item in items:
        # Agregar marker 'integration' a todos los tests en el directorio integration/
        if "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        
        # Agregar marker 'jwt' a tests que usan auth_token
        if "auth_token" in item.fixturenames or "auth_headers" in item.fixturenames:
            item.add_marker(pytest.mark.jwt)


@pytest.fixture(scope="session", autouse=True)
def print_test_summary(request):
    """
    Imprime un resumen al final de todos los tests.
    """
    yield
    
    print("\n" + "="*70)
    print("✅ TESTS COMPLETADOS")
    print("="*70 + "\n")
