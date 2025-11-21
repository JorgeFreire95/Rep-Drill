# Guía de Despliegue del Chatbot IA con Ollama

## 📋 Prerequisitos

- Docker y Docker Compose instalados
- Al menos 8GB de RAM disponible (recomendado 16GB)
- 10GB de espacio en disco para los modelos de Ollama
- Variables de entorno configuradas en `.env`

## 🚀 Paso 1: Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# Ollama Configuration
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT=60

# Chatbot Configuration
CHATBOT_MAX_HISTORY_MESSAGES=5
CHATBOT_CONTEXT_CACHE_TIMEOUT=300
CHATBOT_MAX_TOKENS=800
CHATBOT_TEMPERATURE=0.7
```

## 🏗️ Paso 2: Construir y Levantar Servicios

```powershell
# Construir la imagen del chatbot
docker-compose build chatbot

# Levantar todos los servicios (incluye ollama y chatbot)
docker-compose up -d
```

## 📥 Paso 3: Descargar Modelo de Ollama

Espera 30 segundos a que Ollama inicie completamente, luego descarga el modelo:

```powershell
# Modelo ligero (recomendado para desarrollo)
docker exec rep_drill_ollama ollama pull llama3.2:3b

# O modelo más grande (mejor calidad, requiere más RAM)
# docker exec rep_drill_ollama ollama pull llama3.1:8b
```

**Tiempo de descarga**: 5-15 minutos dependiendo de tu conexión.

## 🔍 Paso 4: Verificar Estado del Servicio

```powershell
# Ver logs del chatbot
docker logs -f rep_drill_chatbot

# Ver logs de Ollama
docker logs -f rep_drill_ollama

# Verificar que el modelo está disponible
docker exec rep_drill_ollama ollama list
```

Deberías ver algo como:
```
NAME              ID              SIZE      MODIFIED
llama3.2:3b       abc123def456    2.0 GB    2 minutes ago
```

## 🧪 Paso 5: Probar el Servicio

### Health Check
```powershell
curl http://localhost/chatbot/api/chatbot/health/
```

Respuesta esperada:
```json
{
  "status": "ok",
  "ollama": {
    "status": "ok",
    "ollama_running": true,
    "model_available": true,
    "configured_model": "llama3.2:3b"
  },
  "analytics_service": { "status": "ok" },
  "database": { "status": "ok" },
  "redis": { "status": "ok" }
}
```

### Preguntas Rápidas
```powershell
curl http://localhost/chatbot/api/chatbot/quick-questions/
```

### Test de Pregunta (requiere JWT token)
```powershell
# Primero obtén un token de autenticación
$token = "tu-jwt-token-aqui"

# Envía una pregunta
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    question = "¿Cómo están las ventas proyectadas para esta semana?"
    periods = 30
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost/chatbot/api/chatbot/ask/" -Method POST -Headers $headers -Body $body
```

## 🔧 Paso 6: Aplicar Migraciones de Base de Datos

```powershell
docker exec rep_drill_chatbot python manage.py makemigrations
docker exec rep_drill_chatbot python manage.py migrate
```

## 🌐 Paso 7: Probar en el Frontend

1. Abre el navegador en `http://localhost:3000` (o `http://localhost/app/`)
2. Inicia sesión con tus credenciales
3. Ve a la página **Forecasting**
4. Haz clic en el botón flotante azul con el icono de chat (esquina inferior derecha)
5. Prueba con una pregunta rápida o escribe tu propia pregunta

## 🎯 Preguntas de Prueba Recomendadas

- "¿Cómo están las ventas proyectadas para esta semana?"
- "¿Qué productos tienen mayor riesgo de stockout?"
- "Dame un resumen de las alertas críticas"
- "¿Cuál es la tendencia de ventas del último mes?"

## ⚡ Optimización de Performance

### Para Desarrollo (Rápido, menos preciso)
```powershell
# Usar modelo ligero
docker exec rep_drill_ollama ollama pull llama3.2:3b
```

Actualiza `.env`:
```env
OLLAMA_MODEL=llama3.2:3b
CHATBOT_MAX_TOKENS=500
```

### Para Producción (Mejor calidad)
```powershell
# Usar modelo más grande
docker exec rep_drill_ollama ollama pull llama3.1:8b
```

Actualiza `.env`:
```env
OLLAMA_MODEL=llama3.1:8b
CHATBOT_MAX_TOKENS=800
```

Reinicia el servicio:
```powershell
docker-compose restart chatbot
```

## 🐛 Troubleshooting

### Error: "No se pudo conectar a Ollama"

**Causa**: Ollama no está corriendo o no ha terminado de iniciar.

**Solución**:
```powershell
# Verificar que Ollama está corriendo
docker ps | findstr ollama

# Ver logs de Ollama
docker logs rep_drill_ollama

# Reiniciar Ollama
docker-compose restart ollama

# Esperar 30 segundos y reintentar
```

### Error: "Modelo no encontrado"

**Causa**: No has descargado el modelo configurado.

**Solución**:
```powershell
# Listar modelos disponibles
docker exec rep_drill_ollama ollama list

# Descargar el modelo configurado
docker exec rep_drill_ollama ollama pull llama3.2:3b
```

