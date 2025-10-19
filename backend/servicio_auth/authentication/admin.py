from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Role, Permission, RolePermission, UserSession


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Admin configuration for custom User model
    """
    list_display = ['email', 'first_name', 'last_name', 'role', 'is_active', 'is_staff', 'is_verified', 'date_joined']
    list_filter = ['is_active', 'is_staff', 'is_superuser', 'is_verified', 'role', 'date_joined']
    search_fields = ['email', 'first_name', 'last_name', 'company']
    ordering = ['-date_joined']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'phone', 'avatar', 'company', 'position')}),
        (_('Permissions'), {
            'fields': ('role', 'custom_permissions', 'is_active', 'is_staff', 'is_superuser', 'is_verified'),
        }),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
        (_('Additional info'), {'fields': ('notes',)}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )
    
    filter_horizontal = ('custom_permissions', 'groups', 'user_permissions')
    readonly_fields = ['date_joined', 'last_login']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """
    Admin configuration for Role model
    """
    list_display = ['name', 'get_name_display', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['name']
    readonly_fields = ['created_at']
    
    fieldsets = (
        (None, {'fields': ('name', 'description')}),
        (_('Status'), {'fields': ('is_active',)}),
        (_('Dates'), {'fields': ('created_at',)}),
    )


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    """
    Admin configuration for Permission model
    """
    list_display = ['get_action_display', 'get_resource_display', 'action', 'resource', 'is_active', 'created_at']
    list_filter = ['action', 'resource', 'is_active', 'created_at']
    search_fields = ['action', 'resource', 'description']
    ordering = ['resource', 'action']
    readonly_fields = ['created_at']
    
    fieldsets = (
        (None, {'fields': ('action', 'resource', 'description')}),
        (_('Status'), {'fields': ('is_active',)}),
        (_('Dates'), {'fields': ('created_at',)}),
    )


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    """
    Admin configuration for RolePermission model
    """
    list_display = ['role', 'permission', 'granted_at']
    list_filter = ['role', 'granted_at']
    search_fields = ['role__name', 'permission__action', 'permission__resource']
    ordering = ['-granted_at']
    readonly_fields = ['granted_at']
    
    fieldsets = (
        (None, {'fields': ('role', 'permission')}),
        (_('Dates'), {'fields': ('granted_at',)}),
    )


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    """
    Admin configuration for UserSession model
    """
    list_display = ['user', 'ip_address', 'is_active', 'created_at', 'expires_at']
    list_filter = ['is_active', 'created_at', 'expires_at']
    search_fields = ['user__email', 'ip_address', 'token_jti']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'token_jti']
    
    fieldsets = (
        (None, {'fields': ('user', 'token_jti')}),
        (_('Session Info'), {'fields': ('ip_address', 'user_agent', 'is_active')}),
        (_('Dates'), {'fields': ('created_at', 'expires_at')}),
    )
    
    def has_add_permission(self, request):
        # Prevent manual creation of sessions through admin
        return False


# Customize admin site headers
admin.site.site_header = "Rep Drill - Servicio de Autenticación"
admin.site.site_title = "Admin Auth Service"
admin.site.index_title = "Administración de Autenticación"
