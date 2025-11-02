"""
Django CSRF and API Security Configuration
"""

from django.middleware.csrf import CsrfViewMiddleware
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


# ============================================================================
# CSRF Configuration
# ============================================================================

CSRF_COOKIE_SECURE = True  # Only send cookie over HTTPS
CSRF_COOKIE_HTTPONLY = False  # Must be False for JavaScript to read CSRF token
CSRF_COOKIE_SAMESITE = 'Strict'  # Prevent CSRF attacks
CSRF_COOKIE_AGE = 31449600  # One year
CSRF_COOKIE_DOMAIN = None  # Set based on your domain
CSRF_HEADER_NAME = 'HTTP_X_CSRFTOKEN'
CSRF_FAILURE_VIEW = 'rest_framework.exceptions.csrf_failure'
CSRF_TRUSTED_ORIGINS = [
    'https://rep-drill.local',
    'https://*.rep-drill.local',
    'http://localhost:3000',
    'http://localhost:5173',
]

# ============================================================================
# Rate Throttling Configuration
# ============================================================================

class StandardUserThrottle(UserRateThrottle):
    """Standard rate throttle for authenticated users."""
    scope = 'standard_user'


class BurstUserThrottle(UserRateThrottle):
    """Burst rate throttle for authenticated users."""
    scope = 'burst'


class StandardAnonThrottle(AnonRateThrottle):
    """Standard rate throttle for anonymous users."""
    scope = 'anon'


class BurstAnonThrottle(AnonRateThrottle):
    """Burst rate throttle for anonymous users."""
    scope = 'anon_burst'


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'security_config.StandardUserThrottle',
        'security_config.StandardAnonThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'standard_user': '1000/hour',
        'burst': '100/minute',
        'anon': '100/hour',
        'anon_burst': '10/minute',
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'MAX_PAGE_SIZE': 1000,
}

# ============================================================================
# Content Security Policy (CSP) Configuration
# ============================================================================

CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "'unsafe-eval'")
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_FONT_SRC = ("'self'", "data:")
CSP_CONNECT_SRC = ("'self'",)
CSP_FRAME_ANCESTORS = ("'none'",)
CSP_BASE_URI = ("'self'",)
CSP_FORM_ACTION = ("'self'",)

# ============================================================================
# JWT Configuration for Token Authentication
# ============================================================================

from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': 'your-secret-key-here',  # Use environment variable!
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'JTI_CLAIM': 'jti',
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_IN_BLACKLIST_CLAIM': 'jti',
    'TOKEN_USER_CLASS': 'rest_framework_simplejwt.models.TokenUser',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'AUTH_REFRESH_CLASSES': ('rest_framework_simplejwt.tokens.RefreshToken',),
    'AUTH_COOKIE': 'access_token',  # Cookie name for storing JWT
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': True,
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_SAMESITE': 'Strict',
}

# ============================================================================
# API Key Security (if needed)
# ============================================================================

API_KEY_HEADER = 'X-API-Key'
API_KEY_PERMISSIONS = 'IsAuthenticated'

# ============================================================================
# Security Middleware Configuration
# ============================================================================

MIDDLEWARE = [
    # ... other middleware ...
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'security_middleware.SecurityHeadersMiddleware',
    'security_middleware.SecurityAuditMiddleware',  # NEW: Audit suspicious activity
    'security_middleware.RateLimitMiddleware',
    'security_middleware.RequestLoggingMiddleware',
    'security_middleware.CORSMiddleware',
    'security_middleware.IPWhitelistMiddleware',
]

# ============================================================================
# HTTPS and Security Settings
# ============================================================================

SECURE_SSL_REDIRECT = True  # Redirect HTTP to HTTPS
SESSION_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_SECURITY_POLICY = True
SECURE_REFERRER_POLICY = 'same-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'

# Additional security headers
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# ============================================================================
# CORS Configuration
# ============================================================================

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://rep-drill.local',
]

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-api-key',
]

# ============================================================================
# IP Whitelist Configuration (for admin endpoints)
# ============================================================================

IP_WHITELIST = {
    '/admin/': ['127.0.0.1', '::1', '172.16.0.0/12'],  # Docker network
    '/api/admin/': ['127.0.0.1', '::1', '172.16.0.0/12'],
}

# ============================================================================
# Session Security
# ============================================================================

SESSION_COOKIE_AGE = 1209600  # 2 weeks
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Strict'
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# ============================================================================
# Password Validation
# ============================================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 12,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# ============================================================================
# Logging Configuration
# ============================================================================

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            'class': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        },
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
        'security': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/django/security.log',
            'maxBytes': 1024 * 1024 * 10,
            'backupCount': 10,
            'formatter': 'json',
        },
        'security_audit': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/django/security_audit.log',
            'maxBytes': 1024 * 1024 * 10,
            'backupCount': 20,
            'formatter': 'json',
        },
        'access': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/django/access.log',
            'maxBytes': 1024 * 1024 * 10,
            'backupCount': 10,
            'formatter': 'json',
        },
    },
    'loggers': {
        'django.security': {
            'handlers': ['security', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'security.audit': {
            'handlers': ['security_audit', 'console'],
            'level': 'INFO',
            'propagate': False,
        },
        'access': {
            'handlers': ['access'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
