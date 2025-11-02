"""
Script para poblar completamente el sistema con datos de 6 meses
Incluye: Personas, Productos, Ventas, Eventos de Inventario
"""
import os
import sys
import django
from datetime import datetime, timedelta
from decimal import Decimal
import random

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_ventas.settings')

# Configurar para cada servicio
SERVICES = {
    'personas': 'servicio_personas.settings',
    'inventario': 'servicio_inventario.settings',
    'ventas': 'servicio_ventas.settings',
}

def populate_personas():
    """Poblar servicio de personas con clientes y proveedores"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', SERVICES['personas'])
    django.setup()
    
    from personas.models import Persona
    
    print("\n=== Poblando Personas (Clientes y Proveedores) ===")
    
    # Clientes
    clientes_data = [
        {
            'tipo_documento': 'RUT',
            'numero_documento': '12345678-9',
            'tipo_persona': 'NATURAL',
            'nombres': 'Juan',
            'apellidos': 'Pérez González',
            'razon_social': None,
            'email': 'juan.perez@email.com',
            'telefono': '+56912345678',
            'direccion': 'Av. Principal 123, Santiago',
            'ciudad': 'Santiago',
            'region': 'Región Metropolitana',
            'pais': 'Chile',
            'es_cliente': True,
            'es_proveedor': False,
        },
        {
            'tipo_documento': 'RUT',
            'numero_documento': '98765432-1',
            'tipo_persona': 'NATURAL',
            'nombres': 'María',
            'apellidos': 'González López',
            'razon_social': None,
            'email': 'maria.gonzalez@email.com',
            'telefono': '+56987654321',
            'direccion': 'Calle Secundaria 456, Valparaíso',
            'ciudad': 'Valparaíso',
            'region': 'Región de Valparaíso',
            'pais': 'Chile',
            'es_cliente': True,
            'es_proveedor': False,
        },
        {
            'tipo_documento': 'RUT',
            'numero_documento': '11222333-4',
            'tipo_persona': 'JURIDICA',
            'nombres': None,
            'apellidos': None,
            'razon_social': 'Transportes del Sur Ltda.',
            'email': 'contacto@transportessur.cl',
            'telefono': '+56912223334',
            'direccion': 'Av. Industrial 789, Concepción',
            'ciudad': 'Concepción',
            'region': 'Región del Biobío',
            'pais': 'Chile',
            'es_cliente': True,
            'es_proveedor': False,
        },
        {
            'tipo_documento': 'RUT',
            'numero_documento': '44555666-7',
            'tipo_persona': 'JURIDICA',
            'nombres': None,
            'apellidos': None,
            'razon_social': 'Minería del Norte S.A.',
            'email': 'ventas@minerianorte.cl',
            'telefono': '+56944555666',
            'direccion': 'Camino Minero Km 45, Antofagasta',
            'ciudad': 'Antofagasta',
            'region': 'Región de Antofagasta',
            'pais': 'Chile',
            'es_cliente': True,
            'es_proveedor': False,
        },
        {
            'tipo_documento': 'RUT',
            'numero_documento': '55666777-8',
            'tipo_persona': 'NATURAL',
            'nombres': 'Carlos',
            'apellidos': 'Ramírez Silva',
            'razon_social': None,
            'email': 'carlos.ramirez@email.com',
            'telefono': '+56955666777',
            'direccion': 'Pasaje Los Olivos 321, La Serena',
            'ciudad': 'La Serena',
            'region': 'Región de Coquimbo',
            'pais': 'Chile',
            'es_cliente': True,
            'es_proveedor': False,
        },
    ]
    
    # Proveedores
    proveedores_data = [
        {
            'tipo_documento': 'RUT',
            'numero_documento': '76543210-K',
            'tipo_persona': 'JURIDICA',
            'nombres': None,
            'apellidos': None,
            'razon_social': 'Repuestos Bosch Chile S.A.',
            'email': 'ventas@boschchile.com',
            'telefono': '+56222334455',
            'direccion': 'Av. Kennedy 5600, Santiago',
            'ciudad': 'Santiago',
            'region': 'Región Metropolitana',
            'pais': 'Chile',
            'es_cliente': False,
            'es_proveedor': True,
        },
        {
            'tipo_documento': 'RUT',
            'numero_documento': '87654321-0',
            'tipo_persona': 'JURIDICA',
            'nombres': None,
            'apellidos': None,
            'razon_social': 'Distribuidora Automotriz Mann S.A.',
            'email': 'contacto@mannchile.cl',
            'telefono': '+56233445566',
            'direccion': 'Calle Los Industriales 1234, Santiago',
            'ciudad': 'Santiago',
            'region': 'Región Metropolitana',
            'pais': 'Chile',
            'es_cliente': False,
            'es_proveedor': True,
        },
    ]
    
    clientes_created = []
    proveedores_created = []
    
    for data in clientes_data:
        cliente, created = Persona.objects.get_or_create(
            numero_documento=data['numero_documento'],
            defaults=data
        )
        if created:
            clientes_created.append(cliente)
            print(f"✓ Cliente: {cliente.get_nombre_completo() or cliente.razon_social}")
    
    for data in proveedores_data:
        proveedor, created = Persona.objects.get_or_create(
            numero_documento=data['numero_documento'],
            defaults=data
        )
        if created:
            proveedores_created.append(proveedor)
            print(f"✓ Proveedor: {proveedor.razon_social}")
    
    print(f"\nResumen Personas:")
    print(f"Clientes creados: {len(clientes_created)}")
    print(f"Proveedores creados: {len(proveedores_created)}")
    
    return clientes_created, proveedores_created


def populate_inventario():
    """Poblar servicio de inventario con productos y movimientos"""
    os.environ['DJANGO_SETTINGS_MODULE'] = SERVICES['inventario']
    django.setup()
    
    from inventario.models import Category, Product, Warehouse, Inventory
    
    print("\n=== Poblando Inventario ===")
    
    # Crear almacén principal
    warehouse, _ = Warehouse.objects.get_or_create(
        code='ALM-CENTRAL',
        defaults={
            'name': 'Almacén Central',
            'location': 'Santiago, Chile',
            'status': 'ACTIVE'
        }
    )
    
    # Crear categorías
    categories_data = [
        {'name': 'Filtros', 'description': 'Filtros de aceite, aire y combustible'},
        {'name': 'Frenos', 'description': 'Pastillas, discos y componentes de freno'},
        {'name': 'Motor', 'description': 'Componentes y repuestos de motor'},
        {'name': 'Eléctrico', 'description': 'Baterías, alternadores y componentes eléctricos'},
        {'name': 'Suspensión', 'description': 'Amortiguadores y componentes de suspensión'},
        {'name': 'Accesorios', 'description': 'Accesorios varios para vehículos'},
    ]
    
    categories = {}
    for cat_data in categories_data:
        cat, _ = Category.objects.get_or_create(
            name=cat_data['name'],
            defaults=cat_data
        )
        categories[cat.name] = cat
    
    # Productos automotrices expandidos
    products_data = [
        # Filtros
        {'sku': 'AUT-OL-FLTR-BOS', 'name': 'Filtro de Aceite Bosch', 'category': 'Filtros', 
         'price': 8900, 'cost': 5000, 'quantity': 120, 'min_stock': 30, 'reorder_qty': 50},
        {'sku': 'AUT-AR-FLTR-MAN', 'name': 'Filtro de Aire Mann', 'category': 'Filtros',
         'price': 13900, 'cost': 8000, 'quantity': 90, 'min_stock': 20, 'reorder_qty': 40},
        {'sku': 'AUT-FL-FLTR-WAL', 'name': 'Filtro de Combustible Wahl', 'category': 'Filtros',
         'price': 16900, 'cost': 10000, 'quantity': 65, 'min_stock': 15, 'reorder_qty': 30},
        
        # Frenos
        {'sku': 'AUT-BRK-PAD-F', 'name': 'Pastillas de Freno Delanteras', 'category': 'Frenos',
         'price': 34900, 'cost': 20000, 'quantity': 80, 'min_stock': 20, 'reorder_qty': 40},
        {'sku': 'AUT-BRK-PAD-R', 'name': 'Pastillas de Freno Traseras', 'category': 'Frenos',
         'price': 32900, 'cost': 18000, 'quantity': 70, 'min_stock': 20, 'reorder_qty': 40},
        {'sku': 'AUT-BRK-DSK-VENT', 'name': 'Disco de Freno Ventilado', 'category': 'Frenos',
         'price': 49900, 'cost': 30000, 'quantity': 48, 'min_stock': 12, 'reorder_qty': 25},
        {'sku': 'AUT-BRK-FLUID-DOT4', 'name': 'Líquido de Frenos DOT4', 'category': 'Frenos',
         'price': 7900, 'cost': 4000, 'quantity': 150, 'min_stock': 40, 'reorder_qty': 60},
        
        # Motor
        {'sku': 'AUT-SPK-NGK-IR', 'name': 'Bujías NGK Iridium', 'category': 'Motor',
         'price': 11900, 'cost': 7000, 'quantity': 150, 'min_stock': 25, 'reorder_qty': 50},
        {'sku': 'AUT-TIM-BLT-GAT', 'name': 'Correa de Distribución Gates', 'category': 'Motor',
         'price': 45900, 'cost': 28000, 'quantity': 40, 'min_stock': 10, 'reorder_qty': 20},
        {'sku': 'AUT-FUEL-PMP-BOS', 'name': 'Bomba de Combustible Bosch', 'category': 'Motor',
         'price': 79900, 'cost': 50000, 'quantity': 20, 'min_stock': 6, 'reorder_qty': 12},
        {'sku': 'AUT-OIL-5W30-SYN', 'name': 'Aceite Motor 5W30 Sintético 4L', 'category': 'Motor',
         'price': 29900, 'cost': 18000, 'quantity': 200, 'min_stock': 50, 'reorder_qty': 80},
        
        # Eléctrico
        {'sku': 'AUT-BAT-60-BOS', 'name': 'Batería 60Ah Bosch', 'category': 'Eléctrico',
         'price': 99900, 'cost': 65000, 'quantity': 24, 'min_stock': 6, 'reorder_qty': 12},
        {'sku': 'AUT-ALT-VAL-90A', 'name': 'Alternador Valeo 90A', 'category': 'Eléctrico',
         'price': 169000, 'cost': 110000, 'quantity': 12, 'min_stock': 3, 'reorder_qty': 6},
        {'sku': 'AUT-STR-BOS-1.4KW', 'name': 'Motor de Arranque Bosch 1.4kW', 'category': 'Eléctrico',
         'price': 149000, 'cost': 95000, 'quantity': 15, 'min_stock': 4, 'reorder_qty': 8},
        
        # Suspensión
        {'sku': 'AUT-SHK-MON-F', 'name': 'Amortiguador Monroe Delantero', 'category': 'Suspensión',
         'price': 72900, 'cost': 45000, 'quantity': 32, 'min_stock': 8, 'reorder_qty': 16},
        {'sku': 'AUT-SHK-MON-R', 'name': 'Amortiguador Monroe Trasero', 'category': 'Suspensión',
         'price': 69900, 'cost': 42000, 'quantity': 28, 'min_stock': 8, 'reorder_qty': 16},
        
        # Accesorios
        {'sku': 'AUT-WIP-22-UNI', 'name': 'Plumillas Limpiaparabrisas 22"', 'category': 'Accesorios',
         'price': 7900, 'cost': 4000, 'quantity': 200, 'min_stock': 40, 'reorder_qty': 60},
        {'sku': 'AUT-MAT-FLOOR-UNI', 'name': 'Alfombras Universales Goma', 'category': 'Accesorios',
         'price': 14900, 'cost': 8000, 'quantity': 85, 'min_stock': 20, 'reorder_qty': 30},
    ]
    
    products_created = []
    for prod_data in products_data:
        category = categories[prod_data['category']]
        product, created = Product.objects.get_or_create(
            sku=prod_data['sku'],
            defaults={
                'name': prod_data['name'],
                'category': category,
                'price': Decimal(str(prod_data['price'])),
                'cost_price': Decimal(str(prod_data['cost'])),
                'quantity': prod_data['quantity'],
                'min_stock': prod_data['min_stock'],
                'reorder_quantity': prod_data['reorder_qty'],
                'status': 'ACTIVE',
                'warehouse': warehouse,
            }
        )
        
        if created:
            # Crear registro de inventario
            Inventory.objects.create(
                product=product,
                warehouse=warehouse,
                quantity=prod_data['quantity'],
            )
            products_created.append(product)
            print(f"✓ Producto: {product.name} (Stock: {product.quantity})")
    
    print(f"\nResumen Inventario:")
    print(f"Productos creados: {len(products_created)}")
    print(f"Categorías: {len(categories)}")
    
    return products_created, warehouse


def populate_ventas_historicas(products, start_date, end_date):
    """Poblar ventas históricas para 6 meses"""
    os.environ['DJANGO_SETTINGS_MODULE'] = SERVICES['ventas']
    django.setup()
    
    from ventas.models import Order, OrderDetails, Payment
    from django.contrib.auth import get_user_model
    
    User = get_user_model()
    
    print("\n=== Poblando Ventas Históricas (6 meses) ===")
    
    # Obtener o crear usuario admin para las órdenes
    admin_user = User.objects.filter(email='admin@test.com').first()
    if not admin_user:
        print("⚠ Usuario admin no encontrado, creando uno nuevo...")
        admin_user = User.objects.create_user(
            email='admin@test.com',
            password='admin123',
            first_name='Admin',
            last_name='System'
        )
    
    # IDs de clientes (asumiendo que ya fueron creados)
    customer_ids = list(range(1, 6))  # 5 clientes
    
    # Estadísticas de generación
    total_orders = 0
    total_revenue = Decimal('0')
    current_date = start_date
    
    # Generar órdenes día por día
    while current_date <= end_date:
        # Determinar número de órdenes para este día
        # Más órdenes en días de semana, menos en fin de semana
        is_weekend = current_date.weekday() >= 5
        if is_weekend:
            num_orders = random.randint(2, 5)
        else:
            num_orders = random.randint(5, 12)
        
        # Crear órdenes para este día
        for _ in range(num_orders):
            # Seleccionar cliente aleatorio
            customer_id = random.choice(customer_ids)
            
            # Seleccionar 1-5 productos aleatorios
            num_products = random.randint(1, 5)
            selected_products = random.sample(products, min(num_products, len(products)))
            
            # Calcular total de la orden
            order_total = Decimal('0')
            order_details_data = []
            
            for product in selected_products:
                quantity = random.randint(1, 5)
                unit_price = Decimal(str(product['price']))
                discount = Decimal(random.choice(['0', '0', '0', '5', '10']))  # 0%, 5%, 10%
                subtotal = unit_price * quantity
                discount_amount = (subtotal * discount / 100)
                final_price = subtotal - discount_amount
                
                order_details_data.append({
                    'product_id': product['id'],
                    'quantity': quantity,
                    'unit_price': unit_price,
                    'discount': discount,
                    'subtotal': final_price
                })
                order_total += final_price
            
            # Crear orden con fecha histórica
            order = Order.objects.create(
                customer_id=customer_id,
                total=order_total,
                status='COMPLETED',
                order_date=current_date,
                created_at=current_date,
                updated_at=current_date,
                confirmed_at=current_date,
                confirmed_by=admin_user,
            )
            
            # Crear detalles de orden
            for detail_data in order_details_data:
                OrderDetails.objects.create(
                    order=order,
                    **detail_data
                )
            
            # Crear pago
            payment_method = random.choice(['CASH', 'CARD', 'TRANSFER'])
            Payment.objects.create(
                order=order,
                amount=order_total,
                payment_method=payment_method,
                payment_date=current_date,
                status='COMPLETED'
            )
            
            total_orders += 1
            total_revenue += order_total
        
        # Avanzar al siguiente día
        current_date += timedelta(days=1)
        
        # Mostrar progreso cada 30 días
        days_diff = (current_date - start_date).days
        if days_diff % 30 == 0:
            print(f"✓ Procesado {days_diff} días de ventas...")
    
    print(f"\nResumen Ventas:")
    print(f"Total órdenes creadas: {total_orders}")
    print(f"Ingresos totales: ${total_revenue:,.0f}")
    print(f"Promedio por orden: ${(total_revenue / total_orders):,.0f}")
    print(f"Período: {start_date.date()} a {end_date.date()}")


def main():
    """Ejecutar población completa del sistema"""
    print("=" * 60)
    print("POBLACIÓN COMPLETA DEL SISTEMA - 6 MESES DE DATOS")
    print("=" * 60)
    
    # Fechas: 6 meses atrás hasta hoy
    end_date = datetime.now()
    start_date = end_date - timedelta(days=180)
    
    print(f"\nPeríodo de datos: {start_date.date()} a {end_date.date()}")
    print(f"Total días: 180 días (~6 meses)")
    
    try:
        # 1. Poblar personas (clientes y proveedores)
        clientes, proveedores = populate_personas()
        
        # 2. Poblar inventario (productos)
        products_objs, warehouse = populate_inventario()
        
        # Convertir productos a diccionarios para ventas
        products_data = []
        for prod in products_objs:
            products_data.append({
                'id': prod.id,
                'sku': prod.sku,
                'name': prod.name,
                'price': float(prod.price),
                'quantity': prod.quantity,
            })
        
        # 3. Poblar ventas históricas
        if products_data:
            populate_ventas_historicas(products_data, start_date, end_date)
        else:
            print("⚠ No hay productos disponibles para crear ventas")
        
        print("\n" + "=" * 60)
        print("✅ POBLACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 60)
        print("\nEl sistema ahora tiene:")
        print(f"• {len(clientes)} clientes")
        print(f"• {len(proveedores)} proveedores")
        print(f"• {len(products_data)} productos en inventario")
        print(f"• ~1,500-2,000 órdenes de venta (6 meses)")
        print("\n⚠ IMPORTANTE: Ejecute las tareas de analytics para generar métricas:")
        print("  docker compose exec analytics python manage.py recalculate_all_metrics")
        
    except Exception as e:
        print(f"\n❌ Error durante la población: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
