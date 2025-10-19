#!/usr/bin/env python
"""
Script para crear datos de prueba en el módulo de ventas
"""

import os
import django
from decimal import Decimal

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_ventas.settings')
django.setup()

from ventas.models import Order, OrderDetails, Payment, Shipment
from datetime import date, timedelta

def create_test_data():
    """Crea datos de prueba para órdenes, pagos y envíos"""
    
    print("🔧 Creando datos de prueba...\n")
    
    try:
        # Crear Orden 1
        order1 = Order.objects.create(
            customer_id=1,  # Asume que existe un cliente con ID 1
            employee_id=1,
            warehouse_id=1,
            status='CONFIRMED',
            total=Decimal('1095972.00'),
            notes='Orden de prueba #1 - Laptop y accesorios'
        )
        print(f"✅ Orden #{order1.id} creada")
        
        # Detalles de la orden 1
        OrderDetails.objects.create(
            order=order1,
            product_id=1,  # Laptop
            quantity=2,
            unit_price=Decimal('599990.00'),
            discount=Decimal('10.00'),
            subtotal=Decimal('1079982.00')
        )
        
        OrderDetails.objects.create(
            order=order1,
            product_id=2,  # Mouse
            quantity=1,
            unit_price=Decimal('15990.00'),
            discount=Decimal('0.00'),
            subtotal=Decimal('15990.00')
        )
        print(f"   ✅ 2 detalles agregados")
        
        # Pago para la orden 1
        payment1 = Payment.objects.create(
            order=order1,
            amount=Decimal('500000.00'),
            method='Transferencia Bancaria'
        )
        print(f"   ✅ Pago #{payment1.id} creado: ${payment1.amount}")
        
        # Envío para la orden 1
        shipment1 = Shipment.objects.create(
            order=order1,
            shipment_date=date.today() + timedelta(days=2),
            warehouse_id=1,
            delivered=False
        )
        print(f"   ✅ Envío #{shipment1.id} programado\n")
        
        # Crear Orden 2
        order2 = Order.objects.create(
            customer_id=1,
            employee_id=None,
            warehouse_id=1,
            status='PENDING',
            total=Decimal('299990.00'),
            notes='Orden de prueba #2 - Producto único'
        )
        print(f"✅ Orden #{order2.id} creada")
        
        # Detalle de la orden 2
        OrderDetails.objects.create(
            order=order2,
            product_id=3,
            quantity=1,
            unit_price=Decimal('299990.00'),
            discount=Decimal('0.00'),
            subtotal=Decimal('299990.00')
        )
        print(f"   ✅ 1 detalle agregado")
        
        # Pago parcial para la orden 2
        payment2 = Payment.objects.create(
            order=order2,
            amount=Decimal('150000.00'),
            method='Tarjeta de Crédito'
        )
        print(f"   ✅ Pago parcial #{payment2.id} creado: ${payment2.amount}\n")
        
        # Crear Orden 3
        order3 = Order.objects.create(
            customer_id=2,  # Otro cliente
            employee_id=1,
            warehouse_id=1,
            status='DELIVERED',
            total=Decimal('85990.00'),
            notes='Orden de prueba #3 - Completada'
        )
        print(f"✅ Orden #{order3.id} creada")
        
        # Detalle de la orden 3
        OrderDetails.objects.create(
            order=order3,
            product_id=4,
            quantity=2,
            unit_price=Decimal('42995.00'),
            discount=Decimal('0.00'),
            subtotal=Decimal('85990.00')
        )
        print(f"   ✅ 1 detalle agregado")
        
        # Pago completo para la orden 3
        payment3 = Payment.objects.create(
            order=order3,
            amount=Decimal('85990.00'),
            method='Efectivo'
        )
        print(f"   ✅ Pago completo #{payment3.id} creado: ${payment3.amount}")
        
        # Envío entregado para la orden 3
        shipment2 = Shipment.objects.create(
            order=order3,
            shipment_date=date.today() - timedelta(days=3),
            warehouse_id=1,
            delivered=True
        )
        print(f"   ✅ Envío #{shipment2.id} entregado\n")
        
        print("✅ Datos de prueba creados exitosamente!")
        print("\n📊 Resumen:")
        print(f"   - {Order.objects.count()} órdenes")
        print(f"   - {OrderDetails.objects.count()} detalles")
        print(f"   - {Payment.objects.count()} pagos")
        print(f"   - {Shipment.objects.count()} envíos")
        print("\n🌐 Ahora puedes ver los datos en:")
        print("   - http://localhost:5174/ventas (tab Órdenes)")
        print("   - http://localhost:5174/ventas (tab Pagos)")
        print("   - http://localhost:5174/ventas (tab Envíos)")
        
    except Exception as e:
        print(f"❌ Error al crear datos: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    # Limpiar datos anteriores (opcional)
    print("⚠️  ¿Deseas limpiar datos existentes? (s/n)")
    # Para script automático, comentar las siguientes líneas:
    # response = input().lower()
    # if response == 's':
    #     OrderDetails.objects.all().delete()
    #     Payment.objects.all().delete()
    #     Shipment.objects.all().delete()
    #     Order.objects.all().delete()
    #     print("🗑️  Datos anteriores eliminados\n")
    
    create_test_data()
