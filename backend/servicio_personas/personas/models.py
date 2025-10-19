from django.db import models

class Customer(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)
    email = models.EmailField()

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Customer"
        verbose_name_plural = "Customers"

class Employee(models.Model):
    name = models.CharField(max_length=100)
    position = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Employee"
        verbose_name_plural = "Employees"

class Supplier(models.Model):
    name = models.CharField(max_length=100)
    contact_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Supplier"
        verbose_name_plural = "Suppliers"

class Rep(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=50)
    email = models.EmailField()
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE) # ForeignKey a Supplier

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Representative"
        verbose_name_plural = "Representatives"


class Persona(models.Model):
    """
    Modelo unificado para gestionar personas (clientes y proveedores)
    """
    TIPO_DOCUMENTO_CHOICES = [
        ('DNI', 'DNI'),
        ('RUC', 'RUC'),
        ('CE', 'Carnet de Extranjería'),
        ('PASAPORTE', 'Pasaporte'),
    ]
    
    nombre = models.CharField(
        max_length=200,
        verbose_name='Nombre completo'
    )
    tipo_documento = models.CharField(
        max_length=20,
        choices=TIPO_DOCUMENTO_CHOICES,
        default='DNI',
        verbose_name='Tipo de documento'
    )
    numero_documento = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='Número de documento'
    )
    email = models.EmailField(
        blank=True,
        null=True,
        verbose_name='Correo electrónico'
    )
    telefono = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name='Teléfono'
    )
    direccion = models.TextField(
        blank=True,
        null=True,
        verbose_name='Dirección'
    )
    es_cliente = models.BooleanField(
        default=False,
        verbose_name='Es cliente'
    )
    es_proveedor = models.BooleanField(
        default=False,
        verbose_name='Es proveedor'
    )
    fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha de creación'
    )
    fecha_actualizacion = models.DateTimeField(
        auto_now=True,
        verbose_name='Fecha de actualización'
    )
    
    class Meta:
        verbose_name = 'Persona'
        verbose_name_plural = 'Personas'
        ordering = ['-fecha_creacion']
    
    def __str__(self):
        tipo = []
        if self.es_cliente:
            tipo.append('Cliente')
        if self.es_proveedor:
            tipo.append('Proveedor')
        tipo_str = ' - '.join(tipo) if tipo else 'Sin tipo'
        return f"{self.nombre} ({tipo_str})"
