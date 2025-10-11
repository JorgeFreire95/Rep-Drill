import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_auth.settings')
django.setup()

from authentication.models import Role, Permission, RolePermission

print("=" * 60)
print("🔧 Configurando Roles y Permisos del Sistema")
print("=" * 60)

# ========================================
# 1. CREAR PERMISOS
# ========================================
print("\n📋 Creando Permisos...")

permisos_config = [
    # Usuarios
    {'action': 'create', 'resource': 'users', 'description': 'Crear nuevos usuarios'},
    {'action': 'read', 'resource': 'users', 'description': 'Ver información de usuarios'},
    {'action': 'update', 'resource': 'users', 'description': 'Actualizar usuarios'},
    {'action': 'delete', 'resource': 'users', 'description': 'Eliminar usuarios'},
    {'action': 'list', 'resource': 'users', 'description': 'Listar todos los usuarios'},
    
    # Clientes
    {'action': 'create', 'resource': 'customers', 'description': 'Crear nuevos clientes'},
    {'action': 'read', 'resource': 'customers', 'description': 'Ver información de clientes'},
    {'action': 'update', 'resource': 'customers', 'description': 'Actualizar clientes'},
    {'action': 'delete', 'resource': 'customers', 'description': 'Eliminar clientes'},
    {'action': 'list', 'resource': 'customers', 'description': 'Listar todos los clientes'},
    
    # Empleados
    {'action': 'create', 'resource': 'employees', 'description': 'Crear nuevos empleados'},
    {'action': 'read', 'resource': 'employees', 'description': 'Ver información de empleados'},
    {'action': 'update', 'resource': 'employees', 'description': 'Actualizar empleados'},
    {'action': 'delete', 'resource': 'employees', 'description': 'Eliminar empleados'},
    {'action': 'list', 'resource': 'employees', 'description': 'Listar todos los empleados'},
    
    # Proveedores
    {'action': 'create', 'resource': 'suppliers', 'description': 'Crear nuevos proveedores'},
    {'action': 'read', 'resource': 'suppliers', 'description': 'Ver información de proveedores'},
    {'action': 'update', 'resource': 'suppliers', 'description': 'Actualizar proveedores'},
    {'action': 'delete', 'resource': 'suppliers', 'description': 'Eliminar proveedores'},
    {'action': 'list', 'resource': 'suppliers', 'description': 'Listar todos los proveedores'},
    
    # Productos
    {'action': 'create', 'resource': 'products', 'description': 'Crear nuevos productos'},
    {'action': 'read', 'resource': 'products', 'description': 'Ver información de productos'},
    {'action': 'update', 'resource': 'products', 'description': 'Actualizar productos'},
    {'action': 'delete', 'resource': 'products', 'description': 'Eliminar productos'},
    {'action': 'list', 'resource': 'products', 'description': 'Listar todos los productos'},
    
    # Inventario
    {'action': 'create', 'resource': 'inventory', 'description': 'Crear registros de inventario'},
    {'action': 'read', 'resource': 'inventory', 'description': 'Ver inventario'},
    {'action': 'update', 'resource': 'inventory', 'description': 'Actualizar inventario'},
    {'action': 'delete', 'resource': 'inventory', 'description': 'Eliminar registros de inventario'},
    {'action': 'list', 'resource': 'inventory', 'description': 'Listar inventario'},
    
    # Ventas
    {'action': 'create', 'resource': 'sales', 'description': 'Crear nuevas ventas'},
    {'action': 'read', 'resource': 'sales', 'description': 'Ver información de ventas'},
    {'action': 'update', 'resource': 'sales', 'description': 'Actualizar ventas'},
    {'action': 'delete', 'resource': 'sales', 'description': 'Anular ventas'},
    {'action': 'list', 'resource': 'sales', 'description': 'Listar todas las ventas'},
    
    # Reportes
    {'action': 'create', 'resource': 'reports', 'description': 'Generar reportes'},
    {'action': 'read', 'resource': 'reports', 'description': 'Ver reportes'},
    {'action': 'update', 'resource': 'reports', 'description': 'Actualizar reportes'},
    {'action': 'delete', 'resource': 'reports', 'description': 'Eliminar reportes'},
    {'action': 'list', 'resource': 'reports', 'description': 'Listar reportes'},
]

permisos_creados = {}
for perm_data in permisos_config:
    perm, created = Permission.objects.get_or_create(
        action=perm_data['action'],
        resource=perm_data['resource'],
        defaults={'description': perm_data['description'], 'is_active': True}
    )
    permisos_creados[f"{perm_data['action']}_{perm_data['resource']}"] = perm
    if created:
        print(f"  ✅ Creado: {perm}")
    else:
        print(f"  ℹ️  Ya existe: {perm}")

print(f"\n✅ Total de permisos: {len(permisos_creados)}")

