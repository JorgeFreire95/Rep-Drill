"""
URL configuration for servicio_analytics project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('analytics.urls')),
    path('health/', include('health_check.urls')),
]

# Agregar custom health checks si el módulo está disponible
try:
    import sys
    import os
    backend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    # Importar funciones directamente del archivo
    from backend.health_check import health_check, liveness_check, readiness_check
    
    urlpatterns += [
        path('health/full/', health_check, name='health-check-full'),
        path('health/live/', liveness_check, name='liveness'),
        path('health/ready/', readiness_check, name='readiness'),
    ]
except ImportError as e:
    print(f"Warning: Custom health checks not available: {e}")
    pass
