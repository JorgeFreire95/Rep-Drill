from rest_framework import permissions
import jwt
from django.conf import settings


class HasPermission(permissions.BasePermission):
    """
    Verifica permisos desde el token JWT
    """
    required_permission = None  # Definir en cada vista
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Obtener el token del header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return False
        
        token = auth_header.split(' ')[1]
        
        try:
            # Decodificar el token para obtener los permisos
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_permissions = decoded.get('permissions', [])
            
            # Verificar si tiene el permiso requerido
            required = getattr(view, 'required_permission', None)
            if not required:
                return True  # No requiere permiso específico
            
            return required in user_permissions
            
        except jwt.ExpiredSignatureError:
            return False
        except jwt.InvalidTokenError:
            return False


class CanManageProducts(permissions.BasePermission):
    """Permiso para gestionar productos"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return False
        
        token = auth_header.split(' ')[1]
        
        try:
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            permissions_list = decoded.get('permissions', [])
            
            # Vendedores solo pueden ver productos
            if request.method in permissions.SAFE_METHODS:
                return 'read_products' in permissions_list or 'list_products' in permissions_list
            
            # Solo admins pueden modificar productos
            if request.method == 'POST':
                return 'create_products' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_products' in permissions_list
            elif request.method == 'DELETE':
                return 'delete_products' in permissions_list
                
        except:
            return False
        
        return False


class CanManageInventory(permissions.BasePermission):
    """Permiso para gestionar inventario"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return False
        
        token = auth_header.split(' ')[1]
        
        try:
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            permissions_list = decoded.get('permissions', [])
            
            # Vendedores solo pueden ver inventario
            if request.method in permissions.SAFE_METHODS:
                return 'read_inventory' in permissions_list or 'list_inventory' in permissions_list
            
            # Solo admins pueden modificar inventario
            if request.method == 'POST':
                return 'create_inventory' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_inventory' in permissions_list
            elif request.method == 'DELETE':
                return 'delete_inventory' in permissions_list
                
        except:
            return False
        
        return False


class CanManageWarehouses(permissions.BasePermission):
    """Permiso para gestionar bodegas"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return False
        
        token = auth_header.split(' ')[1]
        
        try:
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            permissions_list = decoded.get('permissions', [])
            
            # Vendedores solo pueden ver bodegas
            if request.method in permissions.SAFE_METHODS:
                return 'read_warehouses' in permissions_list or 'list_warehouses' in permissions_list
            
            # Solo admins pueden modificar bodegas
            if request.method == 'POST':
                return 'create_warehouses' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_warehouses' in permissions_list
            elif request.method == 'DELETE':
                return 'delete_warehouses' in permissions_list
                
        except:
            return False
        
        return False


class CanManageCategories(permissions.BasePermission):
    """Permiso para gestionar categorías"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return False
        
        token = auth_header.split(' ')[1]
        
        try:
            decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            permissions_list = decoded.get('permissions', [])
            
            # Vendedores solo pueden ver categorías
            if request.method in permissions.SAFE_METHODS:
                return True  # Cualquiera puede ver categorías
            
            # Solo admins pueden modificar categorías
            if request.method == 'POST':
                return 'create_categories' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_categories' in permissions_list
            elif request.method == 'DELETE':
                return 'delete_categories' in permissions_list
                
        except:
            return False
        
        return False
