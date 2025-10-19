"""
URL configuration for servicio_auth project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.shortcuts import redirect
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView
)


def root_redirect(request):
    """Redirect to web interface"""
    return redirect('/api/v1/auth/')


def api_root(request):
    """Root API endpoint with service information"""
    return JsonResponse({
        'service': 'Authentication Service',
        'version': '1.0.0',
        'description': 'Microservicio de autenticación para Rep Drill',
        'endpoints': {
            'web_interface': '/api/v1/auth/',
            'admin_panel': '/admin/',
            'health_check': '/health/',
            'api_docs': '/api/docs/',
            'api_schema': '/api/schema/',
            'api_redoc': '/api/redoc/',
        }
    })


urlpatterns = [
    # Admin panel
    path('admin/', admin.site.urls),
    
    # Root redirect to web interface
    path('', root_redirect, name='root-redirect'),
    
    # API Info
    path('api/', api_root, name='api-root'),
    
    # Health Check
    path('health/', include('health_check.urls')),
    
    # OpenAPI Schema & Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # Authentication API
    path('api/v1/auth/', include('authentication.urls')),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
