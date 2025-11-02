"""
Generate 6 months of historical sales orders for automotive products.
- Fetch automotive products from inventario by category name "Automotriz"
- Create daily orders with random basket and quantities
- Create payments to mark orders completed (triggers inventory reduction via service)
"""
import os
import sys
import django
import random
from datetime import date, timedelta
from decimal import Decimal
import requests

# Configure Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_ventas.settings')
django.setup()

from ventas.models import Order, OrderDetails, Payment
from django.db import transaction

INVENTARIO_BASE = os.getenv('INVENTARIO_SERVICE_URL', 'http://inventario:8000')


def get_category_id_by_name(name: str) -> int | None:
    try:
        r = requests.get(f"{INVENTARIO_BASE}/api/categories/", params={"search": name}, timeout=10)
        r.raise_for_status()
        data = r.json()
        for cat in data:
            if cat.get('name') == name:
                return cat.get('id')
        return None
    except Exception as e:
        print(f"Error fetching category: {e}")
        return None


def get_products_by_category(cat_id: int):
    try:
        r = requests.get(f"{INVENTARIO_BASE}/api/products/", params={"category": cat_id}, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"Error fetching products: {e}")
        return []


def daily_order_count(day_idx: int) -> int:
    # Vary orders per day: weekdays 5-10, weekends 3-6
    weekday = (date.today() - timedelta(days=day_idx)).weekday()
    if weekday in (5, 6):
        return random.randint(3, 6)
    return random.randint(5, 10)


def pick_items(products: list) -> list:
    # Return a list of (product, qty)
    count = random.randint(1, 3)
    chosen = random.sample(products, k=min(count, len(products)))
    items = []
    for p in chosen:
        # Favor consumables with higher quantities
        name = p.get('name', '').lower()
        if any(k in name for k in ['filtro', 'buj', 'plumillas']):
            qty = random.randint(1, 6)
        else:
            qty = random.randint(1, 3)
        items.append((p, qty))
    return items


def ensure_positive_decimal(x):
    try:
        d = Decimal(str(x))
        return d if d >= 0 else Decimal('0')
    except Exception:
        return Decimal('0')


def main():
    print("=== Generando ventas históricas (6 meses) para Automotriz ===")
    cat_id = get_category_id_by_name("Automotriz")
    if not cat_id:
        print("❌ Categoría 'Automotriz' no encontrada en inventario. Ejecute primero populate_automotive.py")
        return
    products = get_products_by_category(cat_id)
    if not products:
        print("❌ No hay productos automotrices para generar ventas")
        return
    # Map products to essential fields
    prods = [
        {
            'id': p['id'],
            'name': p.get('name'),
            'price': ensure_positive_decimal(p.get('price', 0))
        }
        for p in products
    ]

    start_date = date.today() - timedelta(days=180)
    end_date = date.today()

    total_orders = 0
    for day in range(0, (end_date - start_date).days):
        order_date = start_date + timedelta(days=day)
        n_orders = daily_order_count(day)
        for _ in range(n_orders):
            items = pick_items(prods)
            if not items:
                continue
            # Build order
            with transaction.atomic():
                order = Order.objects.create(
                    customer_id=random.randint(1, 50),
                    order_date=order_date,
                    warehouse_id=1,
                    status='CONFIRMED',
                    total=0
                )
                total = Decimal('0')
                for p, qty in items:
                    unit_price = p['price']
                    subtotal = unit_price * qty
                    OrderDetails.objects.create(
                        order=order,
                        product_id=p['id'],
                        quantity=qty,
                        unit_price=unit_price,
                        discount=0,
                        subtotal=subtotal
                    )
                    total += subtotal
                # Update order total
                order.total = total
                order.status = 'CONFIRMED'
                order.save(update_fields=['total', 'status'])
                # Create payment to complete
                Payment.objects.create(
                    order=order,
                    amount=total,
                    payment_date=order_date,
                    payment_method='TRANSFER'
                )
            total_orders += 1
        if (day + 1) % 30 == 0:
            print(f"Progreso: {(day+1)} días procesados, órdenes hasta ahora: {total_orders}")

    print(f"✅ Ventas generadas: {total_orders} órdenes desde {start_date} hasta {end_date}")


if __name__ == '__main__':
    main()