### Error: "Timeout esperando respuesta"

**Causa**: El modelo está tardando demasiado (CPU lento, sin GPU).

**Solución 1** - Aumentar timeout:
```env
OLLAMA_TIMEOUT=120
```

**Solución 2** - Usar modelo más ligero:
```powershell
docker exec rep_drill_ollama ollama pull llama3.2:1b  # Modelo ultra ligero
```

### Error: "Analytics service no disponible"

**Causa**: El servicio de analytics no está corriendo.

**Solución**:
```powershell
# Verificar que analytics está corriendo
docker ps | findstr analytics

# Levantar analytics
docker-compose up -d analytics

# Verificar health
curl http://localhost:8003/health/
```

### Chatbot responde en inglés en lugar de español

**Causa**: El modelo no entiende bien el prompt en español.

**Solución**: Usa modelo con mejor soporte en español:
```powershell
docker exec rep_drill_ollama ollama pull mistral:7b
```

Actualiza `.env`:
```env
OLLAMA_MODEL=mistral:7b
```

### Alto uso de RAM

**Causa**: Modelos grandes consumen mucha memoria.

**Recomendaciones**:
- `llama3.2:1b` → ~1GB RAM
- `llama3.2:3b` → ~3GB RAM
- `llama3.1:8b` → ~6GB RAM
- `mistral:7b` → ~5GB RAM

Cambia a un modelo más ligero si tienes RAM limitada.

## 📊 Monitoreo

### Ver métricas del chatbot
```powershell
docker exec rep_drill_chatbot python manage.py shell

>>> from chatbot.models import ChatAnalytics
>>> from datetime import date
>>> analytics = ChatAnalytics.objects.filter(date=date.today()).first()
>>> print(f"Conversaciones: {analytics.total_conversations}")
>>> print(f"Mensajes: {analytics.total_messages}")
>>> print(f"Tokens: {analytics.total_tokens}")
>>> print(f"Tiempo promedio: {analytics.avg_response_time_ms}ms")
```

### Ver logs en tiempo real
```powershell
# Chatbot
docker logs -f rep_drill_chatbot

# Ollama
docker logs -f rep_drill_ollama
```

## 🔄 Actualización

Si actualizas el código del chatbot:

```powershell
# Rebuild
docker-compose build chatbot

# Aplicar migraciones si hay cambios en modelos
docker exec rep_drill_chatbot python manage.py migrate

# Reiniciar
docker-compose restart chatbot
```

## 📦 Recursos del Sistema

### Mínimos
- CPU: 2 cores
- RAM: 8GB
- Disco: 10GB

### Recomendados
- CPU: 4 cores
- RAM: 16GB
- Disco: 20GB
- GPU: Opcional pero mejora mucho la velocidad

### Con GPU (opcional)
Si tienes GPU NVIDIA y quieres acelerar Ollama:

1. Instala [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

2. Actualiza `docker-compose.yml`:
```yaml
ollama:
  image: ollama/ollama:latest
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

3. Reinicia:
```powershell
docker-compose down
docker-compose up -d
```

## ✅ Checklist de Despliegue

- [ ] Variables de entorno configuradas en `.env`
- [ ] Servicios levantados: `docker-compose up -d`
- [ ] Modelo de Ollama descargado: `ollama pull llama3.2:3b`
- [ ] Migraciones aplicadas: `python manage.py migrate`
- [ ] Health check exitoso: `/chatbot/api/chatbot/health/`
- [ ] Frontend accesible: `http://localhost:3000`
- [ ] Botón de chatbot visible en página Forecasting
- [ ] Primera pregunta de prueba exitosa

## 🎓 Uso del Chatbot

### Buenas Prácticas
- **Sé específico**: "¿Cuál es la tendencia de ventas de los últimos 7 días?" en lugar de "¿Cómo van las ventas?"
- **Contexto**: El chatbot recuerda los últimos 5 mensajes de la conversación
- **Preguntas rápidas**: Usa los botones sugeridos para consultas comunes
- **Limpia la sesión**: Si cambias de tema, limpia la conversación

### Ejemplos de Preguntas
- Análisis: "¿Cuál es la tendencia de ventas para el próximo mes?"
- Alertas: "¿Qué productos tienen riesgo crítico de stockout?"
- Recomendaciones: "¿Qué debería ordenar con prioridad?"
- Métricas: "¿Qué tan confiable es el pronóstico actual?"
- Comparaciones: "¿Cómo se comparan las ventas de esta semana con la anterior?"

## 📚 Referencias

- [Ollama Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [LLaMA 3.2 Model Card](https://huggingface.co/meta-llama/Llama-3.2-3B)
- [Prophet Forecasting](https://facebook.github.io/prophet/)
- [Django REST Framework](https://www.django-rest-framework.org/)

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker logs rep_drill_chatbot`
2. Verifica el health check: `curl http://localhost/chatbot/api/chatbot/health/`
3. Consulta la documentación en `backend/servicio_chatbot/README.md`
4. Abre un issue en el repositorio con logs y detalles del error
