"""
Tests básicos para el servicio de personas
"""
import pytest
from rest_framework.test import APIClient
from rest_framework import status
from personas.models import Persona


@pytest.fixture
def api_client():
    """Cliente API para tests"""
    return APIClient()


@pytest.fixture
def sample_persona(db):
    """Persona de prueba"""
    return Persona.objects.create(
        nombre='Juan Pérez',
        tipo_documento='DNI',
        numero_documento='12345678',
        email='juan@example.com',
        telefono='987654321',
        direccion='Av. Principal 123',
        es_cliente=True,
        es_proveedor=False
    )


class TestPersonasAPI:
    """Tests para endpoints de personas"""
    
    def test_list_personas(self, api_client, sample_persona):
        """Test listar personas"""
        response = api_client.get('/api/personas/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
    
    def test_create_persona(self, api_client):
        """Test crear nueva persona"""
        data = {
            'nombre': 'María García',
            'tipo_documento': 'DNI',
            'numero_documento': '87654321',
            'email': 'maria@example.com',
            'telefono': '912345678',
            'direccion': 'Calle Secundaria 456',
            'es_cliente': True,
            'es_proveedor': False
        }
        
        response = api_client.post('/api/personas/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['nombre'] == 'María García'
        assert response.data['numero_documento'] == '87654321'
    
    def test_retrieve_persona(self, api_client, sample_persona):
        """Test obtener persona por ID"""
        response = api_client.get(f'/api/personas/{sample_persona.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['nombre'] == 'Juan Pérez'
    
    def test_update_persona(self, api_client, sample_persona):
        """Test actualizar persona"""
        data = {
            'nombre': 'Juan Pérez Actualizado',
            'tipo_documento': 'DNI',
            'numero_documento': '12345678',
            'email': 'juan.updated@example.com',
            'telefono': '987654321',
            'direccion': 'Nueva Dirección 789',
            'es_cliente': True,
            'es_proveedor': True
        }
        
        response = api_client.put(f'/api/personas/{sample_persona.id}/', data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['nombre'] == 'Juan Pérez Actualizado'
        assert response.data['es_proveedor'] is True
    
    def test_delete_persona(self, api_client, sample_persona):
        """Test eliminar persona"""
        response = api_client.delete(f'/api/personas/{sample_persona.id}/')
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verificar que ya no existe
        assert not Persona.objects.filter(id=sample_persona.id).exists()
    
    def test_search_by_phone(self, api_client, sample_persona):
        """Test buscar persona por teléfono"""
        response = api_client.get('/api/personas/', {'phone': '987654321'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
        assert response.data['results'][0]['telefono'] == '987654321'
    
    def test_search_by_email(self, api_client, sample_persona):
        """Test buscar persona por email"""
        response = api_client.get('/api/personas/', {'email': 'juan@example.com'})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) > 0
        assert response.data['results'][0]['email'] == 'juan@example.com'


class TestPersonaModel:
    """Tests para el modelo Persona"""
    
    def test_create_cliente(self, db):
        """Test crear cliente"""
        cliente = Persona.objects.create(
            nombre='Cliente Test',
            tipo_documento='RUC',
            numero_documento='20123456789',
            email='cliente@test.com',
            es_cliente=True,
            es_proveedor=False
        )
        
        assert cliente.nombre == 'Cliente Test'
        assert cliente.es_cliente is True
        assert cliente.es_proveedor is False
    
    def test_create_proveedor(self, db):
        """Test crear proveedor"""
        proveedor = Persona.objects.create(
            nombre='Proveedor Test',
            tipo_documento='RUC',
            numero_documento='20987654321',
            email='proveedor@test.com',
            es_cliente=False,
            es_proveedor=True
        )
        
        assert proveedor.es_proveedor is True
        assert proveedor.es_cliente is False
    
    def test_str_representation(self, sample_persona):
        """Test representación en string del modelo"""
        assert str(sample_persona) == 'Juan Pérez (DNI: 12345678)'
