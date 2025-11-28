"""
Inicialización del servicio de ventas.
Esto asegura que Celery se cargue cuando Django inicie.
"""
from __future__ import absolute_import, unicode_literals

# Esto asegurará que la app siempre se importe cuando Django inicie
# para que shared_task use esta app.
from .celery import app as celery_app

__all__ = ('celery_app',)
