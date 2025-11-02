"""
Server-Sent Events (SSE) endpoint para streaming de eventos en tiempo real.
"""
from django.http import StreamingHttpResponse
from django.views import View
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
import json
import time
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class EventStreamView(View):
    """View para stream SSE de eventos"""
    
    def get(self, request):
        """
        GET /api/events/stream/
        
        Server-Sent Events stream de eventos en tiempo real
        
        Headers requeridos:
        - Authorization: Bearer <JWT_TOKEN> (opcional)
        - Accept: text/event-stream
        
        Ejemplo de uso desde JavaScript:
        ```javascript
        const eventSource = new EventSource('/api/events/stream/', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Evento recibido:', data);
        };
        
        eventSource.onerror = (error) => {
            console.error('Error en stream:', error);
            eventSource.close();
        };
        ```
        """
        
        def event_generator():
            """Generador de eventos SSE"""
            last_event_id = 0
            check_interval = 1  # Segundos entre checks
            max_iterations = 300  # 5 minutos máximo
            iteration = 0
            
            try:
                # Enviar comentario de conexión
                yield f': Conexión establecida - {timezone.now().isoformat()}\n\n'
                
                while iteration < max_iterations:
                    try:
                        # Aquí se podrían obtener eventos de una base de datos
                        # Por ahora enviamos un evento de heartbeat
                        
                        # Simular eventos del sistema
                        event_data = {
                            "event_id": f"evt_{int(time.time())}_{iteration}",
                            "event_type": "heartbeat",
                            "source_service": "analytics",
                            "timestamp": timezone.now().isoformat(),
                            "correlation_id": request.query_params.get('correlation_id', 'default'),
                            "data": {
                                "status": "connected",
                                "message": f"Evento {iteration}"
                            }
                        }
                        
                        # Enviador evento SSE
                        yield f'data: {json.dumps(event_data)}\n\n'
                        
                    except Exception as e:
                        logger.error(f'Error streaming event: {str(e)}')
                        yield f': Error - {str(e)}\n\n'
                    
                    # Esperar antes de siguiente check
                    time.sleep(check_interval)
                    iteration += 1
                
                # Conexión cerrada después de timeout
                yield f': Conexión cerrada - timeout\n\n'
                    
            except GeneratorExit:
                logger.info(f'Event stream closed')
            except Exception as e:
                logger.error(f'Error in event stream: {str(e)}')
                yield f': Error fatal - {str(e)}\n\n'
        
        return StreamingHttpResponse(
            event_generator(),
            content_type='text/event-stream',
            status=200,
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
            }
        )
