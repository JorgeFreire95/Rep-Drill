"""
Script para poblar el servicio de personas con clientes y proveedores
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_personas.settings')
django.setup()

from personas.models import Persona

print("\n=== Poblando Personas (Clientes y Proveedores) ===")

# Clientes
clientes_data = [
    {
        'tipo_documento': 'RUC',
        'numero_documento': '12345678-9',
        'nombre': 'Juan Pérez González',
        'email': 'juan.perez@email.com',
        'telefono': '+56912345678',
        'direccion': 'Av. Principal 123, Santiago, Región Metropolitana, Chile',
        'es_cliente': True,
        'es_proveedor': False,
    },
    {
        'tipo_documento': 'RUC',
        'numero_documento': '98765432-1',
        'nombre': 'María González López',
        'email': 'maria.gonzalez@email.com',
        'telefono': '+56987654321',
        'direccion': 'Calle Secundaria 456, Valparaíso, Región de Valparaíso, Chile',
        'es_cliente': True,
        'es_proveedor': False,
    },
    {
        'tipo_documento': 'RUC',
        'numero_documento': '11222333-4',
        'nombre': 'Transportes del Sur Ltda.',
        'email': 'contacto@transportessur.cl',
        'telefono': '+56912223334',
        'direccion': 'Av. Industrial 789, Concepción, Región del Biobío, Chile',
        'es_cliente': True,
        'es_proveedor': False,
    },
    {
        'tipo_documento': 'RUC',
        'numero_documento': '44555666-7',
        'nombre': 'Minería del Norte S.A.',
        'email': 'ventas@minerianorte.cl',
        'telefono': '+56944555666',
        'direccion': 'Camino Minero Km 45, Antofagasta, Región de Antofagasta, Chile',
        'es_cliente': True,
        'es_proveedor': False,
    },
    {
        'tipo_documento': 'RUC',
        'numero_documento': '55666777-8',
        'nombre': 'Carlos Ramírez Silva',
        'email': 'carlos.ramirez@email.com',
        'telefono': '+56955666777',
        'direccion': 'Pasaje Los Olivos 321, La Serena, Región de Coquimbo, Chile',
        'es_cliente': True,
        'es_proveedor': False,
    },
]

# Proveedores
proveedores_data = [
    {
        'tipo_documento': 'RUC',
        'numero_documento': '76543210-K',
        'nombre': 'Repuestos Bosch Chile S.A.',
        'email': 'ventas@boschchile.com',
        'telefono': '+56222334455',
        'direccion': 'Av. Kennedy 5600, Santiago, Región Metropolitana, Chile',
        'es_cliente': False,
        'es_proveedor': True,
    },
    {
        'tipo_documento': 'RUC',
        'numero_documento': '87654321-0',
        'nombre': 'Distribuidora Automotriz Mann S.A.',
        'email': 'contacto@mannchile.cl',
        'telefono': '+56233445566',
        'direccion': 'Calle Los Industriales 1234, Santiago, Región Metropolitana, Chile',
        'es_cliente': False,
        'es_proveedor': True,
    },
]

clientes_created = 0
proveedores_created = 0

for data in clientes_data:
    cliente, created = Persona.objects.get_or_create(
        numero_documento=data['numero_documento'],
        defaults=data
    )
    if created:
        clientes_created += 1
        print(f"✓ Cliente: {cliente.nombre}")

for data in proveedores_data:
    proveedor, created = Persona.objects.get_or_create(
        numero_documento=data['numero_documento'],
        defaults=data
    )
    if created:
        proveedores_created += 1
        print(f"✓ Proveedor: {proveedor.nombre}")

print(f"\nResumen Personas:")
print(f"Clientes creados: {clientes_created}")
print(f"Proveedores creados: {proveedores_created}")
print(f"✅ Personas pobladas correctamente")
