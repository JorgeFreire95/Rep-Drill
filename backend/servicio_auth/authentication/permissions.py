from rest_framework import permissions


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object or admins to access it.
    """
    
    def has_permission(self, request, view):
        # Allow authenticated users
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to the owner or admin
        # Write permissions are only allowed to the owner of the object or admin
        return obj == request.user or request.user.is_staff or request.user.is_superuser


class IsAdminUser(permissions.BasePermission):
    """
    Custom permission to only allow admin users.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_staff or request.user.is_superuser)
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Custom permission to allow read access to authenticated users
    and write access only to admin users.
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_staff or request.user.is_superuser)
        )


class HasCustomPermission(permissions.BasePermission):
    """
    Custom permission that checks against our custom permission system
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Superusers have all permissions
        if request.user.is_superuser:
            return True
        
        # Get the required permission from the view
        required_permission = getattr(view, 'required_permission', None)
        if not required_permission:
            return True
        
        action, resource = required_permission.split('_', 1)
        return request.user.has_permission(action, resource)


class IsVerifiedUser(permissions.BasePermission):
    """
    Custom permission to only allow verified users.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_verified
        )


class IsActiveUser(permissions.BasePermission):
    """
    Custom permission to only allow active users.
    """
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.is_active
        )


class CanManageUsers(permissions.BasePermission):
    """
    Permission to manage users (create, update, delete)
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        return request.user.has_permission('create', 'users') or request.user.is_staff


class CanViewUsers(permissions.BasePermission):
    """
    Permission to view users
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        return request.user.has_permission('read', 'users') or request.user.is_staff