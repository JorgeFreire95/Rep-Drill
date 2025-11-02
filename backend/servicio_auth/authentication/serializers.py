from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Role, Permission, RolePermission


class RoleSerializer(serializers.ModelSerializer):
    """
    Serializer for Role model
    """
    permissions_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Role
        fields = [
            'id',
            'name',
            'description',
            'is_active',
            'created_at',
            'permissions_count'
        ]
        read_only_fields = ['id', 'created_at', 'permissions_count']
    
    def get_permissions_count(self, obj):
        return RolePermission.objects.filter(role=obj).count()


class PermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for Permission model
    """
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    resource_display = serializers.CharField(source='get_resource_display', read_only=True)
    
    class Meta:
        model = Permission
        fields = [
            'id',
            'action',
            'resource',
            'action_display',
            'resource_display',
            'description',
            'is_active',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'action_display', 'resource_display']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for user registration
    """
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = [
            'email',
            'password',
            'password_confirm',
            'first_name',
            'last_name',
            'phone',
            'company',
            'position'
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Los campos de contraseña no coinciden."
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm', None)
        user = User.objects.create_user(**validated_data)
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token serializer that includes additional user information and permissions
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Obtener permisos del usuario
        permissions = self.user.get_user_permissions()
        
        # Add extra responses here with permissions
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'full_name': self.user.full_name,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': self.user.role.name if self.user.role else None,
            'is_staff': self.user.is_staff,
            'is_verified': self.user.is_verified,
            'avatar': self.user.avatar.url if self.user.avatar else None,
            'permissions': permissions
        }
        return data
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Agregar permisos al token JWT
        token['permissions'] = user.get_user_permissions()
        token['email'] = user.email
        token['role'] = user.role.name if user.role else None
        
        return token


class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(
                request=self.context.get('request'),
                username=email,
                password=password
            )
            
            if not user:
                msg = 'No se pudo acceder con las credenciales proporcionadas.'
                raise serializers.ValidationError(msg, code='authorization')
            
            if not user.is_active:
                msg = 'La cuenta de usuario está desactivada.'
                raise serializers.ValidationError(msg, code='authorization')
            
            attrs['user'] = user
            return attrs
        else:
            msg = 'Debe incluir "email" y "password".'
            raise serializers.ValidationError(msg, code='authorization')


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for user profile (read and update)
    """
    role_display = serializers.CharField(source='role.get_name_display', read_only=True)
    permissions = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone',
            'avatar',
            'role',
            'role_display',
            'company',
            'position',
            'notes',
            'is_active',
            'is_verified',
            'date_joined',
            'last_login',
            'permissions'
        ]
        read_only_fields = [
            'id',
            'email',
            'is_active',
            'is_verified',
            'date_joined',
            'last_login',
            'role_display',
            'permissions'
        ]
    
    def get_permissions(self, obj):
        return obj.get_user_permissions()


class UserListSerializer(serializers.ModelSerializer):
    """
    Serializer for listing users (minimal information)
    """
    full_name = serializers.SerializerMethodField()
    role = RoleSerializer(read_only=True)
    created_at = serializers.DateTimeField(source='date_joined', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone',
            'role',
            'is_active',
            'is_staff',
            'is_verified',
            'last_login',
            'created_at',
            'avatar'
        ]
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Serializer for user detail view (for admins)
    """
    role_detail = RoleSerializer(source='role', read_only=True)
    custom_permissions_detail = PermissionSerializer(
        source='custom_permissions',
        many=True,
        read_only=True
    )
    all_permissions = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone',
            'avatar',
            'role',
            'role_detail',
            'custom_permissions',
            'custom_permissions_detail',
            'company',
            'position',
            'notes',
            'is_active',
            'is_staff',
            'is_verified',
            'date_joined',
            'last_login',
            'all_permissions'
        ]
    
    def get_all_permissions(self, obj):
        return obj.get_user_permissions()


class PasswordChangeSerializer(serializers.Serializer):
    """
    Serializer for changing password
    """
    old_password = serializers.CharField(
        required=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        required=True,
        style={'input_type': 'password'}
    )
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('La contraseña actual es incorrecta.')
        return value
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                "new_password": "Los campos de contraseña nueva no coinciden."
            })
        return attrs
    
    def save(self, **kwargs):
        password = self.validated_data['new_password']
        user = self.context['request'].user
        user.set_password(password)
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Serializer for password reset request
    """
    email = serializers.EmailField(required=True)
    
    def validate_email(self, value):
        try:
            user = User.objects.get(email=value, is_active=True)
        except User.DoesNotExist:
            # Por seguridad, no revelamos si el email existe o no
            pass
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Serializer for password reset confirmation
    """
    new_password = serializers.CharField(
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        required=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                "new_password": "Los campos de contraseña no coinciden."
            })
        return attrs


class TokenRefreshSerializer(serializers.Serializer):
    """
    Serializer for token refresh
    """
    refresh = serializers.CharField()
    
    def validate(self, attrs):
        refresh = RefreshToken(attrs['refresh'])
        data = {
            'access': str(refresh.access_token)
        }
        return data


class LogoutSerializer(serializers.Serializer):
    """
    Serializer for logout (blacklist refresh token)
    """
    refresh = serializers.CharField()
    
    def validate(self, attrs):
        self.token = attrs['refresh']
        return attrs
    
    def save(self, **kwargs):
        try:
            RefreshToken(self.token).blacklist()
        except Exception as e:
            raise serializers.ValidationError('Token inválido')


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating users (admin only)
    """
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    
    class Meta:
        model = User
        fields = [
            'email',
            'password',
            'first_name',
            'last_name',
            'phone',
            'avatar',
            'role',
            'custom_permissions',
            'company',
            'position',
            'notes',
            'is_active',
            'is_staff',
            'is_verified'
        ]
    
    def create(self, validated_data):
        custom_permissions = validated_data.pop('custom_permissions', [])
        user = User.objects.create_user(**validated_data)
        if custom_permissions:
            user.custom_permissions.set(custom_permissions)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating users (admin only)
    """
    class Meta:
        model = User
        fields = [
            'first_name',
            'last_name',
            'phone',
            'avatar',
            'role',
            'custom_permissions',
            'company',
            'position',
            'notes',
            'is_active',
            'is_staff',
            'is_verified'
        ]
    
    def update(self, instance, validated_data):
        custom_permissions = validated_data.pop('custom_permissions', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if custom_permissions is not None:
            instance.custom_permissions.set(custom_permissions)
        
        return instance