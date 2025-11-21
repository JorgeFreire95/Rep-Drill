"""
ViewSet para los endpoints del chatbot.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from django.db.models import F
import uuid
import time
import logging

from .models import ChatConversation, ChatMessage, ChatAnalytics
from .context_builder import ForecastContextBuilder
from .llm_service import LLMService
from .prompts import build_system_prompt, build_user_prompt, get_quick_question_prompts

logger = logging.getLogger(__name__)


class ChatbotRateThrottle(UserRateThrottle):
    """Rate limiting específico para el chatbot: 20 requests por minuto."""
    scope = 'chatbot'


class ChatbotViewSet(viewsets.ViewSet):
    """
    Endpoints del chatbot de forecasting.
    
    Endpoints:
    - POST /api/chatbot/ask/ - Enviar pregunta al chatbot
    - GET /api/chatbot/history/?session_id=xxx - Obtener historial de sesión
    - DELETE /api/chatbot/clear/?session_id=xxx - Finalizar sesión
    - GET /api/chatbot/health/ - Verificar estado del servicio
    - GET /api/chatbot/quick-questions/ - Obtener preguntas rápidas sugeridas
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ChatbotRateThrottle]
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.context_builder = ForecastContextBuilder()
        self.llm_service = LLMService()
    
    @action(detail=False, methods=['post'], url_path='ask')
    def ask(self, request):
        """
        Envía una pregunta al chatbot y obtiene respuesta con análisis de forecasting.
        
        POST /api/chatbot/ask/
        
        Body:
        {
            "question": "¿Cómo están las ventas proyectadas para esta semana?",
            "session_id": "uuid-opcional",
            "periods": 30,  // Opcional, días de forecast (default: 30)
            "include_context": false  // Incluir contexto completo en respuesta
        }
        
        Response 200:
        {
            "answer": "📈 Las ventas proyectadas...",
            "session_id": "abc-123",
            "tokens_used": 450,
            "response_time_ms": 1234,
            "model": "llama3.2:3b",
            "context_summary": {...}  // Si include_context=true
        }
        
        Response 400: Validación fallida
        Response 503: Servicio no disponible (analytics o ollama)
        Response 500: Error interno
        """
        try:
            # 1. Validar input
            question = request.data.get('question', '').strip()
            if not question:
                return Response(
                    {'error': 'El campo "question" es requerido y no puede estar vacío'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if len(question) > 1000:
                return Response(
                    {'error': 'La pregunta excede 1000 caracteres'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            session_id = request.data.get('session_id') or str(uuid.uuid4())
            periods = int(request.data.get('periods', 30))
            include_context = request.data.get('include_context', False)
            
            # Limitar periods a un rango razonable
            if periods < 1 or periods > 365:
                return Response(
                    {'error': 'El parámetro "periods" debe estar entre 1 y 365'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            user_id = request.user.id
            
            # 2. Obtener o crear conversación
            conversation, created = ChatConversation.objects.get_or_create(
                user_id=user_id,
                session_id=session_id,
                ended_at__isnull=True,
                defaults={'started_at': timezone.now()}
            )
            
            logger.info(
                f"Usuario {user_id} pregunta en sesión {session_id}: {question[:100]}..."
            )
            
            # 3. Obtener contexto de forecasting desde analytics service
            context = self.context_builder.get_full_context(periods=periods)
            
            if 'error' in context:
                logger.error(f"Error obteniendo contexto: {context['error']}")
                return Response(
                    {
                        'error': 'No se pudo obtener datos de forecasting',
                        'details': context['error']
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # 4. Construir historial de conversación (últimos 5 mensajes)
            recent_messages = list(
                conversation.messages
                .filter(role__in=['user', 'assistant'])
                .order_by('-timestamp')[:settings.CHATBOT_MAX_HISTORY_MESSAGES]
            )
            conversation_history = [
                {'role': msg.role, 'content': msg.content}
                for msg in reversed(recent_messages)
            ]
            
            # 5. Construir prompts
            system_prompt = build_system_prompt(context)
            user_prompt = build_user_prompt(question, conversation_history)
            
            # 6. Llamar al LLM (Ollama)
            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ]
            
            start_time = time.time()
            
            try:
                llm_response = self.llm_service.generate_response(messages=messages)
            except Exception as llm_error:
                logger.error(f"Error en LLM service: {llm_error}", exc_info=True)
                self._update_analytics_error()
                return Response(
                    {
                        'error': 'Error comunicándose con el modelo de lenguaje',
                        'details': str(llm_error)
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            response_time_ms = int((time.time() - start_time) * 1000)
            
            answer = llm_response['content']
            tokens_used = llm_response['tokens_used']
            model_used = llm_response['model']
            
            # 7. Guardar mensajes en BD
            ChatMessage.objects.create(
                conversation=conversation,
                role='user',
                content=question,
                forecast_period=periods,
                response_time_ms=0,
            )
            
            ChatMessage.objects.create(
                conversation=conversation,
                role='assistant',
                content=answer,
                tokens_used=tokens_used,
                response_time_ms=response_time_ms,
            )
            
            # 8. Actualizar analytics
            self._update_analytics(response_time_ms, tokens_used)
            
            # 9. Construir respuesta
            response_data = {
                'answer': answer,
                'session_id': session_id,
                'tokens_used': tokens_used,
                'response_time_ms': response_time_ms,
                'model': model_used,
            }
            
            if include_context:
                response_data['context_summary'] = context.get('summary', {})
            
            logger.info(
                f"Respuesta generada en {response_time_ms}ms, "
                f"{tokens_used} tokens, modelo: {model_used}"
            )
            
            return Response(response_data, status=status.HTTP_200_OK)
        
        except ValueError as e:
            logger.error(f"Error de validación: {e}")
            return Response(
                {'error': f'Parámetro inválido: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Error inesperado en chatbot.ask: {e}", exc_info=True)
            self._update_analytics_error()
            return Response(
                {'error': 'Error interno del servidor', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='ask-stream')
    def ask_stream(self, request):
        """
        Envía una pregunta al chatbot y obtiene respuesta en streaming (SSE).
        
        POST /api/chatbot/ask-stream/
        
        Retorna: text/event-stream con chunks de respuesta en tiempo real
        """
        from django.http import StreamingHttpResponse
        import json
        
        try:
            # Validar input
            question = request.data.get('question', '').strip()
            if not question:
                return Response(
                    {'error': 'El campo "question" es requerido'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            session_id = request.data.get('session_id') or str(uuid.uuid4())
            periods = int(request.data.get('periods', 7))
            user_id = request.user.id
            
            # Obtener conversación
            conversation, _ = ChatConversation.objects.get_or_create(
                user_id=user_id,
                session_id=session_id,
                ended_at__isnull=True,
                defaults={'started_at': timezone.now()}
            )
            
            logger.info(f"Usuario {user_id} pregunta (streaming) en sesión {session_id}: {question[:100]}...")
            
            # Obtener contexto
            context = self.context_builder.get_full_context(periods=periods)
            if 'error' in context:
                return Response(
                    {'error': 'No se pudo obtener contexto', 'details': context['error']},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # Construir prompts
            recent_messages = list(
                conversation.messages
                .filter(role__in=['user', 'assistant'])
                .order_by('-timestamp')[:settings.CHATBOT_MAX_HISTORY_MESSAGES]
            )
            conversation_history = [
                {'role': msg.role, 'content': msg.content}
                for msg in reversed(recent_messages)
            ]
            
            system_prompt = build_system_prompt(context)
            user_prompt = build_user_prompt(question, conversation_history)
            messages = [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ]
            
            # Función generadora para SSE
            def event_stream():
                start_time = time.time()
                accumulated_content = ''
                tokens_used = 0
                
                try:
                    # Enviar evento inicial
                    yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"
                    
                    # Obtener generador de streaming desde LLM
                    stream_generator = self.llm_service.generate_response(
                        messages=messages,
                        stream=True
                    )
                    
                    for chunk_data in stream_generator:
                        chunk_text = chunk_data.get('chunk', '')
                        is_done = chunk_data.get('done', False)
                        
                        accumulated_content += chunk_text
                        
                        if is_done:
                            tokens_used = chunk_data.get('tokens', 0)
                            response_time_ms = int((time.time() - start_time) * 1000)
                            
                            # Guardar mensajes en BD
                            ChatMessage.objects.create(
                                conversation=conversation,
                                role='user',
                                content=question,
                                forecast_period=periods,
                                response_time_ms=0,
                            )
                            
                            ChatMessage.objects.create(
                                conversation=conversation,
                                role='assistant',
                                content=accumulated_content,
                                tokens_used=tokens_used,
                                response_time_ms=response_time_ms,
                            )
                            
                            # Actualizar analytics
                            self._update_analytics(response_time_ms, tokens_used)
                            
                            # Enviar evento final
                            yield f"data: {json.dumps({'type': 'done', 'tokens': tokens_used, 'response_time_ms': response_time_ms})}\n\n"
                        else:
                            # Enviar chunk al cliente
                            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk_text})}\n\n"
                
                except Exception as e:
                    logger.error(f"Error en streaming: {e}", exc_info=True)
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            
            response = StreamingHttpResponse(
                event_stream(),
                content_type='text/event-stream'
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'  # Deshabilitar buffering en Nginx
            return response
        
        except Exception as e:
            logger.error(f"Error iniciando streaming: {e}", exc_info=True)
            return Response(
                {'error': 'Error al iniciar streaming', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        """
        Obtiene el historial de mensajes de una sesión.
        
        GET /api/chatbot/history/?session_id=abc-123
        
        Response 200:
        {
            "session_id": "abc-123",
            "started_at": "2025-11-02T10:30:00Z",
            "message_count": 10,
            "messages": [
                {
                    "role": "user",
                    "content": "¿Cómo van las ventas?",
                    "timestamp": "2025-11-02T10:30:00Z"
                },
                ...
            ]
        }
        """
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response(
                {'error': 'Parámetro "session_id" requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            conversation = ChatConversation.objects.get(
                session_id=session_id,
                user_id=request.user.id
            )
            
            messages = conversation.messages.filter(
                role__in=['user', 'assistant']
            ).order_by('timestamp')
            
            return Response({
                'session_id': session_id,
                'started_at': conversation.started_at,
                'ended_at': conversation.ended_at,
                'message_count': messages.count(),
                'messages': [
                    {
                        'role': msg.role,
                        'content': msg.content,
                        'timestamp': msg.timestamp,
                        'tokens_used': msg.tokens_used if msg.role == 'assistant' else 0,
                    }
                    for msg in messages
                ]
            })
        
        except ChatConversation.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada o no pertenece al usuario'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['delete'], url_path='clear')
    def clear(self, request):
        """
        Finaliza una sesión de chat.
        
        DELETE /api/chatbot/clear/?session_id=abc-123
        
        Response 200:
        {
            "message": "Sesión finalizada exitosamente",
            "session_id": "abc-123",
            "message_count": 10
        }
        """
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response(
                {'error': 'Parámetro "session_id" requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            conversation = ChatConversation.objects.get(
                session_id=session_id,
                user_id=request.user.id,
                ended_at__isnull=True
            )
            
            message_count = conversation.messages.count()
            conversation.ended_at = timezone.now()
            conversation.save()
            
            logger.info(
                f"Sesión {session_id} finalizada por usuario {request.user.id}, "
                f"{message_count} mensajes"
            )
            
            return Response({
                'message': 'Sesión finalizada exitosamente',
                'session_id': session_id,
                'message_count': message_count
            })
        
        except ChatConversation.DoesNotExist:
            return Response(
                {'error': 'Sesión no encontrada, ya finalizada, o no pertenece al usuario'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'], url_path='health', permission_classes=[])
    def health(self, request):
        """
        Verifica el estado de salud del servicio de chatbot.
        
        GET /api/chatbot/health/
        
        Response 200:
        {
            "status": "ok" | "warning" | "error",
            "ollama": {...},
            "analytics_service": {...},
            "database": {...},
            "redis": {...}
        }
        """
        health_status = {
            'timestamp': timezone.now().isoformat(),
            'service': 'chatbot',
        }
        
        # 1. Check Ollama
        try:
            ollama_health = self.llm_service.check_health()
            health_status['ollama'] = ollama_health
        except Exception as e:
            health_status['ollama'] = {
                'status': 'error',
                'error': str(e)
            }
        
        # 2. Check Analytics Service
        try:
            import requests
            response = requests.get(
                f"{settings.ANALYTICS_SERVICE_URL}/health/",
                timeout=5
            )
            health_status['analytics_service'] = {
                'status': 'ok' if response.status_code == 200 else 'error',
                'url': settings.ANALYTICS_SERVICE_URL
            }
        except Exception as e:
            health_status['analytics_service'] = {
                'status': 'error',
                'error': str(e),
                'url': settings.ANALYTICS_SERVICE_URL
            }
        
        # 3. Check Database
        try:
            from django.db import connection
            connection.cursor()
            health_status['database'] = {'status': 'ok'}
        except Exception as e:
            health_status['database'] = {
                'status': 'error',
                'error': str(e)
            }
        
        # 4. Check Redis
        try:
            cache.set('health_check', 'ok', 10)
            cache.get('health_check')
            health_status['redis'] = {'status': 'ok'}
        except Exception as e:
            health_status['redis'] = {
                'status': 'error',
                'error': str(e)
            }
        
        # Determinar status global
        statuses = [
            health_status.get('ollama', {}).get('status'),
            health_status['analytics_service']['status'],
            health_status['database']['status'],
            health_status['redis']['status'],
        ]
        
        if any(s == 'error' for s in statuses):
            health_status['status'] = 'error'
        elif any(s == 'warning' for s in statuses):
            health_status['status'] = 'warning'
        else:
            health_status['status'] = 'ok'
        
        return Response(health_status)
    
    @action(detail=False, methods=['get'], url_path='quick-questions', permission_classes=[], authentication_classes=[])
    def quick_questions(self, request):
        """
        Obtiene lista de preguntas rápidas sugeridas.
        
        GET /api/chatbot/quick-questions/
        
        Response 200:
        {
            "questions": [
                "¿Cómo están las ventas proyectadas para esta semana?",
                ...
            ]
        }
        """
        return Response({
            'questions': get_quick_question_prompts()
        })
    
    def _update_analytics(self, response_time_ms: int, tokens_used: int):
        """Actualiza métricas diarias del chatbot."""
        try:
            from datetime import date
            
            today = date.today()
            analytics, created = ChatAnalytics.objects.get_or_create(date=today)
            
            # Actualizar contadores
            analytics.total_messages = F('total_messages') + 1
            analytics.total_tokens = F('total_tokens') + tokens_used
            
            # Actualizar promedio de response time (media móvil)
            if created:
                analytics.avg_response_time_ms = response_time_ms
            else:
                analytics.refresh_from_db()
                total = analytics.total_messages or 0
                current_avg = analytics.avg_response_time_ms or 0
                # Evitar división por cero cuando aún no hay mensajes contados
                if total <= 0:
                    analytics.avg_response_time_ms = response_time_ms
                else:
                    new_avg = int((current_avg * (total - 1) + response_time_ms) / total)
                    analytics.avg_response_time_ms = new_avg
            
            analytics.save()
        
        except Exception as e:
            logger.error(f"Error actualizando analytics: {e}")
    
    def _update_analytics_error(self):
        """Incrementa el contador de errores."""
        try:
            from datetime import date
            
            today = date.today()
            analytics, _ = ChatAnalytics.objects.get_or_create(date=today)
            analytics.error_count = F('error_count') + 1
            analytics.save()
        
        except Exception as e:
            logger.error(f"Error actualizando analytics (errores): {e}")
