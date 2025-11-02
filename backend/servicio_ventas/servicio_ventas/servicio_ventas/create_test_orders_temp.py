#!/usr/bin/env python
"""
Script para crear datos de prueba en la base de datos
"""
import os
import django
import sys

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_ventas.settings')
sys.path.insert(0, '/app/servicio_ventas')
django.setup()

from ventas.models import Order, OrderDetails, Payment
from personas.models import Personas
from datetime import datetime, timedelta
import random

# Crear órdenes de prueba
customers = Personas.objects.filter(id__in=[1, 2, 3, 4, 5])
statuses = ['PENDING', 'CONFIRMED', 'COMPLETED']

for customer in customers:
    for i in range(3):  # 3 órdenes por cliente
        status = random.choice(statuses)
        
        # Crear orden
        order = Order.objects.create(
            customer_id=customer.id,
            status=status,
            total=random.uniform(50, 500),
            order_date=datetime.now() - timedelta(days=random.randint(1, 30))
        )
        
        # Crear detalles de orden
        num_items = random.randint(2, 4)
        for j in range(num_items):
            OrderDetails.objects.create(
                order_id=order.id,
                product_id=random.randint(1, 10),
                quantity=random.randint(1, 5),
                unit_price=random.uniform(10, 100),
                discount=0
            )
        
        # Crear pago si la orden está completada
        if status == 'COMPLETED':
            Payment.objects.create(
                order_id=order.id,
                amount=order.total,
                payment_method='TRANSFER',
                payment_date=datetime.now()
            )

print("✅ 15 órdenes de prueba creadas exitosamente!")
print(f"Total de órdenes: {Order.objects.count()}")
