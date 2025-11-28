from django.db import models
from django.utils import timezone
from django.conf import settings
import requests
import logging

logger = logging.getLogger(__name__)

# Create your models here.
class Order(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pendiente'),
        ('CONFIRMED', 'Confirmada'),
        ('PROCESSING', 'En Proceso'),
        ('SHIPPED', 'Enviada'),
        ('DELIVERED', 'Entregada'),
        ('COMPLETED', 'Completada'),
        ('CANCELLED', 'Cancelada'),
    ]
    
    customer_id = models.IntegerField()  # FK a la tabla de clientes (personas)
    
    # ✅ CACHE: Datos del cliente para evitar consultas constantes al servicio Personas
    customer_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        default=None,
        help_text="Nombre completo del cliente (cache)"
    )
    customer_email = models.EmailField(
        blank=True,
        null=True,
        default=None,
        help_text="Email del cliente (cache)"
    )
    customer_phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        default=None,
        help_text="Teléfono del cliente (cache)"
    )
    
    # ✅ NUEVO: ID del empleado que crea la orden (sin FK para evitar problemas de BD compartida)
    created_by_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ID del empleado que creó la orden"
    )
    
    # ✅ NUEVO: ID del empleado que confirma la orden (sin FK para evitar problemas de BD compartida)
    confirmed_by_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ID del empleado que confirmó la orden"
    )
    
    # ✅ NUEVO: Fecha de confirmación
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha cuando se confirmó la orden"
    )
    
    employee_id = models.IntegerField(null=True, blank=True)  # FK a empleados
    order_date = models.DateField()
    warehouse_id = models.IntegerField(null=True, blank=True)  # FK a almacenes
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    total = models.DecimalField(max_digits=12, decimal_places=0, default=0)  # CLP sin decimales
    notes = models.TextField(blank=True, null=True)
    inventory_updated = models.BooleanField(default=False)  # Flag para evitar descuentos duplicados
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.order_date:
            # Usar la fecha del sistema local (America/Santiago)
            self.order_date = timezone.localdate()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Order #{self.id} - Customer: {self.customer_name or self.customer_id} - Status: {self.status}"
    
    def get_customer_details(self):
        """
        Obtiene los detalles completos del cliente desde el servicio de Personas.
        
        Returns:
            dict: Datos del cliente o None si hay error
        """
        try:
            response = requests.get(
                f"{settings.PERSONAS_SERVICE_URL}/api/personas/{self.customer_id}/",
                timeout=5
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(
                    f"Error obteniendo detalles del cliente {self.customer_id}: "
                    f"Status {response.status_code}"
                )
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error de conexión con servicio Personas: {str(e)}")
            return None
    
    def sync_customer_cache(self):
        """
        Sincroniza los datos cacheados del cliente con el servicio de Personas.
        
        Returns:
            bool: True si se actualizó correctamente, False si hubo error
        """
        customer_data = self.get_customer_details()
        
        if customer_data:
            # Actualiza campos de cache
            self.customer_name = f"{customer_data.get('nombre', '')} {customer_data.get('apellido', '')}".strip()
            self.customer_email = customer_data.get('email', '')
            self.customer_phone = customer_data.get('telefono', '')
            
            self.save(update_fields=['customer_name', 'customer_email', 'customer_phone'])
            
            logger.info(f"Cache de cliente sincronizado para orden {self.id}")
            return True
        else:
            logger.warning(f"No se pudo sincronizar cache para orden {self.id}")
            return False
    
    @classmethod
    def sync_all_customer_caches(cls):
        """
        Sincroniza el cache de clientes para todas las órdenes activas.
        
        Returns:
            dict: Estadísticas de la sincronización
        """
        active_orders = cls.objects.filter(
            status__in=['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED']
        )
        
        success_count = 0
        error_count = 0
        
        for order in active_orders:
            if order.sync_customer_cache():
                success_count += 1
            else:
                error_count += 1
        
        logger.info(
            f"Sincronización masiva completada: {success_count} éxitos, {error_count} errores"
        )
        
        return {
            'success': success_count,
            'errors': error_count,
            'total': active_orders.count()
        }
    
    def get_total_paid(self):
        """Calcula el total pagado de la orden"""
        from django.db.models import Sum
        total_paid = self.payment_set.aggregate(total=Sum('amount'))['total']
        return total_paid or 0
    
    def is_fully_paid(self):
        """Verifica si la orden está completamente pagada"""
        return self.get_total_paid() >= self.total
    
    def update_status_from_payment(self):
        """Actualiza el estado de la orden basado en los pagos"""
        import logging
        logger = logging.getLogger(__name__)
        
        if self.status not in ['CANCELLED', 'COMPLETED']:
            total_paid = self.get_total_paid()
            logger.info(f"🔍 Verificando pago de orden {self.id}: Total=${self.total}, Pagado=${total_paid}, Estado={self.status}")
            
            if self.is_fully_paid():
                old_status = self.status
                self.status = 'COMPLETED'
                self.save(update_fields=['status'])
                logger.info(f"📈 Estado de orden {self.id} cambiado de {old_status} a COMPLETED")
            else:
                logger.info(f"💰 Orden {self.id} aún no está completamente pagada (${total_paid}/${self.total})")

    class Meta:
        db_table = 'orders'
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['order_date']

class OrderDetails(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='details')
    product_id = models.IntegerField()  # FK a la tabla de productos del servicio de inventario
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=0)  # CLP sin decimales
    discount = models.DecimalField(max_digits=12, decimal_places=0, default=0)  # CLP sin decimales
    subtotal = models.DecimalField(max_digits=12, decimal_places=0, default=0)  # CLP sin decimales
    detail_date = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"OrderDetail for Order #{self.order.id} - Product {self.product_id}"

    class Meta:
        db_table = 'order_details'
        verbose_name = 'Order Detail'
        verbose_name_plural = 'Order Details'
        ordering = ['detail_date']


