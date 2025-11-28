from ventas.tasks import sync_order_customer_cache
from ventas.models import Order

# Verificar orden actual
order = Order.objects.get(id=2)
print(f'Orden #{order.id} ANTES de sincronizar (via Celery):')
print(f'  customer_name: {order.customer_name}')
print(f'  customer_email: {order.customer_email}')

# Limpiar cache para probar
order.customer_name = None
order.customer_email = None
order.customer_phone = None
order.save()

print(f'\n✅ Cache limpiado')

# Ejecutar tarea de Celery de forma síncrona (para testing)
result = sync_order_customer_cache(order.id)
print(f'\n📝 Resultado de la tarea Celery:')
print(result)

# Recargar orden
order.refresh_from_db()

print(f'\nOrden #{order.id} DESPUÉS de sincronizar (via Celery):')
print(f'  customer_name: {order.customer_name}')
print(f'  customer_email: {order.customer_email}')
print(f'  customer_phone: {order.customer_phone}')
