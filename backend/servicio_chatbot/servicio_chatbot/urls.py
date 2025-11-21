"""
URL configuration for servicio_chatbot project.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from chatbot.views import ChatbotViewSet

router = DefaultRouter()
router.register(r'chatbot', ChatbotViewSet, basename='chatbot')

urlpatterns = [
    path('api/', include(router.urls)),
]
