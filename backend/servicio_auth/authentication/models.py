from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator


class UserManager(BaseUserManager):
    """
    Custom user manager where email is the unique identifier
    for authentication instead of username.
    """
    def create_user(self, email, password=None, **extra_fields):
        """
        Create and save a User with the given email and password.
        """
        if not email:
            raise ValueError('El email es obligatorio')
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create and save a SuperUser with the given email and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


class Role(models.Model):
    """
    Model for user roles
    """
    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('manager', 'Gerente'),
        ('employee', 'Empleado'),
    ]
    
    name = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        unique=True,
        verbose_name='Nombre del rol'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha de creación'
    )
    
    class Meta:
        verbose_name = 'Rol'
        verbose_name_plural = 'Roles'
        ordering = ['name']
    
    def __str__(self):
        return self.get_name_display()


class Permission(models.Model):
    """
    Model for custom permissions
    """
    PERMISSION_CHOICES = [
        ('create', 'Crear'),
        ('read', 'Leer'),
        ('update', 'Actualizar'),
        ('delete', 'Eliminar'),
        ('list', 'Listar'),
    ]
    
    RESOURCE_CHOICES = [
        ('users', 'Usuarios'),
        ('customers', 'Clientes'),
        ('employees', 'Empleados'),
        ('products', 'Productos'),
        ('inventory', 'Inventario'),
        ('sales', 'Ventas'),
        ('reports', 'Reportes'),
    ]
    
    action = models.CharField(
        max_length=10,
        choices=PERMISSION_CHOICES,
        verbose_name='Acción'
    )
    resource = models.CharField(
        max_length=20,
        choices=RESOURCE_CHOICES,
        verbose_name='Recurso'
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Descripción'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha de creación'
    )
    
    class Meta:
        verbose_name = 'Permiso'
        verbose_name_plural = 'Permisos'
        unique_together = ['action', 'resource']
        ordering = ['resource', 'action']
    
    def __str__(self):
        return f"{self.get_action_display()} {self.get_resource_display()}"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model where email is used as the unique identifier
    """
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="El número de teléfono debe tener el formato: '+999999999'. Hasta 15 dígitos permitidos."
    )
    
    email = models.EmailField(
        unique=True,
        verbose_name='Correo electrónico'
    )
    first_name = models.CharField(
        max_length=30,
        verbose_name='Nombre'
    )
    last_name = models.CharField(
        max_length=30,
        verbose_name='Apellido'
    )
    phone = models.CharField(
        validators=[phone_regex],
        max_length=17,
        blank=True,
        null=True,
        verbose_name='Teléfono'
    )
    avatar = models.ImageField(
        upload_to='avatars/',
        blank=True,
        null=True,
        verbose_name='Avatar'
    )
    
    # Role relationship
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Rol'
    )
    
    # Custom permissions
    custom_permissions = models.ManyToManyField(
        Permission,
        blank=True,
        verbose_name='Permisos personalizados'
    )
    
    # Status fields
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    is_staff = models.BooleanField(
        default=False,
        verbose_name='Es staff'
    )
    is_verified = models.BooleanField(
        default=False,
        verbose_name='Email verificado'
    )
    
    # Timestamp fields
    date_joined = models.DateTimeField(
        default=timezone.now,
        verbose_name='Fecha de registro'
    )
    last_login = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name='Último login'
    )
    
    # Additional fields
    company = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Empresa'
    )
    position = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Cargo'
    )
    notes = models.TextField(
        blank=True,
        null=True,
        verbose_name='Notas'
    )
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
        ordering = ['-date_joined']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
    
    @property
    def full_name(self):
        """
        Returns the full name of the user
        """
        return f"{self.first_name} {self.last_name}".strip()
    
    def get_user_permissions(self):
        """
        Returns all permissions for this user including role permissions
        """
        permissions = set()
        
        # Add custom permissions
        for perm in self.custom_permissions.filter(is_active=True):
            permissions.add(f"{perm.action}_{perm.resource}")
        
        # Add role-based permissions
        if self.role and self.role.is_active:
            role_permissions = RolePermission.objects.filter(
                role=self.role,
                permission__is_active=True
            )
            for role_perm in role_permissions:
                perm = role_perm.permission
                permissions.add(f"{perm.action}_{perm.resource}")
        
        return list(permissions)
    
    def has_permission(self, action, resource):
        """
        Check if user has a specific permission
        """
        if self.is_superuser:
            return True
        
        permission_string = f"{action}_{resource}"
        return permission_string in self.get_user_permissions()


class RolePermission(models.Model):
    """
    Many-to-many relationship between Role and Permission
    """
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        verbose_name='Rol'
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        verbose_name='Permiso'
    )
    granted_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha de concesión'
    )
    
    class Meta:
        verbose_name = 'Permiso de rol'
        verbose_name_plural = 'Permisos de roles'
        unique_together = ['role', 'permission']
    
    def __str__(self):
        return f"{self.role} - {self.permission}"


class UserSession(models.Model):
    """
    Model to track user sessions and tokens
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        verbose_name='Usuario'
    )
    token_jti = models.CharField(
        max_length=255,
        unique=True,
        verbose_name='Token JTI'
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name='Dirección IP'
    )
    user_agent = models.TextField(
        blank=True,
        null=True,
        verbose_name='User Agent'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='Activo'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha de creación'
    )
    expires_at = models.DateTimeField(
        verbose_name='Fecha de expiración'
    )
    
    class Meta:
        verbose_name = 'Sesión de usuario'
        verbose_name_plural = 'Sesiones de usuario'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.email} - {self.created_at}"
