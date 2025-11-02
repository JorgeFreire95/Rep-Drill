from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Payment, Order
from .services import OrderService
import requests
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Payment)
def update_order_status_on_payment_save(sender, instance, created, **kwargs):
    """
    Actualiza el estado de la orden cuando se crea o actualiza un pago.
    Si la orden está completamente pagada, cambia su estado a COMPLETED
    y actualiza el inventario automáticamente.
    """
    action = "creado" if created else "actualizado"
    logger.info(f"🔔 Signal ejecutado: Pago {action} para orden {instance.order.id} - Monto: ${instance.amount}")
    
    order = instance.order
    
    # Actualizar el estado de la orden basado en el pago
    order.update_status_from_payment()
    
    # Recargar la orden desde la DB para asegurar el estado actual
    order.refresh_from_db()
    
    # Si la orden está completamente pagada y el inventario no ha sido actualizado
    if order.is_fully_paid() and not order.inventory_updated:
        logger.info(f"💰 Pago completado para orden {order.id}. Procesando actualización de inventario...")
        
        # Procesar la finalización del pago y actualizar inventario
        result = OrderService.process_payment_completion(order)
        
        if result['success']:
            logger.info(f"✅ Inventario actualizado exitosamente para orden {order.id}")
        else:
            logger.error(f"❌ Error al actualizar inventario para orden {order.id}: {result.get('message')}")
    elif order.is_fully_paid() and order.inventory_updated:
        logger.info(f"ℹ️ Orden {order.id} ya tiene el inventario actualizado")
    else:
        logger.info(f"⏳ Orden {order.id} aún pendiente de pago completo")


@receiver(post_delete, sender=Payment)
def update_order_status_on_payment_delete(sender, instance, **kwargs):
    """
    Actualiza el estado de la orden cuando se elimina un pago.
    Si la orden ya no está completamente pagada, revierte el estado.
    NOTA: Si se elimina un pago después de actualizar el inventario,
    el inventario NO se revierte automáticamente (requiere intervención manual).
    """
    order = instance.order
    
    # Si se elimina un pago y la orden estaba completada, revertir el estado
    if order.status == 'COMPLETED' and not order.is_fully_paid():
        order.status = 'CONFIRMED' if order.get_total_paid() > 0 else 'PENDING'
        order.save(update_fields=['status'])
        
        logger.warning(
            f"⚠️ Pago eliminado de orden {order.id}. Estado revertido a {order.status}. "
            f"NOTA: El inventario debe ajustarse manualmente si es necesario."
        )


@receiver(post_save, sender=Order)
def update_inventory_on_order_confirmed(sender, instance, created, **kwargs):
    """
    DEPRECATED: Esta función ahora es manejada por el signal de Payment.
    El inventario se actualiza automáticamente cuando se completa el pago,
    no cuando la orden cambia de estado.
    
    Se mantiene para compatibilidad pero solo registra advertencias.
    """
    # Si la orden se marca como COMPLETED manualmente sin estar pagada
    if instance.status == 'COMPLETED' and not instance.inventory_updated and not instance.is_fully_paid():
        logger.warning(
            f"⚠️ Orden {instance.id} marcada como COMPLETED sin estar completamente pagada. "
            f"Total orden: ${instance.total}, Total pagado: ${instance.get_total_paid()}. "
            f"El inventario NO será actualizado automáticamente."
        )
