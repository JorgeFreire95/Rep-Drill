#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_auth.settings')
django.setup()

from django.contrib.auth import get_user_model
from authentication.models import Role

User = get_user_model()

# Obtener o crear el rol de admin
admin_role, created = Role.objects.get_or_create(
    name='admin',
    defaults={
        'description': 'Administrador del sistema',
        'is_active': True
    }
)

if not User.objects.filter(email='admin@repdrill.com').exists():
    user = User.objects.create_superuser(
        email='admin@repdrill.com',
        password='admin123',
        first_name='Admin',
        last_name='RepDrill',
        role=admin_role
    )
    print(f'Superusuario creado exitosamente: {user.email}')
else:
    print('El usuario admin@repdrill.com ya existe.')

