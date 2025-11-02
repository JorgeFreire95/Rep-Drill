"""
Script para poblar datos de inventario en el servicio de inventario.
Crea registros de inventario para productos existentes en bodegas existentes.
"""
import os
import sys
import django
import random
from datetime import date, timedelta

# Configurar Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_inventario.settings')
django.setup()

from inventario.models import Product, Warehouse, Inventory

def populate_inventory():
    """
    Crea registros de inventario para productos existentes.
    """
    print("=== Iniciando población de inventario ===")
    
    # Verificar productos
    products = Product.objects.filter(status='ACTIVE')
    print(f"Productos activos encontrados: {products.count()}")
    
    if not products.exists():
        print("❌ No hay productos activos. Primero crea productos.")
        return
    
    # Verificar bodegas
    warehouses = Warehouse.objects.all()
    print(f"Bodegas encontradas: {warehouses.count()}")
    
    if not warehouses.exists():
        print("Creando bodega por defecto...")
        warehouse = Warehouse.objects.create(
            name="Bodega Principal",
            location="Santiago, Chile",
            description="Bodega central de almacenamiento"
        )
        print(f"✓ Bodega creada: {warehouse.name}")
        warehouses = [warehouse]
    
    # Limpiar inventario existente (opcional)
    existing_count = Inventory.objects.count()
    if existing_count > 0:
        print(f"Advertencia: Ya existen {existing_count} registros de inventario.")
        Inventory.objects.all().delete()
        print("✓ Inventario anterior eliminado")
    
    # Crear inventarios
    created = 0
    entry_date = date.today() - timedelta(days=30)  # Entrada hace 30 días
    
    for product in products:
        for warehouse in warehouses:
            # Verificar si ya existe
            if Inventory.objects.filter(product=product, warehouse=warehouse).exists():
                print(f"⚠️ Ya existe inventario para {product.name} en {warehouse.name}")
                continue
            
            # Generar cantidad aleatoria basada en min_stock
            min_qty = product.min_stock or 10
            max_qty = min_qty * 3
            
            # 30% de productos en bajo stock (cerca del mínimo)
            # 70% de productos en stock normal
            if random.random() < 0.3:
                # Bajo stock: entre 0 y 1.2x min_stock
                quantity = random.randint(0, int(min_qty * 1.2))
            else:
                # Stock normal: entre min_stock y max_qty
                quantity = random.randint(int(min_qty), int(max_qty))
            
            # Crear inventario
            inventory = Inventory.objects.create(
                product=product,
                warehouse=warehouse,
                quantity=quantity,
                entry_date=entry_date
            )
            
            created += 1
            stock_status = "🔴 BAJO" if quantity <= min_qty else "🟢 OK"
            print(f"✓ [{stock_status}] {product.name} ({product.sku}) en {warehouse.name}: {quantity} unidades (min: {min_qty})")
    
    print(f"\n=== Resumen ===")
    print(f"Total inventarios creados: {created}")
    print(f"Productos activos: {products.count()}")
    print(f"Bodegas: {warehouses.count()}")
    
    # Verificar productos en bajo stock
    low_stock = 0
    for product in products:
        total_stock = Inventory.objects.filter(product=product).aggregate(
            total=django.db.models.Sum('quantity')
        )['total'] or 0
        if total_stock <= (product.min_stock or 10):
            low_stock += 1
    
    print(f"Productos en bajo stock: {low_stock}")
    print("\n✅ Población de inventario completada!")

if __name__ == "__main__":
    populate_inventory()
