import logging
import time
import re
from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)
security_audit_logger = logging.getLogger('security.audit')


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Add security headers to all responses."""

    def process_response(self, request, response):
        # Content Security Policy
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        # Other security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = (
            'geolocation=(), '
            'microphone=(), '
            'camera=(), '
            'payment=(), '
            'usb=(), '
            'magnetometer=(), '
            'gyroscope=(), '
            'accelerometer=()'
        )

        # HSTS (only in production)
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

        return response


class RateLimitMiddleware(MiddlewareMixin):
    """Rate limiting middleware using cache."""

    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response

    def process_request(self, request):
        # Get client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        client_ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR')

        # Get rate limit key from cache
        cache_key = f'rate_limit:{client_ip}:{request.path}'
        request_count = cache.get(cache_key, 0)

        # Different limits for different endpoints
        if request.path.startswith('/api/auth/'):
            limit = 5  # 5 requests per minute for auth
            window = 60
        elif request.path.startswith('/api/'):
            limit = 100  # 100 requests per minute for API
            window = 60
        else:
            limit = 1000  # 1000 requests per minute for other endpoints
            window = 60

        if request_count >= limit:
            logger.warning(f'Rate limit exceeded for IP {client_ip} on {request.path}')
            return JsonResponse(
                {'error': 'Rate limit exceeded. Please try again later.'},
                status=429
            )

        # Increment counter
        cache.set(cache_key, request_count + 1, window)
        request.client_ip = client_ip

        return None


class RequestLoggingMiddleware(MiddlewareMixin):
    """Log all requests with timing and user information."""

    def process_request(self, request):
        request._start_time = time.time()
        request.request_id = self._generate_request_id()
        
        # Add request ID to response headers
        return None

    def process_response(self, request, response):
        if hasattr(request, '_start_time'):
            duration_ms = (time.time() - request._start_time) * 1000
        else:
            duration_ms = 0

        # Log request details
        log_data = {
            'request_id': getattr(request, 'request_id', 'N/A'),
            'method': request.method,
            'path': request.path,
            'status': response.status_code,
            'duration_ms': duration_ms,
            'client_ip': getattr(request, 'client_ip', request.META.get('REMOTE_ADDR')),
        }

        # Add user info if authenticated
        if request.user.is_authenticated:
            log_data['user_id'] = request.user.id
            log_data['username'] = request.user.username

        # Log slow requests
        if duration_ms > 1000:
            logger.warning(f'Slow request: {log_data}')
        else:
            logger.info(f'Request: {log_data}')

        # Add request ID to response headers
        response['X-Request-ID'] = log_data['request_id']

        return response

    @staticmethod
    def _generate_request_id():
        """Generate a unique request ID."""
        import uuid
        return str(uuid.uuid4())


class CORSMiddleware(MiddlewareMixin):
    """CORS middleware for cross-origin requests."""

    ALLOWED_ORIGINS = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
    ]

    def __init__(self, get_response):
        super().__init__(get_response)
        if not settings.DEBUG:
            # In production, only allow configured origins
            self.ALLOWED_ORIGINS = getattr(settings, 'CORS_ALLOWED_ORIGINS', [])

    def process_request(self, request):
        if request.method == 'OPTIONS':
            return self._handle_preflight(request)
        return None

    def process_response(self, request, response):
        origin = request.META.get('HTTP_ORIGIN', '')

        if origin in self.ALLOWED_ORIGINS or '*' in self.ALLOWED_ORIGINS:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
            response['Access-Control-Allow-Headers'] = (
                'Content-Type, Authorization, X-Requested-With, X-Request-ID'
            )
            response['Access-Control-Max-Age'] = '3600'

        return response

    def _handle_preflight(self, request):
        return JsonResponse(status=200)


class IPWhitelistMiddleware(MiddlewareMixin):
    """Restrict access to specific IP addresses for admin endpoints."""

    def process_request(self, request):
        # Get whitelist from settings
        whitelist = getattr(settings, 'IP_WHITELIST', {})

        # Check if this is a protected path
        for path_pattern, allowed_ips in whitelist.items():
            if request.path.startswith(path_pattern):
                client_ip = self._get_client_ip(request)

                if client_ip not in allowed_ips:
                    logger.warning(f'IP whitelist violation: {client_ip} accessing {request.path}')
                    return JsonResponse(
                        {'error': 'Access denied'},
                        status=403
                    )

        return None

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class SecurityAuditMiddleware(MiddlewareMixin):
    """
    Auditar intentos de acceso sospechosos y patrones de ataque.
    
    Detecta:
    - Path traversal (../)
    - XSS attempts (<script>, javascript:)
    - SQL injection (union select, drop table)
    - Command injection (&&, |, ;)
    - File inclusion (file://, php://)
    """
    
    # Patrones sospechosos (regex)
    SUSPICIOUS_PATTERNS = [
        (r'\.\./|\.\.\\', 'path_traversal'),
        (r'<script|javascript:|onerror=|onload=', 'xss_attempt'),
        (r'union\s+(all\s+)?select|drop\s+table|delete\s+from|insert\s+into', 'sql_injection'),
        (r'&&|\|\||;|\$\(|\`', 'command_injection'),
        (r'file://|php://|data://|expect://', 'file_inclusion'),
        (r'<\?php|<\%|<%=', 'code_injection'),
    ]
    
    # Threshold de alertas antes de bloquear IP
    ALERT_THRESHOLD = 5
    BLOCK_DURATION = 3600  # 1 hora
    
    def __init__(self, get_response):
        super().__init__(get_response)
        self.get_response = get_response
        # Compilar patrones
        self.compiled_patterns = [
            (re.compile(pattern, re.IGNORECASE), attack_type)
            for pattern, attack_type in self.SUSPICIOUS_PATTERNS
        ]
    
    def process_request(self, request):
        """Verificar patrones sospechosos en el request."""
        client_ip = self._get_client_ip(request)
        
        # Verificar si IP está bloqueada
        block_key = f'security_block:{client_ip}'
        if cache.get(block_key):
            security_audit_logger.critical(
                f'Blocked IP attempted access: {client_ip}',
                extra={
                    'ip': client_ip,
                    'path': request.path,
                    'method': request.method,
                    'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200]
                }
            )
            return JsonResponse(
                {'error': 'Access denied due to suspicious activity'},
                status=403
            )
        
        # Detectar patrones sospechosos
        suspicious_content = self._get_request_content(request)
        detected_attacks = self._check_suspicious_patterns(suspicious_content)
        
        if detected_attacks:
            self._log_suspicious_activity(request, client_ip, detected_attacks)
            self._increment_alert_count(client_ip)
            
            # Bloquear si se excede el threshold
            alert_count = self._get_alert_count(client_ip)
            if alert_count >= self.ALERT_THRESHOLD:
                cache.set(block_key, True, self.BLOCK_DURATION)
                security_audit_logger.critical(
                    f'IP blocked due to repeated suspicious activity: {client_ip}',
                    extra={
                        'ip': client_ip,
                        'alert_count': alert_count,
                        'attacks': detected_attacks
                    }
                )
                return JsonResponse(
                    {'error': 'Access denied due to suspicious activity'},
                    status=403
                )
        
        return None
    
    def _get_request_content(self, request):
        """Extraer contenido del request para análisis."""
        content = []
        
        # Path y query string
        content.append(request.path)
        content.append(request.META.get('QUERY_STRING', ''))
        
        # GET parameters
        for key, value in request.GET.items():
            content.append(f'{key}={value}')
        
        # POST parameters (solo si no es file upload)
        if request.method == 'POST' and request.content_type != 'multipart/form-data':
            for key, value in request.POST.items():
                content.append(f'{key}={value}')
        
        # Headers sospechosos
        for header in ['HTTP_REFERER', 'HTTP_USER_AGENT', 'HTTP_X_FORWARDED_FOR']:
            if header in request.META:
                content.append(request.META[header])
        
        return ' '.join(content)
    
    def _check_suspicious_patterns(self, content):
        """Verificar patrones sospechosos en el contenido."""
        detected = []
        
        for pattern, attack_type in self.compiled_patterns:
            if pattern.search(content):
                detected.append(attack_type)
        
        return detected
    
    def _log_suspicious_activity(self, request, client_ip, attacks):
        """Loggear actividad sospechosa."""
        security_audit_logger.warning(
            f'Suspicious activity detected from {client_ip}',
            extra={
                'ip': client_ip,
                'path': request.path,
                'method': request.method,
                'attacks': attacks,
                'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
                'query_string': request.META.get('QUERY_STRING', ''),
                'user': str(request.user) if request.user.is_authenticated else 'anonymous'
            }
        )
    
    def _increment_alert_count(self, client_ip):
        """Incrementar contador de alertas para una IP."""
        cache_key = f'security_alerts:{client_ip}'
        count = cache.get(cache_key, 0)
        cache.set(cache_key, count + 1, 86400)  # 24 horas
    
    def _get_alert_count(self, client_ip):
        """Obtener contador de alertas para una IP."""
        cache_key = f'security_alerts:{client_ip}'
        return cache.get(cache_key, 0)
    
    @staticmethod
    def _get_client_ip(request):
        """Obtener IP real del cliente."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')
