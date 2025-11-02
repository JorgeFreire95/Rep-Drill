"""
Este módulo asegura que Celery sea importado cuando Django inicia,
para que shared_task use este app.
"""
from .celery import app as celery_app

__all__ = ('celery_app',)
