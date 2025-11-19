🚀 Guía para Probar y Hacer Build del Sistema en Docker
Voy a guiarte paso a paso para levantar todo el sistema en Docker.

📋 Pre-requisitos
Primero, verifica que tienes todo instalado:

# Verificar Docker
docker --version
docker-compose --version

# Verificar que Docker está corriendo
docker ps

🔧 Paso 1: Preparar el Entorno

1.1 Crear archivo .env en la raíz del proyecto

# Database
POSTGRES_DB=repdrill_db
POSTGRES_USER=repdrill_user
POSTGRES_PASSWORD=repdrill_pass_2024
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Django
DJANGO_SECRET_KEY=django-insecure-dev-key-change-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,nginx

# JWT
JWT_SECRET_KEY=jwt-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Services URLs
AUTH_SERVICE_URL=http://servicio_auth:8000
PERSONAS_SERVICE_URL=http://servicio_personas:8003
INVENTARIO_SERVICE_URL=http://servicio_inventario:8001
VENTAS_SERVICE_URL=http://servicio_ventas:8002
ANALYTICS_SERVICE_URL=http://servicio_analytics:8005

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Frontend
VITE_API_URL=http://localhost:8080

1.2 Crear archivo .env en el frontend

VITE_API_URL=http://localhost:8080
VITE_AUTH_SERVICE_URL=http://localhost:8080/api/auth
VITE_PERSONAS_SERVICE_URL=http://localhost:8080/api/personas
VITE_INVENTARIO_SERVICE_URL=http://localhost:8080/api/inventario
VITE_VENTAS_SERVICE_URL=http://localhost:8080/api/ventas
VITE_ANALYTICS_SERVICE_URL=http://localhost:8080/api/analytics

🏗️ Paso 2: Build de los Contenedores

2.1 Limpiar contenedores anteriores (si existen)

# Detener y eliminar contenedores anteriores
docker-compose down -v

# Limpiar imágenes no utilizadas (opcional)
docker system prune -a

2.2 Build de todos los servicios

# Build de todos los servicios (esto puede tardar 10-15 minutos)
docker-compose build --no-cache

# O build de servicios específicos
docker-compose build servicio_auth
docker-compose build servicio_personas
docker-compose build servicio_inventario
docker-compose build servicio_ventas
docker-compose build servicio_analytics
docker-compose build frontend

🚀 Paso 3: Levantar el Sistema
3.1 Iniciar servicios base (PostgreSQL y Redis)

# Levantar PostgreSQL y Redis primero
docker-compose up -d postgres redis

# Esperar 10 segundos para que se inicialicen
timeout /t 10

# Verificar que están corriendo
docker-compose ps

3.2 Ejecutar migraciones
# Migraciones para cada servicio
docker-compose run --rm servicio_auth python manage.py migrate
docker-compose run --rm servicio_personas python manage.py migrate
docker-compose run --rm servicio_inventario python manage.py migrate
docker-compose run --rm servicio_ventas python manage.py migrate
docker-compose run --rm servicio_analytics python manage.py migrate

3.3 Crear superusuario
# Crear superusuario en el servicio de auth
docker-compose run --rm servicio_auth python manage.py createsuperuser
# Usuario: admin
# Email: admin@repdrill.com
# Password: admin123 (o el que prefieras)

3.4 Cargar datos de prueba (opcional)
# Si tienes fixtures, cargarlos
docker-compose run --rm servicio_inventario python manage.py loaddata initial_data.json
docker-compose run --rm servicio_personas python manage.py loaddata initial_data.json

3.5 Levantar todos los servicios
# Levantar todo el sistema
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f servicio_auth
docker-compose logs -f frontend
docker-compose logs -f nginx

🔍 Paso 4: Verificar el Sistema
4.1 Verificar que todos los contenedores están corriendo
docker-compose ps

