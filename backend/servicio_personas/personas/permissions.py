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


class CanManageCustomers(permissions.BasePermission):
    """Permiso específico para gestionar clientes"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Para operaciones de lectura, siempre permitir
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Para operaciones de escritura, verificar permisos
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                permissions_list = decoded.get('permissions', [])
                
                # Verificar según el método HTTP
                if request.method == 'POST':
                    return 'create_customers' in permissions_list
                elif request.method in ['PUT', 'PATCH']:
                    return 'update_customers' in permissions_list
                elif request.method == 'DELETE':
                    return 'delete_customers' in permissions_list
                    
            except:
                return False
        
        return False


class CanManageEmployees(permissions.BasePermission):
    """Permiso específico para gestionar empleados"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Para operaciones de lectura
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Para operaciones de escritura
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                permissions_list = decoded.get('permissions', [])
                
                # Solo admin puede gestionar empleados
                if request.method == 'POST':
                    return 'create_employees' in permissions_list
                elif request.method in ['PUT', 'PATCH']:
                    return 'update_employees' in permissions_list
                elif request.method == 'DELETE':
                    return 'delete_employees' in permissions_list
                    
            except:
                return False
        
        return False


class CanManageSuppliers(permissions.BasePermission):
    """Permiso específico para gestionar proveedores"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Para operaciones de lectura
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Para operaciones de escritura
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                permissions_list = decoded.get('permissions', [])
                
                # Verificar según el método HTTP
                if request.method == 'POST':
                    return 'create_suppliers' in permissions_list
                elif request.method in ['PUT', 'PATCH']:
                    return 'update_suppliers' in permissions_list
                elif request.method == 'DELETE':
                    return 'delete_suppliers' in permissions_list
                    
            except:
                return False
        
        return False


class CanManageReps(permissions.BasePermission):
    """Permiso específico para gestionar representantes"""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Para operaciones de lectura
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Para operaciones de escritura
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                permissions_list = decoded.get('permissions', [])
                
                # Solo admin puede gestionar representantes
                if request.method == 'POST':
                    return 'create_reps' in permissions_list
                elif request.method in ['PUT', 'PATCH']:
                    return 'update_reps' in permissions_list
                elif request.method == 'DELETE':
                    return 'delete_reps' in permissions_list
                    
            except:
                return False
        
        return False
