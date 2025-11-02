"""
Tests básicos para el servicio de autenticación
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


@pytest.fixture
def api_client():
    """Cliente API para tests"""
    return APIClient()


@pytest.fixture
def test_user(db):
    """Usuario de prueba"""
    return User.objects.create_user(
        email='test@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User'
    )


class TestAuthenticationAPI:
    """Tests para endpoints de autenticación"""
    
    def test_register_user(self, api_client):
        """Test registro de nuevo usuario"""
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'securepass123',
            'first_name': 'New',
            'last_name': 'User'
        }
        
        response = api_client.post('/api/auth/register/', data, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert response.data['user']['username'] == 'newuser'
    
    def test_login_user(self, api_client, test_user):
        """Test login con credenciales válidas"""
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        
        response = api_client.post('/api/auth/login/', data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
    
    def test_login_invalid_credentials(self, api_client, test_user):
        """Test login con credenciales inválidas"""
        data = {
            'username': 'testuser',
            'password': 'wrongpassword'
        }
        
        response = api_client.post('/api/auth/login/', data, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_current_user(self, api_client, test_user):
        """Test obtener usuario actual autenticado"""
        api_client.force_authenticate(user=test_user)
        
        response = api_client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == 'testuser'
        assert response.data['email'] == 'test@example.com'
    
    def test_get_current_user_unauthenticated(self, api_client):
        """Test obtener usuario sin autenticación"""
        response = api_client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_refresh_token(self, api_client, test_user):
        """Test renovar token JWT"""
        # Primero hacer login
        login_data = {
            'username': 'testuser',
            'password': 'testpass123'
        }
        login_response = api_client.post('/api/auth/login/', login_data, format='json')
        refresh_token = login_response.data['refresh']
        
        # Renovar token
        refresh_data = {'refresh': refresh_token}
        response = api_client.post('/api/auth/token/refresh/', refresh_data, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data


class TestUserModel:
    """Tests para el modelo de usuario"""
    
    def test_create_user(self, db):
        """Test crear usuario básico"""
        user = User.objects.create_user(
            email='test2@example.com',
            password='password123',
            first_name='Test',
            last_name='User'
        )
        
        assert user.email == 'test2@example.com'
        assert user.check_password('password123')
        assert not user.is_staff
        assert not user.is_superuser
    
    def test_create_superuser(self, db):
        """Test crear superusuario"""
        admin = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpass123',
            first_name='Admin',
            last_name='User'
        )
        
        assert admin.is_staff
        assert admin.is_superuser
        assert admin.is_active
