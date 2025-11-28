from ventas.models import Order

# Probar sincronización masiva
print('🔄 Iniciando sincronización masiva de cache...\n')

result = Order.sync_all_customer_caches()

print(f'\n✅ Sincronización completada:')
print(f'  - Éxitos: {result["success"]}')
print(f'  - Errores: {result["errors"]}')
print(f'  - Total procesado: {result["total"]}')

# Verificar una orden
if result["total"] > 0:
    order = Order.objects.filter(status__in=['PENDING', 'CONFIRMED']).first()
    if order:
        print(f'\n📋 Ejemplo de orden sincronizada:')
        print(f'  Orden #{order.id}:')
        print(f'    - customer_id: {order.customer_id}')
        print(f'    - customer_name: {order.customer_name}')
        print(f'    - customer_email: {order.customer_email}')
        print(f'    - customer_phone: {order.customer_phone}')
