"""
Script para poblar ventas históricas de los últimos 6 meses
"""
import os
import django
from datetime import datetime, timedelta
from decimal import Decimal
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_ventas.settings')
django.setup()

from ventas.models import Order, OrderDetails, Payment

print("\n=== Poblando Ventas Históricas (6 meses) ===")

# El servicio de ventas no maneja usuarios, solo customer_id
# No necesitamos usuario admin para las órdenes

# IDs de clientes (del 1 al 5)
customer_ids = [1, 2, 3, 4, 5]

# IDs de productos (asumiendo 18 productos creados)
product_ids = list(range(1, 19))
product_prices = {
    1: 8900,   # Filtro Aceite
    2: 34900,  # Pastillas Freno Delanteras
    3: 32900,  # Pastillas Freno Traseras
    4: 11900,  # Bujías
    5: 13900,  # Filtro Aire
    6: 45900,  # Correa Distribución
    7: 169000, # Alternador
    8: 99900,  # Batería
    9: 72900,  # Amortiguador Delantero
    10: 7900,  # Plumillas
    11: 49900, # Disco Freno
    12: 79900, # Bomba Combustible
    13: 16900, # Filtro Combustible
    14: 7900,  # Líquido Frenos
    15: 29900, # Aceite Motor
    16: 149000, # Motor Arranque
    17: 69900, # Amortiguador Trasero
    18: 14900, # Alfombras
}

# Fechas: 6 meses atrás hasta hoy
end_date = datetime.now()
start_date = end_date - timedelta(days=180)

print(f"Generando ventas desde {start_date.date()} hasta {end_date.date()}")

total_orders = 0
total_revenue = Decimal('0')
current_date = start_date

# Generar órdenes día por día
while current_date <= end_date:
    # Más órdenes en días de semana
    is_weekend = current_date.weekday() >= 5
    if is_weekend:
        num_orders = random.randint(2, 5)
    else:
        num_orders = random.randint(5, 12)
    
    # Crear órdenes para este día
    for _ in range(num_orders):
        try:
            customer_id = random.choice(customer_ids)
            
            # Seleccionar 1-5 productos
            num_products = random.randint(1, 5)
            selected_product_ids = random.sample(product_ids, min(num_products, len(product_ids)))
            
            # Calcular total
            order_total = Decimal('0')
            order_details_data = []
            
            for prod_id in selected_product_ids:
                quantity = random.randint(1, 4)
                unit_price = Decimal(str(product_prices.get(prod_id, 10000)))
                discount = Decimal(random.choice(['0', '0', '0', '5', '10']))
                subtotal = unit_price * quantity
                discount_amount = (subtotal * discount / 100)
                final_price = subtotal - discount_amount
                
                order_details_data.append({
                    'product_id': prod_id,
                    'quantity': quantity,
                    'unit_price': unit_price,
                    'discount': discount,
                    'subtotal': final_price
                })
                order_total += final_price
            
            # Crear orden
            order = Order.objects.create(
                customer_id=customer_id,
                total=order_total,
                status='COMPLETED',
                order_date=current_date,
                created_at=current_date,
                updated_at=current_date,
            )
            
            # Crear detalles
            for detail_data in order_details_data:
                OrderDetails.objects.create(
                    order=order,
                    **detail_data
                )
            
            # Crear pago
            payment_method = random.choice(['CASH', 'CARD', 'TRANSFER', 'CARD', 'CARD'])
            Payment.objects.create(
                order=order,
                amount=order_total,
                payment_method=payment_method,
                payment_date=current_date.date(),
            )
            
            total_orders += 1
            total_revenue += order_total
            
        except Exception as e:
            print(f"⚠ Error creando orden: {e}")
    
    # Avanzar al siguiente día
    current_date += timedelta(days=1)
    
    # Mostrar progreso cada 30 días
    days_diff = (current_date - start_date).days
    if days_diff % 30 == 0 and days_diff > 0:
        print(f"✓ Procesado {days_diff} días de ventas...")

print(f"\n{'=' * 60}")
print(f"Resumen de Ventas Generadas:")
print(f"{'=' * 60}")
print(f"Total órdenes creadas: {total_orders}")
print(f"Ingresos totales: ${total_revenue:,.0f}")
if total_orders > 0:
    print(f"Promedio por orden: ${(total_revenue / total_orders):,.0f}")
print(f"Período: {start_date.date()} a {end_date.date()}")
print(f"✅ Ventas pobladas correctamente")
