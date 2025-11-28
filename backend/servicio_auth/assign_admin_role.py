from authentication.models import Role, User

# Create admin role
admin_role, created = Role.objects.get_or_create(
    name='admin',
    defaults={'description': 'Administrador del sistema'}
)

if created:
    print('✅ Role admin creado')
else:
    print('✅ Role admin ya existe')

# Assign role to superuser
user = User.objects.get(email='admin@example.com')
user.role = admin_role
user.save()

print(f'✅ Role "{admin_role.name}" asignado a {user.email}')
print(f'Usuario: {user.full_name}')
print(f'  - is_staff: {user.is_staff}')
print(f'  - is_superuser: {user.is_superuser}')
print(f'  - is_verified: {user.is_verified}')
print(f'  - role: {user.role.name if user.role else None}')
