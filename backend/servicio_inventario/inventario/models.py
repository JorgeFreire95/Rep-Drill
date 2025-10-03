from django.db import models

class Warehouse(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Warehouse"
        verbose_name_plural = "Warehouses"


class Category(models.Model):
    name = models.CharField(max_length=100)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Category"
        verbose_name_plural = "Categories"


class Product(models.Model):
    name = models.CharField(max_length=100)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Product"
        verbose_name_plural = "Products"


class ProductPriceHistory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.product.name} - {self.price}"
    class Meta:
        verbose_name = "Product Price History"
        verbose_name_plural = "Product Price Histories"


class Inventory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    entry_date = models.DateField()
    exit_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.product.name} in {self.warehouse.name}"
    class Meta:
        verbose_name = "Inventory"
        verbose_name_plural = "Inventories"


class InventoryEvent(models.Model):
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE)
    choice = models.CharField(max_length=50)  # entry, exit, adjustment, transfer
    quantity = models.IntegerField()
    event_date = models.DateField()
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.choice} - {self.quantity} on {self.event_date}"
        
    class Meta:
        verbose_name = "Inventory Event"
        verbose_name_plural = "Inventory Events"
