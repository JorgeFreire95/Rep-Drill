from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenVerifyView

from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    LoginView,
    LogoutView,
    CustomTokenRefreshView,
    UserProfileView,
    PasswordChangeView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    UserViewSet,
    RoleViewSet,
    PermissionViewSet,
    user_permissions,
    check_permission,
    health_check,
    token_interface,
    create_employee_user,
)

# Create router for ViewSets
router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'roles', RoleViewSet)
router.register(r'permissions', PermissionViewSet)

urlpatterns = [
    # Web Interface
    path('', token_interface, name='token-interface'),
    
    # Health check
    path('health/', health_check, name='health-check'),
    
    # Authentication endpoints
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # ✅ NUEVO: Admin puede crear empleados
    path('create-employee/', create_employee_user, name='create-employee'),
    
    # JWT Token endpoints
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # User profile endpoints
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('change-password/', PasswordChangeView.as_view(), name='change-password'),
    
    # Password reset endpoints
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset-confirm/<uidb64>/<token>/', 
         PasswordResetConfirmView.as_view(), 
         name='password-reset-confirm'),
    
    # Permission endpoints
    path('my-permissions/', user_permissions, name='user-permissions'),
    path('check-permission/', check_permission, name='check-permission'),
    
    # Admin endpoints (ViewSets)
    path('admin/', include(router.urls)),
]

# Alternative URL patterns for specific admin actions
admin_patterns = [
    path('admin/users/<int:pk>/activate/', 
         UserViewSet.as_view({'post': 'activate'}), 
         name='admin-user-activate'),
    path('admin/users/<int:pk>/deactivate/', 
         UserViewSet.as_view({'post': 'deactivate'}), 
         name='admin-user-deactivate'),
    path('admin/users/<int:pk>/verify-email/', 
         UserViewSet.as_view({'post': 'verify_email'}), 
         name='admin-user-verify-email'),
    path('admin/users/<int:pk>/sessions/', 
         UserViewSet.as_view({'get': 'sessions'}), 
         name='admin-user-sessions'),
]

urlpatterns += admin_patterns