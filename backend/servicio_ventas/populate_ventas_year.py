import os, random
from datetime import date, timedelta
os.environ.setdefault('DJANGO_SETTINGS_MODULE','servicio_ventas.settings')
import django
django.setup()
from ventas.models import Order, OrderDetails, Payment
from django.db import connection
from django.utils import timezone

random.seed(102)
end = date.today() - timedelta(days=1)
start = end - timedelta(days=365)

# Obtener productos activos
with connection.cursor() as cur:
    cur.execute("SELECT id, price FROM inventario_product WHERE status='ACTIVE'")
    products = cur.fetchall()
# Obtener clientes
with connection.cursor() as cur:
    cur.execute("SELECT id, nombre, email, telefono FROM personas_persona WHERE es_cliente = TRUE")
    customers = cur.fetchall()

if not products or not customers:
    print('Faltan productos o clientes para generar ventas.')
    raise SystemExit(1)

print(f'Productos: {len(products)} | Clientes: {len(customers)}')

def seasonal_multiplier(d):
    if d.month in (12,1,2):
        return 1.25
    if d.month in (6,7):
        return 1.15
    return 1.0

def daily_target(d):
    base = random.randint(24,34)
    if d.day >= 28:
        base += 6
    if d.weekday() >= 5:
        base = int(base * 0.55)
    return int(base * seasonal_multiplier(d))

total_orders = 0
revenue = 0
current = start
while current <= end:
    target = daily_target(current)
    for _ in range(target):
        cust = random.choice(customers)
        items_count = random.randint(1,4)
        chosen = random.sample(products, items_count)
        order_total = 0
        details_cache = []
        for prod in chosen:
            pid, price = prod
            qty = random.randint(1,3)  # Reducido de 1-5 a 1-3 para mayor realismo
            unit_price = int(price)
            discount = 0
            subtotal = unit_price * qty - discount
            order_total += subtotal
            details_cache.append((pid, qty, unit_price, discount, subtotal))
        order = Order.objects.create(
            customer_id=cust[0],
            customer_name=cust[1],
            customer_email=cust[2],
            customer_phone=cust[3],
            order_date=current,
            status='COMPLETED',
            total=order_total,
            confirmed_at=timezone.make_aware(timezone.datetime.combine(current, timezone.datetime.min.time())),
        )
        for pid, qty, unit_price, discount, subtotal in details_cache:
            OrderDetails.objects.create(order=order, product_id=pid, quantity=qty, unit_price=unit_price, discount=discount, subtotal=subtotal)
        Payment.objects.create(order=order, amount=order_total, payment_date=current, payment_method=random.choice(['CASH','CARD','TRANSFER']))
        total_orders += 1
        revenue += order_total
    if (current - start).days % 30 == 0:
        avg = revenue / total_orders if total_orders else 0
        print(f"Días {(current-start).days}: Órdenes {total_orders} Promedio ${avg:,.0f}")
    current += timedelta(days=1)

print('\nResumen Año Ventas:')
print(f'Órdenes: {total_orders}')
print(f'Ingresos: ${revenue:,.0f}')
print(f'Promedio por orden: ${revenue/total_orders:,.0f}')
print(f'Período: {start} a {end}')
