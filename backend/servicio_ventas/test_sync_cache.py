from ventas.models import Order

# Obtener orden
order = Order.objects.get(id=2)

print(f'Orden #{order.id} ANTES de sincronizar:')
print(f'  customer_id: {order.customer_id}')
print(f'  customer_name: {order.customer_name}')
print(f'  customer_email: {order.customer_email}')
print(f'  customer_phone: {order.customer_phone}')

# Sincronizar cache
result = order.sync_customer_cache()

print(f'\nSincronización: {"EXITOSA" if result else "FALLIDA"}')

# Recargar orden
order.refresh_from_db()

print(f'\nOrden #{order.id} DESPUÉS de sincronizar:')
print(f'  customer_id: {order.customer_id}')
print(f'  customer_name: {order.customer_name}')
print(f'  customer_email: {order.customer_email}')
print(f'  customer_phone: {order.customer_phone}')
