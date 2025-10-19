from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Payment, Order
import requests


@receiver(post_save, sender=Payment)
def update_order_status_on_payment_save(sender, instance, created, **kwargs):
    """
    Actualiza el estado de la orden cuando se crea o actualiza un pago.
    Si la orden está completamente pagada, cambia su estado a COMPLETED.
    """
    order = instance.order
    order.update_status_from_payment()


@receiver(post_delete, sender=Payment)
def update_order_status_on_payment_delete(sender, instance, **kwargs):
    """
    Actualiza el estado de la orden cuando se elimina un pago.
    Si la orden ya no está completamente pagada, el estado se mantiene o puede ajustarse.
    """
    order = instance.order
    # Si se elimina un pago y la orden estaba completada, podríamos revertir el estado
    if order.status == 'COMPLETED' and not order.is_fully_paid():
        # Revertir a un estado anterior (por ejemplo, CONFIRMED o PENDING)
        order.status = 'CONFIRMED' if order.get_total_paid() > 0 else 'PENDING'
        order.save(update_fields=['status'])


@receiver(post_save, sender=Order)
def update_inventory_on_order_confirmed(sender, instance, created, **kwargs):
    """
    Descuenta productos del inventario cuando una orden es confirmada.
    Se ejecuta cuando el estado cambia a CONFIRMED, PROCESSING, SHIPPED, o COMPLETED.
    Solo se procesa una vez por orden usando el flag 'inventory_updated'.
    """
    # Verificar si ya se procesó el inventario
    if instance.inventory_updated:
        return
    
    # Solo procesar si la orden está en un estado que requiere descuento de inventario
    should_process = instance.status in ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']
    
    if not should_process:
        return
    
    # Obtener los detalles de la orden
    for detail in instance.details.all():
        try:
            # Llamar al servicio de inventario para descontar el producto
            response = requests.get(
                f'http://localhost:8002/api/products/{detail.product_id}/',
                timeout=5
            )
            
            if response.status_code == 200:
                product_data = response.json()
                current_quantity = product_data.get('quantity', 0)
                new_quantity = current_quantity - detail.quantity
                
                # Actualizar la cantidad en el inventario
                update_response = requests.patch(
                    f'http://localhost:8002/api/products/{detail.product_id}/',
                    json={'quantity': new_quantity},
                    headers={'Content-Type': 'application/json'},
                    timeout=5
                )
                
                if update_response.status_code == 200:
                    print(f'✅ Inventario actualizado: Producto {detail.product_id}, '
                          f'Cantidad anterior: {current_quantity}, '
                          f'Cantidad vendida: {detail.quantity}, '
                          f'Nueva cantidad: {new_quantity}')
                else:
                    print(f'❌ Error actualizando inventario del producto {detail.product_id}: '
                          f'{update_response.status_code}')
            else:
                print(f'⚠️ Producto {detail.product_id} no encontrado en inventario')
                
        except Exception as e:
            print(f'❌ Error procesando inventario para producto {detail.product_id}: {str(e)}')
    
    # Marcar que el inventario ya fue actualizado para evitar procesar de nuevo
    # Usar update() en lugar de save() para evitar disparar el signal nuevamente
    Order.objects.filter(pk=instance.pk).update(inventory_updated=True)
