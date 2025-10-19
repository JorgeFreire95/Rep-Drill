from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, login, logout
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta

from .models import User, Role, Permission, UserSession
from .serializers import (
    UserRegistrationSerializer,
    CustomTokenObtainPairSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UserListSerializer,
    UserDetailSerializer,
    PasswordChangeSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    LogoutSerializer,
    TokenRefreshSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    RoleSerializer,
    PermissionSerializer
)
from .permissions import IsOwnerOrAdmin, IsAdminUser


class RegisterView(generics.CreateAPIView):
    """
    View for user registration
    """
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate tokens for the new user
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'message': 'Usuario registrado exitosamente',
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.full_name,
                'first_name': user.first_name,
                'last_name': user.last_name,
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom token obtain view that includes additional user information
    """
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            # Track user session
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.user
            
            # Create user session record
            refresh_token = RefreshToken.for_user(user)
            UserSession.objects.create(
                user=user,
                token_jti=str(refresh_token['jti']),
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                expires_at=timezone.now() + timedelta(days=1)
            )
            
            # Update last login
            user.last_login = timezone.now()
            user.save()
        
        return response
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class LoginView(APIView):
    """
    View for user login (alternative to TokenObtainPairView)
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        
        # Track user session
        UserSession.objects.create(
            user=user,
            token_jti=str(refresh['jti']),
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            expires_at=timezone.now() + timedelta(days=1)
        )
        
        # Update last login
        user.last_login = timezone.now()
        user.save()
        
        return Response({
            'message': 'Inicio de sesión exitoso',
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.full_name,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role.name if user.role else None,
                'is_staff': user.is_staff,
                'is_verified': user.is_verified,
                'avatar': user.avatar.url if user.avatar else None,
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })
    
    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class LogoutView(APIView):
    """
    View for user logout (blacklist refresh token)
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Deactivate user sessions
        refresh_token = RefreshToken(serializer.validated_data['refresh'])
        UserSession.objects.filter(
            user=request.user,
            token_jti=str(refresh_token['jti'])
        ).update(is_active=False)
        
        return Response({
            'message': 'Cierre de sesión exitoso'
        }, status=status.HTTP_200_OK)


class CustomTokenRefreshView(TokenRefreshView):
    """
    Custom token refresh view
    """
    serializer_class = TokenRefreshSerializer


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    View for user profile (get and update own profile)
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    """
    View for changing password
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'Contraseña cambiada exitosamente'
        })


class PasswordResetRequestView(APIView):
    """
    View for password reset request
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # TODO: Implement email sending logic here
        # For now, just return success message
        
        return Response({
            'message': 'Si el email existe, se ha enviado un enlace de restablecimiento de contraseña'
        })


class PasswordResetConfirmView(APIView):
    """
    View for password reset confirmation
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, uidb64=None, token=None):
        # TODO: Implement token validation logic
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        return Response({
            'message': 'Contraseña restablecida exitosamente'
        })


class UserViewSet(ModelViewSet):
    """
    ViewSet for user management (admin only)
    """
    queryset = User.objects.all()
    permission_classes = [IsAdminUser]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        elif self.action in ['create']:
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserDetailSerializer
    
    def get_queryset(self):
        queryset = User.objects.all()
        
        # Filter by role
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role__name=role)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Search functionality
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(company__icontains=search)
            )
        
        return queryset.order_by('-date_joined')
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a user"""
        user = self.get_object()
        user.is_active = True
        user.save()
        return Response({'message': 'Usuario activado exitosamente'})
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a user"""
        user = self.get_object()
        if user == request.user:
            return Response(
                {'error': 'No puedes desactivarte a ti mismo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.is_active = False
        user.save()
        return Response({'message': 'Usuario desactivado exitosamente'})
    
    @action(detail=True, methods=['post'])
    def verify_email(self, request, pk=None):
        """Verify user email"""
        user = self.get_object()
        user.is_verified = True
        user.save()
        return Response({'message': 'Email verificado exitosamente'})
    
    @action(detail=True, methods=['get'])
    def sessions(self, request, pk=None):
        """Get user sessions"""
        user = self.get_object()
        sessions = UserSession.objects.filter(user=user).order_by('-created_at')[:10]
        sessions_data = []
        for session in sessions:
            sessions_data.append({
                'id': session.id,
                'ip_address': session.ip_address,
                'user_agent': session.user_agent,
                'is_active': session.is_active,
                'created_at': session.created_at,
                'expires_at': session.expires_at
            })
        return Response(sessions_data)


class RoleViewSet(ModelViewSet):
    """
    ViewSet for role management
    """
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = Role.objects.all()
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('name')


class PermissionViewSet(ModelViewSet):
    """
    ViewSet for permission management
    """
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = Permission.objects.all()
        
        # Filter by resource
        resource = self.request.query_params.get('resource')
        if resource:
            queryset = queryset.filter(resource=resource)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset.order_by('resource', 'action')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_permissions(request):
    """
    Get current user's permissions
    """
    user = request.user
    permissions = user.get_user_permissions()
    
    return Response({
        'user_id': user.id,
        'permissions': permissions,
        'is_superuser': user.is_superuser
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def check_permission(request):
    """
    Check if user has specific permission
    """
    action = request.query_params.get('action')
    resource = request.query_params.get('resource')
    
    if not action or not resource:
        return Response(
            {'error': 'Se requieren parámetros action y resource'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    has_perm = user.has_permission(action, resource)
    
    return Response({
        'user_id': user.id,
        'action': action,
        'resource': resource,
        'has_permission': has_perm
    })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    Health check endpoint
    """
    return Response({
        'status': 'healthy',
        'service': 'auth-service',
        'timestamp': timezone.now()
    })


from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def token_interface(request):
    """
    Web interface for token management
    """
    return render(request, 'token_interface.html')