class Shipment(models.Model):
    STATUS_CHOICES = [
        ('Pendiente', 'Pendiente'),
        ('En Preparación', 'En Preparación'),
        ('Enviado', 'Enviado'),
        ('En Tránsito', 'En Tránsito'),
        ('Entregado', 'Entregado'),
        ('Cancelado', 'Cancelado'),
        ('Devuelto', 'Devuelto'),
    ]
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    shipment_date = models.DateField()
    warehouse_id = models.IntegerField() #ForeignKey a la tabla de almacenes del servicio de inventario
    delivered = models.BooleanField(default=False)
    delivery_status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Pendiente')

    def save(self, *args, **kwargs):
        if not self.shipment_date:
            # Usar la fecha del sistema local (America/Santiago)
            self.shipment_date = timezone.localdate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Shipment for Order #{self.order.id} - Delivered: {self.delivered}"

    class Meta:
        db_table = 'shipments'
        verbose_name = 'Shipment'
        verbose_name_plural = 'Shipments'
        ordering = ['shipment_date']


class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=0)  # CLP sin decimales
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=50)
    
    def save(self, *args, **kwargs):
        if not self.payment_date:
            # Usar la fecha del sistema local (America/Santiago)
            self.payment_date = timezone.localdate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payment for Order #{self.order.id} - Amount: $ {self.amount}"

    class Meta:
        db_table = 'payments'
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['payment_date']


class ServiceHealthCheck(models.Model):
    """
    Registra el estado de salud de las conexiones entre servicios.
    """
    SERVICE_CHOICES = [
        ('personas', 'Servicio de Personas'),
        ('inventario', 'Servicio de Inventario'),
        ('analytics', 'Servicio de Analytics'),
        ('auth', 'Servicio de Autenticación'),
    ]
    
    STATUS_CHOICES = [
        ('healthy', 'Saludable'),
        ('degraded', 'Degradado'),
        ('unhealthy', 'No disponible'),
        ('unknown', 'Desconocido'),
    ]
    
    service_name = models.CharField(
        max_length=50,
        choices=SERVICE_CHOICES,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='unknown'
    )
    response_time_ms = models.IntegerField(
        default=0,
        help_text="Tiempo de respuesta en milisegundos"
    )
    last_check = models.DateTimeField(auto_now=True)
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Mensaje de error si la verificación falló"
    )
    consecutive_failures = models.IntegerField(
        default=0,
        help_text="Número de verificaciones fallidas consecutivas"
    )
    
    class Meta:
        ordering = ['-last_check']
        unique_together = ['service_name']
    
    def __str__(self):
        return f"{self.get_service_name_display()} - {self.get_status_display()}"



