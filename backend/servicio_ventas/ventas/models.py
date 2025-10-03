from django.db import models

# Create your models here.
class Order(models.Model):
    order_id = models.IntegerField() #ForeignKey a la tabla de pedidos del servicio de ventas
    employee_id = models.IntegerField() #ForeignKey a la tabla de empleados del servicio de empleados
    order_date = models.DateField()
    warehouse_id = models.IntegerField() #ForeignKey a la tabla de almacenes del servicio de inventario
    status = models.CharField(max_length=50)

    def __str__(self):
        return f"Order {self.order_id} - Status: {self.status}"

    class Meta:
        db_table = 'orders'
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['order_date']

class OrderDetails(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    product_id = models.IntegerField() #ForeignKey a la tabla de productos del servicio de inventario
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    detail_date = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"OrderDetail for Order {self.order.order_id} - Product {self.product_id}"

    class Meta:
        db_table = 'order_details'
        verbose_name = 'Order Detail'
        verbose_name_plural = 'Order Details'
        ordering = ['detail_date']


class Shipment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    shipment_date = models.DateField()
    warehouse_id = models.IntegerField() #ForeignKey a la tabla de almacenes del servicio de inventario
    delivered = models.BooleanField(default=False)

    def __str__(self):
        return f"Shipment for Order {self.order.order_id} - Delivered: {self.delivered}"

    class Meta:
        db_table = 'shipments'
        verbose_name = 'Shipment'
        verbose_name_plural = 'Shipments'
        ordering = ['shipment_date']


class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    method = models.CharField(max_length=50)

    def __str__(self):
        return f"Payment for Order {self.order.order_id} - Amount: {self.amount}"

    class Meta:
        db_table = 'payments'
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['payment_date']


