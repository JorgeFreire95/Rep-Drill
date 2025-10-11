import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_auth.settings')
django.setup()

from authentication.models import User, Role

print("=" * 60)
print("👤 Creando Usuario Vendedor")
print("=" * 60)

# Obtener rol de vendedor
try:
    vendedor_role = Role.objects.get(name='employee')
    print(f"\n✅ Rol encontrado: {vendedor_role.get_name_display()}")
except Role.DoesNotExist:
    print("\n❌ Error: El rol 'employee' no existe.")
    print("   Ejecuta primero: python setup_roles_permissions.py")
    exit(1)

# Datos del vendedor
email = 'vendedor@repdrill.com'
password = 'vendedor123'
first_name = 'Juan'
last_name = 'Vendedor'

# Verificar si el usuario ya existe
if User.objects.filter(email=email).exists():
    print(f"\n⚠️  El usuario {email} ya existe.")
    user = User.objects.get(email=email)
    # Actualizar rol si es necesario
    if user.role != vendedor_role:
        user.role = vendedor_role
        user.save()
        print(f"✅ Rol actualizado a: {vendedor_role.get_name_display()}")
    else:
        print(f"✅ Ya tiene el rol: {vendedor_role.get_name_display()}")
else:
    # Crear nuevo usuario vendedor
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role=vendedor_role,
        is_active=True,
        is_verified=True
    )
    print(f"\n✅ Usuario vendedor creado exitosamente!")

# Mostrar información
print("\n" + "=" * 60)
print("📋 INFORMACIÓN DEL USUARIO VENDEDOR")
print("=" * 60)
print(f"\n📧 Email: {user.email}")
print(f"🔑 Password: {password}")
print(f"👤 Nombre: {user.full_name}")
print(f"🎭 Rol: {user.role.get_name_display()}")
print(f"✅ Activo: {'Sí' if user.is_active else 'No'}")
print(f"✅ Verificado: {'Sí' if user.is_verified else 'No'}")

# Mostrar permisos
permisos = user.get_user_permissions()
print(f"\n🔐 Permisos ({len(permisos)}):")
for perm in sorted(permisos):
    print(f"   • {perm}")

print("\n" + "=" * 60)
print("✅ ¡Usuario vendedor listo para usar!")
print("=" * 60)

print("\n🎯 Puedes hacer login con:")
print(f"   Email: {email}")
print(f"   Password: {password}")
print("\n📍 En: http://127.0.0.1:8003/api/v1/auth/")