Deberías ver algo como:
NAME                    STATUS              PORTS
postgres               Up 2 minutes       0.0.0.0:5432->5432/tcp
redis                  Up 2 minutes       0.0.0.0:6379->6379/tcp
servicio_auth          Up 1 minute        0.0.0.0:8000->8000/tcp
servicio_personas      Up 1 minute        0.0.0.0:8003->8003/tcp
servicio_inventario    Up 1 minute        0.0.0.0:8001->8001/tcp
servicio_ventas        Up 1 minute        0.0.0.0:8002->8002/tcp
servicio_analytics     Up 1 minute        0.0.0.0:8005->8005/tcp
celery_worker          Up 1 minute
celery_beat            Up 1 minute
frontend               Up 1 minute        0.0.0.0:5173->5173/tcp
nginx                  Up 1 minute        0.0.0.0:8080->80/tcp

4.2 Health Checks
# Health check de cada servicio
curl http://localhost:8000/health/live/
curl http://localhost:8001/health/live/
curl http://localhost:8002/health/live/
curl http://localhost:8003/health/live/
curl http://localhost:8005/health/live/

# Health check completo
curl http://localhost:8000/health/full/

4.3 Acceder a las Aplicaciones
Abre tu navegador y visita:

Frontend: http://localhost:5173
API Gateway (Nginx): http://localhost:8080
Servicio Auth: http://localhost:8000/admin
Servicio Inventario: http://localhost:8001/admin
Servicio Ventas: http://localhost:8002/admin
Servicio Personas: http://localhost:8003/admin
Servicio Analytics: http://localhost:8005/admin

🧪 Paso 5: Pruebas Funcionales
5.1 Test de Login
# Test de login via API
curl -X POST http://localhost:8080/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"

5.2 Test de Inventario
# Crear una categoría
curl -X POST http://localhost:8080/api/inventario/categorias/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{\"nombre\":\"Electrónica\",\"descripcion\":\"Productos electrónicos\"}"

# Listar productos
curl http://localhost:8080/api/inventario/productos/ \
  -H "Authorization: Bearer YOUR_TOKEN"

5.3 Test de Celery
# Ver workers activos
docker-compose exec celery_worker celery -A servicio_analytics inspect active

# Ver tareas programadas
docker-compose exec celery_beat celery -A servicio_analytics inspect scheduled

# Ver estadísticas
docker-compose exec celery_worker celery -A servicio_analytics inspect stats

📊 Paso 6: Monitoreo (Opcional)
6.1 Levantar stack de monitoreo
# Levantar Prometheus y Grafana
docker-compose -f docker-compose.monitoring.yml up -d

# Acceder a:
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)

🐛 Troubleshooting
Si un servicio no inicia:
# Ver logs detallados
docker-compose logs servicio_auth

# Reiniciar un servicio específico
docker-compose restart servicio_auth

# Reconstruir un servicio
docker-compose up -d --build servicio_auth

Si hay problemas con la base de datos:
# Conectarse a PostgreSQL
docker-compose exec postgres psql -U repdrill_user -d repdrill_db

# Ver tablas
\dt

# Salir
\q

Si hay problemas con Redis:
🧹 Paso 7: Detener el Sistema
# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ BORRA LA BASE DE DATOS)
docker-compose down -v

# Detener sin eliminar contenedores
docker-compose stop

📝 Comandos Útiles
# Ver logs en tiempo real
docker-compose logs -f --tail=100

# Ejecutar comando en un contenedor
docker-compose exec servicio_auth python manage.py shell

# Entrar a un contenedor
docker-compose exec servicio_auth bash

# Ver uso de recursos
docker stats

# Reconstruir y reiniciar todo
docker-compose down && docker-compose up -d --build


✅ Checklist de Verificación
 Todos los contenedores están en estado "Up"
 PostgreSQL acepta conexiones
 Redis responde
 Health checks retornan 200 OK
 Frontend carga en http://localhost:5173
 Puedes hacer login
 Nginx proxy funciona en http://localhost:8080
 Celery workers están activos
 Celery beat está programando tareas