"""
WSGI config for servicio_chatbot project.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'servicio_chatbot.settings')

application = get_wsgi_application()