# ========================================
# 2. CREAR ROLES
# ========================================
print("\n👥 Creando Roles...")

# ROL: ADMINISTRADOR
admin_role, created = Role.objects.get_or_create(
    name='admin',
    defaults={
        'description': 'Administrador del sistema con todos los permisos',
        'is_active': True
    }
)
if created:
    print(f"  ✅ Creado: {admin_role}")
else:
    print(f"  ℹ️  Ya existe: {admin_role}")

# ROL: VENDEDOR
vendedor_role, created = Role.objects.get_or_create(
    name='employee',
    defaults={
        'description': 'Vendedor con permisos limitados a ventas y clientes',
        'is_active': True
    }
)
if created:
    print(f"  ✅ Creado: {vendedor_role}")
else:
    print(f"  ℹ️  Ya existe: {vendedor_role}")

# ========================================
# 3. ASIGNAR PERMISOS A ROLES
# ========================================
print("\n🔗 Asignando Permisos a Roles...")

# ADMINISTRADOR: TODOS LOS PERMISOS
print(f"\n  📌 Rol: {admin_role.get_name_display()}")
admin_permisos_asignados = 0
for perm_key, perm in permisos_creados.items():
    role_perm, created = RolePermission.objects.get_or_create(
        role=admin_role,
        permission=perm
    )
    if created:
        admin_permisos_asignados += 1

print(f"     ✅ Permisos asignados: {RolePermission.objects.filter(role=admin_role).count()}/{len(permisos_creados)}")

# VENDEDOR: PERMISOS LIMITADOS
print(f"\n  📌 Rol: {vendedor_role.get_name_display()} (Vendedor)")

# Permisos que tendrá el vendedor
permisos_vendedor = [
    # Clientes - Puede crear, ver, actualizar y listar (NO eliminar)
    'create_customers',
    'read_customers',
    'update_customers',
    'list_customers',
    
    # Productos - Solo ver y listar (NO crear, actualizar ni eliminar)
    'read_products',
    'list_products',
    
    # Inventario - Solo ver y listar (NO modificar)
    'read_inventory',
    'list_inventory',
    
    # Ventas - Puede crear, ver, actualizar y listar sus propias ventas (NO eliminar)
    'create_sales',
    'read_sales',
    'update_sales',
    'list_sales',
    
    # Reportes - Solo ver sus propios reportes
    'read_reports',
    'list_reports',
]

vendedor_permisos_asignados = 0
for perm_key in permisos_vendedor:
    if perm_key in permisos_creados:
        role_perm, created = RolePermission.objects.get_or_create(
            role=vendedor_role,
            permission=permisos_creados[perm_key]
        )
        if created:
            vendedor_permisos_asignados += 1
            print(f"     ✅ {permisos_creados[perm_key]}")

print(f"\n     ✅ Permisos asignados: {RolePermission.objects.filter(role=vendedor_role).count()}")

# ========================================
# 4. RESUMEN
# ========================================
print("\n" + "=" * 60)
print("📊 RESUMEN DE CONFIGURACIÓN")
print("=" * 60)

print(f"\n✅ Permisos totales creados: {Permission.objects.count()}")
print(f"✅ Roles creados: {Role.objects.count()}")

print("\n🔷 ROL: ADMINISTRADOR")
print(f"   • Permisos: {RolePermission.objects.filter(role=admin_role).count()}")
print(f"   • Acceso: TOTAL (todos los recursos)")

print("\n🔷 ROL: VENDEDOR (Employee)")
print(f"   • Permisos: {RolePermission.objects.filter(role=vendedor_role).count()}")
print(f"   • Acceso limitado a:")
print(f"     - Clientes: crear, ver, actualizar, listar")
print(f"     - Productos: solo ver y listar")
print(f"     - Inventario: solo ver y listar")
print(f"     - Ventas: crear, ver, actualizar, listar")
print(f"     - Reportes: solo ver y listar")

print("\n" + "=" * 60)
print("✅ ¡Configuración completada exitosamente!")
print("=" * 60)

# ========================================
# 5. ACTUALIZAR USUARIO ADMIN
# ========================================
from authentication.models import User

print("\n🔧 Actualizando usuario administrador...")
try:
    admin_user = User.objects.get(email='admin@repdrill.com')
    admin_user.role = admin_role
    admin_user.save()
    print(f"✅ Usuario 'admin@repdrill.com' ahora tiene el rol de Administrador")
except User.DoesNotExist:
    print("⚠️  Usuario admin@repdrill.com no encontrado")

print("\n🎉 ¡Todo listo! Ahora puedes:")
print("   1. Ver los roles en: http://127.0.0.1:8003/admin/authentication/role/")
print("   2. Ver los permisos en: http://127.0.0.1:8003/admin/authentication/permission/")
print("   3. Asignar roles a usuarios desde el admin panel")
