"""
Performance Optimization Configuration for rep_drill
Includes caching, connection pooling, and query optimization
"""

# ============================================================================
# Database Connection Pooling
# ============================================================================

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'rep_drill_db',
        'USER': 'postgres',
        'PASSWORD': 'postgres',
        'HOST': 'db',
        'PORT': '5432',
        'CONN_MAX_AGE': 600,  # Connection pooling: 10 minutes
        'OPTIONS': {
            'connect_timeout': 10,
            'options': '-c default_transaction_isolation=read_committed',
        },
        'ATOMIC_REQUESTS': False,  # Manual transaction management for better performance
    }
}

# ============================================================================
# Cache Configuration - Multi-tier caching strategy
# ============================================================================

CACHES = {
    # L1: Local memory cache (fast, per-process)
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
        'TIMEOUT': 300,  # 5 minutes
        'OPTIONS': {
            'MAX_ENTRIES': 10000,
        }
    },
    
    # L2: Redis cache (shared across all processes)
    'redis': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://redis:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 50,
                'retry_on_timeout': True,
            },
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'IGNORE_EXCEPTIONS': True,  # Prevent cache failures from breaking app
        },
        'TIMEOUT': 300,
    },
    
    # Session storage in Redis
    'session': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://redis:6379/2',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    },
}

# Use Redis for session storage
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'session'

# Use Redis for cache framework
CACHES_DEFAULT_CACHE = 'redis'

# ============================================================================
# Query Optimization
# ============================================================================

DATABASE_QUERY_TIMEOUT = 30  # seconds

# Enable query logging only in debug mode
if DEBUG:
    LOGGING['loggers']['django.db.backends'] = {
        'handlers': ['console'],
        'level': 'DEBUG',
    }

# ============================================================================
# Static Files and Media - CDN Configuration
# ============================================================================

STATIC_URL = '/static/'
STATIC_ROOT = '/app/staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = '/app/media'

# Whitenoise for efficient static file serving
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ============================================================================
# Template Caching
# ============================================================================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
            'loaders': [
                ('django.template.loaders.cached.Loader', [
                    'django.template.loaders.filesystem.Loader',
                    'django.template.loaders.app_directories.Loader',
                ]),
            ] if not DEBUG else [
                'django.template.loaders.filesystem.Loader',
                'django.template.loaders.app_directories.Loader',
            ],
        },
    },
]

# ============================================================================
# REST Framework Performance Settings
# ============================================================================

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 100,
    'MAX_PAGE_SIZE': 1000,
    
    # Use compiled regex for routing
    'URL_REGEX_MATCH': r'^\.json$',
    
    # Reduce serializer overhead
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    
    # Use database transactions for atomic operations
    'DEFAULT_METADATA_CLASS': 'rest_framework.metadata.SimpleMetadata',
}

# ============================================================================
# Celery Performance Configuration
# ============================================================================

CELERY_BROKER_URL = 'redis://redis:6379/0'
CELERY_RESULT_BACKEND = 'redis://redis:6379/0'

# Connection pooling for Celery
CELERY_BROKER_POOL_LIMIT = 10
CELERY_BROKER_CONNECTION_RETRY = True
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

# Task configuration
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_ACCEPT_CONTENT = ['json']

# Performance tuning
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit
CELERY_TASK_MAX_RETRIES = 3
CELERY_TASK_DEFAULT_RETRY_DELAY = 60

# Result backend cleanup (auto-delete after 24 hours)
CELERY_RESULT_EXPIRES = 86400

# Reduce memory usage
CELERY_WORKER_PREFETCH_MULTIPLIER = 4
CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000

# ============================================================================
# Response Compression
# ============================================================================

MIDDLEWARE = [
    'django.middleware.gzip.GZipMiddleware',
    # ... other middleware
]

# Gzip compression settings
GZIP_LEVEL = 6
GZIP_MINIMUM_LENGTH = 1024  # Only compress responses > 1KB

# ============================================================================
# HTTP Caching Headers
# ============================================================================

# Cache-Control headers for different response types
CACHE_CONTROL_HEADERS = {
    'default': 'public, max-age=3600',  # 1 hour
    'static': 'public, max-age=31536000, immutable',  # 1 year for static assets
    'api': 'private, max-age=300',  # 5 minutes for API responses
    'user_specific': 'private, no-store, must-revalidate',  # No cache for user-specific data
}

# ============================================================================
# Database Query Optimization
# ============================================================================

# Use select_related and prefetch_related in queries
# Example in views.py:
# queryset = User.objects.select_related('profile').prefetch_related('posts')

# Enable query result caching for expensive operations
# from django.views.decorators.cache import cache_page
# @cache_page(60 * 5)  # Cache for 5 minutes
# def expensive_view(request):
#     pass

# ============================================================================
# Async Views (Django 3.1+)
# ============================================================================

# Enable async views for I/O-bound operations
ASGI_APPLICATION = 'servicio_ventas.asgi.application'

# ============================================================================
# PostgreSQL Optimization
# ============================================================================

# Connection pooling via pgBouncer (if using external pooler)
# Update postgresql.conf settings:
# max_connections = 100
# shared_buffers = 256MB (25% of RAM)
# effective_cache_size = 1GB (50-75% of RAM)
# maintenance_work_mem = 64MB
# random_page_cost = 1.1 (for SSD)

# ============================================================================
# Redis Optimization
# ============================================================================

# Redis memory optimization settings:
# maxmemory-policy allkeys-lru  (evict least recently used)
# maxmemory 512mb (adjust based on available RAM)

# ============================================================================
# Application-level Performance Tips
# ============================================================================

"""
1. Database Indexes:
   - Index frequently queried columns
   - Index foreign keys
   - Use composite indexes for common filters
   
2. N+1 Query Prevention:
   - Use select_related() for ForeignKey and OneToOne
   - Use prefetch_related() for reverse ForeignKey and ManyToMany
   - Use queryset.only() to fetch specific columns
   
3. Caching Strategy:
   - Cache expensive API responses (GET /api/stats/)
   - Cache serializer outputs
   - Cache user permissions
   - Use cache warming strategies
   
4. Pagination:
   - Always paginate large result sets
   - Use keyset pagination for better performance
   
5. Async Tasks:
   - Offload long-running operations to Celery
   - Process images/files asynchronously
   - Send emails in background
   
6. Connection Management:
   - Use connection pooling (PgBouncer, Redis)
   - Set appropriate timeouts
   - Close unused connections
   
7. Monitoring:
   - Monitor query execution times
   - Track cache hit/miss ratios
   - Monitor memory usage
   - Profile CPU-intensive operations
   
8. Database Maintenance:
   - Regular VACUUM and ANALYZE
   - Monitor table bloat
   - Archive old data
   - Use partitioning for large tables
"""

# ============================================================================
# Performance Monitoring
# ============================================================================

# Middleware to track request/response times
class PerformanceMonitoringMiddleware:
    """
    Logs performance metrics for each request.
    Used with New Relic, Datadog, or similar APM solutions.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        import time
        start_time = time.time()
        
        response = self.get_response(request)
        
        duration = time.time() - start_time
        
        # Log if request took more than 1 second
        if duration > 1.0:
            logger.warning(f'Slow request: {request.path} took {duration:.2f}s')
        
        response['X-Response-Time'] = f'{duration:.3f}s'
        return response

# Add to MIDDLEWARE list to enable:
# 'performance.PerformanceMonitoringMiddleware',
