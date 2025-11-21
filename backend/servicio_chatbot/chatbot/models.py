"""
Modelos de datos para el servicio de chatbot.
"""
from django.db import models
from django.utils import timezone


class ChatConversation(models.Model):
    """Historial de conversaciones del chatbot."""
    user_id = models.IntegerField(db_index=True, help_text="ID del usuario autenticado")
    session_id = models.CharField(max_length=100, db_index=True, unique=True)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'chat_conversations'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user_id', '-started_at']),
            models.Index(fields=['session_id']),
        ]
    
    def __str__(self):
        return f"Conversation {self.session_id} - User {self.user_id}"


class ChatMessage(models.Model):
    """Mensajes individuales del chat."""
    ROLE_CHOICES = [
        ('user', 'Usuario'),
        ('assistant', 'Asistente'),
        ('system', 'Sistema'),
    ]
    
    conversation = models.ForeignKey(
        ChatConversation, 
        on_delete=models.CASCADE, 
        related_name='messages'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    tokens_used = models.IntegerField(default=0)
    
    # Metadata para tracking
    forecast_period = models.IntegerField(
        null=True, 
        blank=True,
        help_text="Días de forecast consultados"
    )
    products_analyzed = models.JSONField(
        default=list, 
        blank=True,
        help_text="IDs de productos mencionados"
    )
    response_time_ms = models.IntegerField(
        default=0,
        help_text="Tiempo de respuesta en milisegundos"
    )
    
    class Meta:
        db_table = 'chat_messages'
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['conversation', 'timestamp']),
            models.Index(fields=['role']),
        ]
    
    def __str__(self):
        return f"{self.role}: {self.content[:50]}..."


class ChatAnalytics(models.Model):
    """Métricas de uso del chatbot."""
    date = models.DateField(unique=True, db_index=True)
    total_conversations = models.IntegerField(default=0)
    total_messages = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    avg_response_time_ms = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'chat_analytics'
        ordering = ['-date']
        verbose_name_plural = 'Chat Analytics'
    
    def __str__(self):
        return f"Analytics {self.date}: {self.total_conversations} conversations"
