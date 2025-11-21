# Servicio Chatbot - Asistente IA para Forecasting

Servicio de chatbot inteligente que analiza forecasts de ventas y proporciona recomendaciones accionables usando Ollama (LLM local).

## Características

- **Análisis de Forecasting**: Interpreta proyecciones de Prophet y componentes de tendencia
- **Recomendaciones Accionables**: Sugiere acciones específicas basadas en datos reales
- **Contexto Completo**: Integra datos de ventas, inventario, y alertas de restock
- **LLM Local**: Usa Ollama (sin dependencias externas de APIs pagas)
- **Caché Inteligente**: Reduce latencia con caché de contexto (5 min)
- **Rate Limiting**: 20 requests/minuto por usuario
- **Historial de Conversaciones**: Mantiene contexto entre mensajes

## Arquitectura

```
Frontend → Nginx → servicio_chatbot → Ollama (LLM)
                          ↓
                    servicio_analytics (datos de forecast)
                          ↓
                    PostgreSQL + Redis
```

## Endpoints

### POST /api/chatbot/ask/
Envía pregunta al chatbot.

**Request:**
```json
{
  "question": "¿Cómo están las ventas proyectadas?",
  "session_id": "optional-uuid",
  "periods": 30,
  "include_context": false
}
```

**Response:**
```json
{
  "answer": "📈 Las ventas proyectadas...",
  "session_id": "abc-123",
  "tokens_used": 450,
  "response_time_ms": 1234,
  "model": "llama3.2:3b"
}
```

### GET /api/chatbot/history/?session_id=xxx
Obtiene historial de mensajes de una sesión.

### DELETE /api/chatbot/clear/?session_id=xxx
Finaliza una sesión de chat.

### GET /api/chatbot/health/
Verifica estado del servicio (Ollama, Analytics, DB, Redis).

### GET /api/chatbot/quick-questions/
Obtiene preguntas rápidas sugeridas.

## Variables de Entorno

```env
# Django
DJANGO_SECRET_KEY=tu-secret-key
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
JWT_SIGNING_KEY=misma-key-que-auth-service

# Database
DATABASE_DB=rep_drill_db
DATABASE_USER=usuario
DATABASE_PASSWORD=password
DATABASE_SERVER=db
DATABASE_PORT=5432

# Redis
REDIS_URL=redis://:password@redis:6379/2

# Ollama
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT=60

# Services
ANALYTICS_SERVICE_URL=http://analytics:8000
VENTAS_SERVICE_URL=http://ventas:8000

# Chatbot Config
CHATBOT_MAX_HISTORY_MESSAGES=5
CHATBOT_CONTEXT_CACHE_TIMEOUT=300
CHATBOT_MAX_TOKENS=800
CHATBOT_TEMPERATURE=0.7
```

## Modelos Ollama Recomendados

### Desarrollo (rápido, bajo recursos)
```bash
docker exec rep_drill_ollama ollama pull llama3.2:3b
```
- **Tamaño**: ~2GB
- **RAM**: 4GB mínimo
- **Latencia**: 1-3 segundos

### Producción (mejor calidad)
```bash
docker exec rep_drill_ollama ollama pull llama3.1:8b
```
- **Tamaño**: ~4.7GB
- **RAM**: 8GB mínimo
- **Latencia**: 3-6 segundos

### Alternativa (buen español)
```bash
docker exec rep_drill_ollama ollama pull mistral:7b
```
- **Tamaño**: ~4.1GB
- **RAM**: 8GB mínimo
- **Latencia**: 2-5 segundos

## Setup Local

1. **Instalar dependencias:**
```bash
cd backend/servicio_chatbot
pip install -r requirements.txt
```

2. **Aplicar migraciones:**
```bash
python manage.py makemigrations
python manage.py migrate
```

3. **Correr servidor:**
```bash
python manage.py runserver 8006
```

4. **Descargar modelo Ollama:**
```bash
# Si Ollama está en Docker:
docker exec rep_drill_ollama ollama pull llama3.2:3b

# Si Ollama está local:
ollama pull llama3.2:3b
```

## Testing

```bash
# Instalar pytest
pip install pytest pytest-django

# Correr tests
pytest
```

## Monitoreo

El servicio expone métricas en `ChatAnalytics`:
- Total de conversaciones diarias
- Total de mensajes
- Tokens consumidos
- Tiempo promedio de respuesta
- Errores

## Optimización

### Reducir Latencia
1. Usar modelo más ligero (`llama3.2:3b`)
2. Reducir `CHATBOT_MAX_TOKENS` (de 800 a 500)
3. Aumentar `CHATBOT_CONTEXT_CACHE_TIMEOUT` (de 5 a 10 min)
4. Usar GPU para Ollama (Docker: `--gpus all`)

### Mejorar Calidad
1. Usar modelo más grande (`llama3.1:8b` o `mistral:7b`)
2. Aumentar `CHATBOT_MAX_HISTORY_MESSAGES` (de 5 a 10)
3. Ajustar `CHATBOT_TEMPERATURE` (más bajo = más determinista)

## Troubleshooting

### Error: "No se pudo conectar a Ollama"
```bash
# Verificar que Ollama esté corriendo
docker ps | grep ollama

# Ver logs de Ollama
docker logs rep_drill_ollama
```

### Error: "Modelo no encontrado"
```bash
# Listar modelos disponibles
docker exec rep_drill_ollama ollama list

# Descargar modelo faltante
docker exec rep_drill_ollama ollama pull llama3.2:3b
```

### Error: "Timeout esperando respuesta"
- Aumentar `OLLAMA_TIMEOUT` en `.env`
- Usar modelo más ligero
- Verificar recursos del servidor (CPU/RAM)

### Analytics Service no disponible
```bash
# Verificar que analytics esté corriendo
docker ps | grep analytics

# Ver logs
docker logs rep_drill_analytics
```

## Logs

```bash
# Ver logs en tiempo real
docker logs -f rep_drill_chatbot

# Ver últimas 100 líneas
docker logs --tail 100 rep_drill_chatbot
```

## Seguridad

- ✅ Autenticación JWT requerida
- ✅ Rate limiting (20 req/min por usuario)
- ✅ Validación de inputs
- ✅ Usuario no-root en Docker
- ✅ Timeouts configurados
- ✅ Sin exposición de claves API

## Roadmap

- [ ] Streaming de respuestas (SSE)
- [ ] Métricas Prometheus
- [ ] Tests de integración
- [ ] Soporte multi-idioma
- [ ] Fine-tuning del modelo
- [ ] Exportar conversaciones a PDF
