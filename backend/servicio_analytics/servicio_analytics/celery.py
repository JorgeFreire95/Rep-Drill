"""
Configuración de Celery para servicio_analytics.
"""
import os
from celery import Celery
from celery.schedules import crontab

# Establecer el módulo de configuración de Django por defecto
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_analytics.settings')

app = Celery('servicio_analytics')

# Usar una cadena aquí significa que el worker no tiene que serializar
# el objeto de configuración para los child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Autodiscover tasks en todas las aplicaciones instaladas
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):
    """Tarea de debug para verificar que Celery funciona."""
    print(f'Request: {self.request!r}')
