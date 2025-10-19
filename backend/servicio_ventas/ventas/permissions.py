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


class CanManageSales(permissions.BasePermission):
    """Permiso para gestionar ventas (orders)"""
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
            
            # Vendedores pueden ver y crear ventas
            if request.method in permissions.SAFE_METHODS:
                return 'read_sales' in permissions_list or 'list_sales' in permissions_list
            
            if request.method == 'POST':
                return 'create_sales' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_sales' in permissions_list
            elif request.method == 'DELETE':
                # Solo admins pueden anular ventas
                return 'delete_sales' in permissions_list
                
        except:
            return False
        
        return False


class CanManageOrderDetails(permissions.BasePermission):
    """Permiso para gestionar detalles de orden"""
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
            
            # Vendedores pueden ver y crear detalles de orden
            if request.method in permissions.SAFE_METHODS:
                return 'read_sales' in permissions_list or 'list_sales' in permissions_list
            
            if request.method == 'POST':
                return 'create_sales' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_sales' in permissions_list
            elif request.method == 'DELETE':
                return 'delete_sales' in permissions_list
                
        except:
            return False
        
        return False


class CanManageShipments(permissions.BasePermission):
    """Permiso para gestionar envíos"""
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
            
            # Vendedores pueden ver envíos
            if request.method in permissions.SAFE_METHODS:
                return 'read_shipments' in permissions_list or 'read_sales' in permissions_list
            
            # Solo admins pueden gestionar envíos
            if request.method == 'POST':
                return 'create_shipments' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_shipments' in permissions_list
            elif request.method == 'DELETE':
                return 'delete_shipments' in permissions_list
                
        except:
            return False
        
        return False


class CanManagePayments(permissions.BasePermission):
    """Permiso para gestionar pagos"""
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
            
            # Vendedores pueden ver y crear pagos
            if request.method in permissions.SAFE_METHODS:
                return 'read_payments' in permissions_list or 'read_sales' in permissions_list
            
            if request.method == 'POST':
                return 'create_payments' in permissions_list or 'create_sales' in permissions_list
            elif request.method in ['PUT', 'PATCH']:
                return 'update_payments' in permissions_list
            elif request.method == 'DELETE':
                # Solo admins pueden eliminar pagos
                return 'delete_payments' in permissions_list
                
        except:
            return False
        
        return False
