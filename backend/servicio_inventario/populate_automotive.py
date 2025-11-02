"""
Populate automotive spare parts in inventario service and initial stock.
- Creates category "Automotriz"
- Creates supplier "Proveedor Automotriz"
- Creates products (10-15 SKUs) with prices and stock settings
- Sets Product.quantity and creates Inventory entries in a warehouse
"""
import os
import sys
import django
from datetime import date, timedelta
from decimal import Decimal

# Configure Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_inventario.settings')
django.setup()

from inventario.models import Category, Supplier, Warehouse, Product, Inventory

PRODUCTS = [
    # name, sku, cost, price, min_stock, reorder_qty, init_qty
    ("Filtro de Aceite Bosch", "AUT-OL-FLTR-BOS", 4500, 8900, 30, 60, 120),
    ("Pastillas de Freno Delanteras", "AUT-BRK-PAD-F", 18000, 34900, 20, 40, 80),
    ("Pastillas de Freno Traseras", "AUT-BRK-PAD-R", 17000, 32900, 20, 40, 70),
    ("Bujías NGK Iridium", "AUT-SPK-NGK-IR", 6000, 11900, 25, 50, 150),
    ("Filtro de Aire Mann", "AUT-AR-FLTR-MAN", 7000, 13900, 20, 40, 90),
    ("Correa de Distribución Gates", "AUT-TIM-BLT-GAT", 22000, 45900, 10, 20, 40),
    ("Alternador Valeo", "AUT-ALT-VAL-90A", 85000, 169000, 3, 6, 12),
    ("Batería 60Ah Bosch", "AUT-BAT-60-BOS", 50000, 99900, 6, 12, 24),
    ("Amortiguador Monroe Delantero", "AUT-SHK-MON-F", 35000, 72900, 8, 16, 32),
    ("Plumillas Limpiaparabrisas 22\"", "AUT-WIP-22-UNI", 3500, 7900, 40, 80, 200),
    ("Disco de Freno Ventilado", "AUT-BRK-DSK-VENT", 24000, 49900, 12, 24, 48),
    ("Bomba de Combustible Bosch", "AUT-FUEL-PMP-BOS", 38000, 79900, 6, 12, 20),
]


def main():
    print("=== Poblando datos automotrices (Inventario) ===")

    cat, _ = Category.objects.get_or_create(name="Automotriz", defaults={"description": "Repuestos automotrices"})
    sup, _ = Supplier.objects.get_or_create(name="Proveedor Automotriz", defaults={
        "contact_person": "Juan Pérez",
        "email": "ventas@proveedorauto.cl",
        "phone": "+56 2 1234 5678",
        "city": "Santiago",
    })
    wh, _ = Warehouse.objects.get_or_create(name="Bodega Automotriz", defaults={
        "location": "Santiago",
        "description": "Bodega para repuestos automotrices",
    })

    created = 0
    updated = 0
    inv_created = 0
    entry_date = date.today() - timedelta(days=180)

    for name, sku, cost, price, min_stock, reorder_qty, init_qty in PRODUCTS:
        prod, created_prod = Product.objects.update_or_create(
            sku=sku,
            defaults={
                "name": name,
                "category": cat,
                "supplier": sup,
                "warehouse": wh,
                "cost_price": Decimal(cost),
                "price": Decimal(price),
                "min_stock": min_stock,
                "reorder_quantity": reorder_qty,
                "quantity": init_qty,
                "unit_of_measure": "UND",
                "status": "ACTIVE",
            }
        )
        if created_prod:
            created += 1
        else:
            updated += 1
        # Ensure one Inventory record mirrors quantity
        inv, inv_created_flag = Inventory.objects.get_or_create(
            product=prod,
            warehouse=wh,
            defaults={"quantity": init_qty, "entry_date": entry_date}
        )
        if not inv_created_flag:
            inv.quantity = init_qty
            inv.entry_date = entry_date
            inv.save(update_fields=["quantity", "entry_date"])
        else:
            inv_created += 1

        print(f"✓ {name} ({sku}) -> qty={init_qty}, min={min_stock}, price={price}")

    print("\nResumen:")
    print(f"Productos creados: {created}, actualizados: {updated}")
    print(f"Inventarios creados: {inv_created}")
    print("✅ Inventario automotriz poblado")


if __name__ == '__main__':
    main()
