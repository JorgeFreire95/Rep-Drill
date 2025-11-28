"""
Configuración de Celery para servicio_ventas.
"""
from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab

# Establecer el módulo de settings por defecto para el programa 'celery'.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_ventas.settings')

app = Celery('servicio_ventas')

# Usar una cadena aquí significa que el worker no tiene que serializar
# el objeto de configuración a los child processes.
# - namespace='CELERY' significa que todas las configuraciones relacionadas con celery
#   deben tener un prefijo `CELERY_`.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Cargar módulos de tareas de todas las aplicaciones Django registradas.
app.autodiscover_tasks()

# Configurar tareas periódicas
app.conf.beat_schedule = {
    'sync-customer-cache-daily': {
        'task': 'ventas.tasks.sync_customer_caches_daily',
        'schedule': crontab(hour=3, minute=0),  # 3:00 AM diariamente
    },
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
