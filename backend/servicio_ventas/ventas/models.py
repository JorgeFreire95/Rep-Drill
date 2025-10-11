from django.db import models

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
    employee_id = models.IntegerField(null=True, blank=True)  # FK a empleados
    order_date = models.DateField()
    warehouse_id = models.IntegerField(null=True, blank=True)  # FK a almacenes
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    inventory_updated = models.BooleanField(default=False)  # Flag para evitar descuentos duplicados
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.order_date:
            import datetime
            # Usar la fecha del sistema local
            self.order_date = datetime.date.today()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Order #{self.id} - Customer: {self.customer_id} - Status: {self.status}"
    
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
        if self.status not in ['CANCELLED', 'COMPLETED']:
            if self.is_fully_paid():
                self.status = 'COMPLETED'
                self.save(update_fields=['status'])

    class Meta:
        db_table = 'orders'
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['order_date']

class OrderDetails(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='details')
    product_id = models.IntegerField()  # FK a la tabla de productos del servicio de inventario
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
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

    def __str__(self):
        return f"Shipment for Order #{self.order.id} - Delivered: {self.delivered}"

    class Meta:
        db_table = 'shipments'
        verbose_name = 'Shipment'
        verbose_name_plural = 'Shipments'
        ordering = ['shipment_date']


class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=50)
    
    def save(self, *args, **kwargs):
        if not self.payment_date:
            import datetime
            # Usar la fecha del sistema local
            self.payment_date = datetime.date.today()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Payment for Order #{self.order.id} - Amount: $ {self.amount}"

    class Meta:
        db_table = 'payments'
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['payment_date']


