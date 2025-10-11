import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_auth.settings')
django.setup()

from authentication.models import User

email = 'admin@repdrill.com'
password = 'admin123'  # Cambiar en producción

if User.objects.filter(email=email).exists():
    print(f"✅ El usuario {email} ya existe.")
else:
    user = User.objects.create_superuser(
        email=email,
        password=password,
        first_name='Admin',
        last_name='RepDrill'
    )
    print(f"✅ Superusuario creado exitosamente!")
    print(f"   Email: {email}")
    print(f"   Password: {password}")
    print(f"\n⚠️  IMPORTANTE: Cambia la contraseña después del primer login!")
