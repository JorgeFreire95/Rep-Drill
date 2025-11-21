# Servicio de Analytics

Microservicio de análisis de datos y predicciones para el sistema Rep Drill.

## 🎯 Propósito

Este servicio calcula y almacena métricas agregadas de ventas e inventario, proporcionando:
- **Métricas diarias de ventas**: Total, promedio, productos vendidos
- **Análisis de demanda**: Tendencias, predicciones por producto
- **Rotación de inventario**: Clasificación de productos, riesgos
- **Recomendaciones de reorden**: Sugerencias automáticas basadas en análisis

## 🏗️ Arquitectura

El servicio se compone de:
- **API REST**: Endpoints para consultar métricas
- **Celery Workers**: Procesamiento asíncrono de cálculos
- **Celery Beat**: Tareas programadas (cada hora, diariamente)
- **Redis**: Broker de mensajes para Celery
- **PostgreSQL**: Almacenamiento de métricas calculadas

## 📊 Modelos de Datos

### DailySalesMetrics
Métricas diarias de ventas agregadas.

### ProductDemandMetrics
Análisis de demanda por producto (30 días por defecto).

### InventoryTurnoverMetrics
Métricas de rotación de inventario con clasificación.

### StockReorderRecommendation
Recomendaciones automáticas de reabastecimiento.

## 🔌 API Endpoints

### Métricas de Ventas
```
GET  /api/daily-sales/                    # Lista de métricas diarias
GET  /api/daily-sales/{id}/               # Detalle de métrica
GET  /api/daily-sales/trend/              # Tendencia de ventas
     ?days=30&group_by=day                # Parámetros opcionales
```

### Demanda de Productos
```
GET  /api/product-demand/                 # Lista de métricas de demanda
GET  /api/product-demand/{id}/            # Detalle de métrica
GET  /api/product-demand/top_products/    # Top productos
     ?limit=10&period_days=30             # Parámetros opcionales
```

### Rotación de Inventario
```
GET  /api/inventory-turnover/             # Lista de métricas de rotación
GET  /api/inventory-turnover/{id}/        # Detalle de métrica
GET  /api/inventory-turnover/inventory_health/  # Salud del inventario
```

### Recomendaciones de Reorden
```
GET  /api/reorder-recommendations/        # Lista de recomendaciones
GET  /api/reorder-recommendations/{id}/   # Detalle de recomendación
POST /api/reorder-recommendations/{id}/mark_reviewed/   # Marcar como revisada
POST /api/reorder-recommendations/{id}/mark_ordered/    # Marcar como ordenada
POST /api/reorder-recommendations/{id}/dismiss/         # Descartar
```

### Acciones Manuales
```
POST /api/actions/calculate_daily_sales/           # Calcular ventas diarias
     Body: { "date": "2025-10-22" }                # Opcional
     
POST /api/actions/calculate_product_demand/       # Calcular demanda
     Body: { "period_days": 30 }                   # Opcional
     
POST /api/actions/calculate_inventory_turnover/   # Calcular rotación
     Body: { "period_days": 30 }                   # Opcional
     
POST /api/actions/generate_reorder_recommendations/  # Generar recomendaciones
```

## 🚀 Despliegue con Docker

### Levantar el servicio
```bash
cd backend
docker-compose up -d analytics-service
```

### Levantar con workers de Celery
```bash
docker-compose up -d analytics-service analytics-celery-worker analytics-celery-beat
```

### Ver logs
```bash
docker-compose logs -f analytics-service
docker-compose logs -f analytics-celery-worker
docker-compose logs -f analytics-celery-beat
```

### Ejecutar migraciones manualmente
```bash
docker-compose exec analytics-service python manage.py migrate
```

### Crear superusuario
```bash
docker-compose exec analytics-service python manage.py createsuperuser
```

## 🔧 Desarrollo Local

### Instalar dependencias
```bash
cd backend/servicio_analytics
pip install -r requirements.txt
```

### Variables de entorno
Copiar `.env.example` a `.env` y configurar:
```env
DB_NAME=rep_drill
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
CELERY_BROKER_URL=redis://localhost:6379/0
VENTAS_SERVICE_URL=http://localhost:8002
INVENTARIO_SERVICE_URL=http://localhost:8001
```

### Ejecutar servidor de desarrollo
```bash
python manage.py runserver 8005
```

### Ejecutar Celery Worker
```bash
celery -A servicio_analytics worker --loglevel=info
```

### Ejecutar Celery Beat
```bash
celery -A servicio_analytics beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## 📅 Tareas Programadas

### Cada hora (3600s)
- **calculate_daily_metrics**: Calcula métricas diarias de ventas

### Cada 2 horas (7200s)
- **calculate_product_demand**: Calcula demanda de productos

### Diariamente (86400s)
- **calculate_inventory_turnover**: Calcula rotación y genera recomendaciones

### Semanalmente
- **cleanup_old_metrics**: Elimina métricas antiguas (>365 días)

## 🧪 Testing

### Ejecutar tests
```bash
python manage.py test
```

### Verificar health check
```bash
curl http://localhost:8005/health/
```

### Probar cálculo manual
```bash
curl -X POST http://localhost:8005/api/actions/calculate_daily_sales/ \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-10-22"}'
```

## 📈 Monitoreo

### Panel de Admin
Acceder a: http://localhost:8005/admin/
- Usuario: admin
- Contraseña: admin123 (desarrollo)

### Celery Flower (Opcional)
Para monitorear tareas de Celery:
```bash
celery -A servicio_analytics flower
```
Acceder a: http://localhost:5555/

## 🔒 Seguridad

⚠️ **IMPORTANTE para producción**:
- Cambiar `SECRET_KEY` en variables de entorno
- Establecer `DEBUG=False`
- Configurar `ALLOWED_HOSTS` correctamente
- Habilitar autenticación en endpoints (cambiar `AllowAny` a `IsAuthenticated`)
- Usar HTTPS
- Configurar límites de rate limiting

## 🤝 Integración con otros servicios

El servicio de analytics consulta datos de:
- **Servicio de Ventas** (http://ventas-service:8000)
  - Órdenes completadas
  - Items de órdenes
  - Clientes

- **Servicio de Inventario** (http://inventario-service:8000)
  - Productos
  - Stock actual
  - Bodegas

## 📚 Próximos Pasos

1. **Implementar autenticación JWT** para endpoints
2. **Agregar dashboard en frontend** para visualizar métricas
3. **Implementar modelo predictivo ML** usando scikit-learn
4. **Agregar alertas** para situaciones críticas
5. **Implementar caché** con Redis para consultas frecuentes
6. **Agregar exportación** de reportes en PDF/Excel
7. **Implementar webhooks** para notificaciones

## 📞 Soporte

Para problemas o dudas sobre el servicio de analytics, revisar los logs:
```bash
docker-compose logs analytics-service
```

## 📄 Licencia

Este servicio es parte del sistema Rep Drill.
