"""
Servicios para comunicación entre microservicios
"""
import requests
from django.conf import settings
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class InventoryService:
    """
    Servicio para comunicarse con el microservicio de inventario
    """
    
    @staticmethod
    def get_base_url():
        """Obtiene la URL base del servicio de inventario"""
        return getattr(settings, 'INVENTARIO_SERVICE_URL', 'http://localhost:8001')
    
    @staticmethod
    def update_product_stock(product_id, quantity_to_reduce, warehouse_id=None):
        """
        Reduce el stock de un producto en el inventario
        
        Args:
            product_id: ID del producto
            quantity_to_reduce: Cantidad a reducir del stock
            warehouse_id: ID del almacén (opcional)
            
        Returns:
            dict: Respuesta del servicio de inventario
        """
        try:
            base_url = InventoryService.get_base_url()
            url = f"{base_url}/api/products/{product_id}/"
            logger.info(f"🔗 Conectando al servicio de inventario: {url}")
            
            # Primero obtenemos el producto actual
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                product_data = response.json()
                current_quantity = product_data.get('quantity', 0)
                new_quantity = max(0, current_quantity - quantity_to_reduce)
                
                # Actualizamos la cantidad
                update_data = {
                    'quantity': new_quantity
                }
                
                response = requests.patch(url, json=update_data, timeout=5)
                
                if response.status_code == 200:
                    logger.info(
                        f"Stock actualizado exitosamente. Producto: {product_id}, "
                        f"Cantidad anterior: {current_quantity}, Nueva cantidad: {new_quantity}"
                    )
                    return {
                        'success': True,
                        'product_id': product_id,
                        'previous_quantity': current_quantity,
                        'new_quantity': new_quantity,
                        'reduced_quantity': quantity_to_reduce
                    }
                else:
                    logger.error(f"Error al actualizar stock: {response.status_code} - {response.text}")
                    return {
                        'success': False,
                        'error': f"Error al actualizar: {response.status_code}",
                        'details': response.text
                    }
            else:
                logger.error(f"Error al obtener producto: {response.status_code} - {response.text}")
                return {
                    'success': False,
                    'error': f"Producto no encontrado: {response.status_code}",
                    'details': response.text
                }
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout al comunicarse con el servicio de inventario")
            return {
                'success': False,
                'error': 'Timeout al comunicarse con el servicio de inventario'
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Error de conexión con el servicio de inventario: {str(e)}")
            return {
                'success': False,
                'error': f'Error de conexión: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error inesperado al actualizar inventario: {str(e)}")
            return {
                'success': False,
                'error': f'Error inesperado: {str(e)}'
            }
    
    @staticmethod
    def check_product_availability(product_id, required_quantity):
        """
        Verifica si hay stock suficiente de un producto
        
        Args:
            product_id: ID del producto
            required_quantity: Cantidad requerida
            
        Returns:
            dict: Información sobre disponibilidad
        """
        try:
            url = f"{InventoryService.get_base_url()}/api/products/{product_id}/"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                product_data = response.json()
                current_quantity = product_data.get('quantity', 0)
                
                return {
                    'success': True,
                    'available': current_quantity >= required_quantity,
                    'current_quantity': current_quantity,
                    'required_quantity': required_quantity,
                    'product_name': product_data.get('name', 'Unknown')
                }
            else:
                return {
                    'success': False,
                    'error': f"Producto no encontrado: {response.status_code}"
                }
                
        except Exception as e:
            logger.error(f"Error al verificar disponibilidad: {str(e)}")
            return {
                'success': False,
                'error': f'Error: {str(e)}'
            }
    
    @staticmethod
    def update_inventory_for_order(order):
        """
        Actualiza el inventario para todos los productos de una orden
        
        Args:
            order: Instancia del modelo Order
            
        Returns:
            dict: Resultado de la actualización
        """
        results = []
        all_success = True
        
        for detail in order.details.all():
            result = InventoryService.update_product_stock(
                product_id=detail.product_id,
                quantity_to_reduce=detail.quantity,
                warehouse_id=order.warehouse_id
            )
            
            results.append({
                'product_id': detail.product_id,
                'quantity': detail.quantity,
                'result': result
            })
            
            if not result.get('success', False):
                all_success = False
        
        return {
            'success': all_success,
            'results': results,
            'order_id': order.id
        }


class OrderService:
    """
    Servicio para gestionar lógica de negocio de órdenes
    """
    
    @staticmethod
    def process_payment_completion(order):
        """
        Procesa la finalización del pago de una orden
        
        Args:
            order: Instancia del modelo Order
            
        Returns:
            dict: Resultado del procesamiento
        """
        logger.info(f"🚀 Iniciando proceso de finalización de pago para orden {order.id}")
        
        # Verificar si la orden ya fue procesada
        if order.inventory_updated:
            logger.warning(f"La orden {order.id} ya tiene el inventario actualizado")
            return {
                'success': False,
                'message': 'El inventario ya fue actualizado para esta orden'
            }
        
        # Verificar si el pago está completo
        total_paid = order.get_total_paid()
        if not order.is_fully_paid():
            logger.warning(f"La orden {order.id} no está completamente pagada: ${total_paid}/${order.total}")
            return {
                'success': False,
                'message': f'La orden no está completamente pagada: ${total_paid}/${order.total}'
            }
        
        # Verificar que la orden tenga detalles
        details_count = order.details.count()
        if details_count == 0:
            logger.error(f"La orden {order.id} no tiene detalles de productos")
            return {
                'success': False,
                'message': 'La orden no tiene productos para procesar'
            }
        
        logger.info(f"📦 Orden {order.id} lista para procesar - {details_count} productos")
        
        # Actualizar inventario
        inventory_result = InventoryService.update_inventory_for_order(order)
        
        if inventory_result['success']:
            # Marcar la orden como inventario actualizado
            order.inventory_updated = True
            order.status = 'COMPLETED'
            order.save(update_fields=['inventory_updated', 'status'])
            
            logger.info(f"Orden {order.id} procesada exitosamente. Inventario actualizado.")
            
            return {
                'success': True,
                'message': 'Orden procesada e inventario actualizado exitosamente',
                'order_id': order.id,
                'inventory_updates': inventory_result['results']
            }
        else:
            logger.error(f"Error al actualizar inventario para orden {order.id}")
            return {
                'success': False,
                'message': 'Error al actualizar el inventario',
                'order_id': order.id,
                'inventory_updates': inventory_result['results']
            }
