from django.db import models
from django.utils import timezone
from .audit import get_current_actor, get_current_ip
from decimal import Decimal
from datetime import date, datetime
from uuid import UUID


def _json_safe(value):
    """Recursively convert values to JSON-serializable primitives.
    - Decimal -> float (to preserve numeric semantics in reports)
    - date/datetime -> ISO 8601 string
    - set/tuple -> list
    - dict/list -> walk values
    """
    if isinstance(value, Decimal):
        # Convert to float to keep numbers numeric in JSON (prices are integers in CLP)
        try:
            return float(value)
        except Exception:
            return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, set):
        return [_json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [_json_safe(v) for v in list(value)]
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    return value

class Warehouse(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Warehouse"
        verbose_name_plural = "Warehouses"


class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Category"
        verbose_name_plural = "Categories"


class Supplier(models.Model):
    """
    Modelo mejorado de Proveedor
    """
    name = models.CharField(max_length=150, verbose_name='Nombre del Proveedor')
    contact_person = models.CharField(max_length=100, blank=True, null=True, verbose_name='Persona de Contacto')
    email = models.EmailField(blank=True, null=True, verbose_name='Email')
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Teléfono')
    address = models.TextField(blank=True, null=True, verbose_name='Dirección')
    city = models.CharField(max_length=100, blank=True, null=True, verbose_name='Ciudad')
    country = models.CharField(max_length=100, default='Chile', blank=True, null=True, verbose_name='País')
    payment_terms = models.CharField(max_length=100, blank=True, null=True, verbose_name='Términos de Pago')
    tax_id = models.CharField(max_length=50, unique=True, blank=True, null=True, verbose_name='RUT/Tax ID')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    # Evaluación básica
    rating = models.FloatField(blank=True, null=True, verbose_name='Calificación (0-5)')
    on_time_rate = models.FloatField(blank=True, null=True, verbose_name='Tasa entregas a tiempo (0-1)')
    created_at = models.DateTimeField(auto_now_add=True, null=True, verbose_name='Fecha Creación')
    updated_at = models.DateTimeField(auto_now=True, null=True, verbose_name='Fecha Actualización')

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Supplier"
        verbose_name_plural = "Suppliers"


class Product(models.Model):
    """
    Modelo de Producto mejorado con información de proveedor y costos
    """
    PRODUCT_STATUS_CHOICES = [
        ('ACTIVE', 'Activo'),
        ('INACTIVE', 'Inactivo'),
        ('DISCONTINUED', 'Descontinuado'),
    ]
    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    sku = models.CharField(max_length=50, unique=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='products', verbose_name='Proveedor')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    
    # Precios en CLP (sin decimales)
    cost_price = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='Precio de Costo (CLP)')
    price = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='Precio de Venta (CLP)')
    
    # Stock
    quantity = models.IntegerField(default=0, verbose_name='Cantidad Disponible')
    min_stock = models.IntegerField(default=0, verbose_name='Stock Mínimo')
    reorder_quantity = models.IntegerField(default=10, verbose_name='Cantidad de Reorden')
    
    # Otros
    unit_of_measure = models.CharField(max_length=10, default='UND', verbose_name='Unidad de Medida')
    status = models.CharField(max_length=20, choices=PRODUCT_STATUS_CHOICES, default='ACTIVE', verbose_name='Estado')
    
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def __str__(self):
        return self.name
    
    @property
    def profit_margin(self):
        """Calcula el margen de ganancia"""
        if self.cost_price == 0:
            return 0
        return ((self.price - self.cost_price) / self.cost_price) * 100
    
    @property
    def is_low_stock(self):
        """Verifica si el stock está por debajo del mínimo"""
        return self.quantity <= self.min_stock
    
    @property
    def needs_reorder(self):
        """Verifica si se necesita hacer una reorden"""
        return self.quantity <= self.reorder_quantity

    class Meta:
        verbose_name = "Product"
        verbose_name_plural = "Products"
        ordering = ['name']


class ProductPriceHistory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=12, decimal_places=0)  # CLP sin decimales
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.start_date:
            # Usar la fecha del sistema local (America/Santiago)
            self.start_date = timezone.localdate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.price}"
    class Meta:
        verbose_name = "Product Price History"
        verbose_name_plural = "Product Price Histories"


class ProductCostHistory(models.Model):
    """Historial del precio de costo (cost_price) del producto."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    cost_price = models.DecimalField(max_digits=12, decimal_places=0)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.start_date:
            self.start_date = timezone.localdate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.cost_price} (costo)"

    class Meta:
        verbose_name = "Product Cost History"
        verbose_name_plural = "Product Cost Histories"


class Inventory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    entry_date = models.DateField()
    exit_date = models.DateField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.entry_date:
            # Usar la fecha del sistema local (America/Santiago)
            self.entry_date = timezone.localdate()
        super().save(*args, **kwargs)

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

    def save(self, *args, **kwargs):
        if not self.event_date:
            # Usar la fecha del sistema local (America/Santiago)
            self.event_date = timezone.localdate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.choice} - {self.quantity} on {self.event_date}"
        
    class Meta:
        verbose_name = "Inventory Event"
        verbose_name_plural = "Inventory Events"


class ReorderRequest(models.Model):
    """
    Solicitud de reabastecimiento (reorden) simple.
    Permite convertir una alerta en una acción con trazabilidad básica.
    """
    STATUS_CHOICES = [
        ('requested', 'Solicitada'),
        ('ordered', 'Ordenada'),
        ('received', 'Recibida'),
        ('cancelled', 'Cancelada'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reorders')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='reorders')
    quantity = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Reorder {self.id} - {self.product.name} x {self.quantity} ({self.status})"

    class Meta:
        verbose_name = "Reorder Request"
        verbose_name_plural = "Reorder Requests"
        ordering = ['-created_at']


class ReorderStatusHistory(models.Model):
    """
    Historial de cambios de estado de una solicitud de reorden.
    Auditoría completa de transiciones.
    """
    reorder = models.ForeignKey(ReorderRequest, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20, blank=True, null=True)
    new_status = models.CharField(max_length=20)
    changed_by = models.CharField(max_length=150, blank=True, null=True)  # username or system
    changed_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Reorder {self.reorder.id}: {self.old_status or 'None'} → {self.new_status}"

    class Meta:
        verbose_name = "Reorder Status History"
        verbose_name_plural = "Reorder Status Histories"
        ordering = ['-changed_at']


class AuditLog(models.Model):
    """
    Registro de auditoría simple y eficiente.
    Guarda el modelo afectado, el id del objeto, acción, cambios, actor y timestamp.
    """
    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
    ]

    created_at = models.DateTimeField(auto_now_add=True)
    model = models.CharField(max_length=100)
    object_id = models.IntegerField()
    object_repr = models.CharField(max_length=255, blank=True, null=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    changes = models.JSONField(blank=True, null=True)
    actor = models.CharField(max_length=150, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['model', 'action']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.actor:
            self.actor = get_current_actor() or 'system'
        if not self.ip_address:
            # ip no esencial; omitir si no está
            ip = get_current_ip()
            if ip:
                self.ip_address = ip.split(',')[0].strip()
        # Ensure 'changes' is always JSON serializable
        if self.changes is not None:
            self.changes = _json_safe(self.changes)
        super().save(*args, **kwargs)
