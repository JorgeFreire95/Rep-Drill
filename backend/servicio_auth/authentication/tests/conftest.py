"""
Configuración de pytest para servicio de autenticación
"""
import pytest
from django.conf import settings

pytest_plugins = []


@pytest.fixture(scope='session')
def django_db_setup():
    """Configuración de base de datos para tests"""
    settings.DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }


@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """Habilitar acceso a DB para todos los tests"""
    pass
