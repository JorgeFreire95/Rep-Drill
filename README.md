# 🚀 Rep Drill - Sistema de Gestión Empresarial

Sistema empresarial completo con arquitectura de microservicios, predicción de demanda con Prophet, y frontend React moderno. Ideal para gestión de inventario multi-bodega, ventas, personas y análisis predictivo.

## 📋 Tabla de Contenidos

- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Inicio Rápido](#-inicio-rápido)
- [Microservicios](#-microservicios)
- [Frontend](#-frontend)
- [Seguridad](#-seguridad)
- [Monitoreo y Observabilidad](#-monitoreo-y-observabilidad)
- [Desarrollo](#-desarrollo)
- [Despliegue en Producción](#-despliegue-en-producción)
- [API Documentation](#-api-documentation)

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend React (Port 3000)                │
│           Vite + TypeScript + Tailwind CSS + Recharts        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nginx Gateway (Port 80)                    │
│         Reverse Proxy + Static Files + Load Balancing        │
└─┬────────┬────────┬────────┬────────┬────────┬─────────────┘
  │        │        │        │        │        │
  ▼        ▼        ▼        ▼        ▼        ▼
┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌──────────┐
│Auth│  │Pers│  │Inv │  │Vent│  │Analy│  │ Redis    │
│8001│  │8004│  │8003│  │8002│  │8005│  │ 6379     │
└─┬──┘  └─┬──┘  └─┬──┘  └─┬──┘  └─┬──┘  └──┬───────┘
  │       │       │       │       │        │
  └───────┴───────┴───────┴───────┴────────┼────────┐
                                   │        │        │
                                   ▼        ▼        ▼
                            ┌──────────┐ ┌────┐ ┌────────┐
                            │PostgreSQL│ │Celer│ │Celery │
                            │   5432   │ │Work│ │Beat   │
                            └──────────┘ └────┘ └────────┘
```

**Características Arquitectónicas:**
- **Microservicios**: 5 servicios independientes con Django REST Framework
- **Base de Datos Compartida**: PostgreSQL 15 Alpine con conexiones aisladas por servicio
- **Message Broker**: Redis para Celery y caché distribuido
- **API Gateway**: Nginx para routing, load balancing y servir estáticos
- **Workers Asíncronos**: Celery para tareas programadas (métricas, forecasting)
- **Frontend SPA**: React servido vía Nginx en puerto 3000

---

## ✨ Características Principales

### 🔐 Autenticación y Autorización
- JWT con refresh tokens (SimpleJWT)
- Roles y permisos granulares
- Sesiones de usuario rastreables
- Blacklist de tokens en logout
- Middleware de auditoría de seguridad

### 👥 Gestión de Personas
- **Clientes**: Base de datos unificada con búsqueda rápida (por teléfono, email, nombre)
- **Empleados**: Vinculación con usuarios del sistema
- **Proveedores**: Gestión de contactos y asociación con productos
- **Representantes**: Seguimiento de equipos de ventas

### 📦 Inventario Multi-Bodega
- **Productos**: SKU, categorías, precios, stock por bodega
- **Bodegas**: Gestión de ubicaciones y capacidad
- **Alertas de Stock**: Automáticas con niveles críticos y de advertencia
- **Reorden Inteligente**: Calculado con ROP (Reorder Point), Safety Stock, EOQ

### 💰 Ventas
- **Órdenes de Venta**: Flujo completo (draft → confirmed → completed → cancelled)
- **Actualización Automática**: Descuenta inventario al confirmar orden
- **Envíos**: Tracking con estados (pending → in_transit → delivered)
- **Pagos**: Múltiples métodos (efectivo, transferencia, crédito)
- **Validación de Stock**: Pre-validación antes de confirmar órdenes

### 📊 Analytics y Forecasting (Prophet)
- **Métricas Diarias**: Ventas, órdenes, ingresos (calculadas por Celery cada hora)
- **Demanda de Productos**: Tendencias y velocidad de rotación
- **Prophet Forecasting**:
  - Ventas totales (company-wide)
  - Por producto individual
  - Por categoría agregada
  - Por bodega
  - Top N productos con mayor demanda
- **Recomendaciones de Restock**: Prioridad (critical, high, medium, low) con cálculo de stockout risk
- **Reportes**: Kardex, ventas, rentabilidad (con exportación PDF/Excel)
- **Dashboard**: Estadísticas en tiempo real con métricas consolidadas

### 🔄 Procesamiento Asíncrono
- **Celery Beat**: Tareas programadas
  - `calculate_daily_metrics`: cada hora
  - `calculate_product_demand`: cada 2 horas
  - `calculate_inventory_turnover`: diario
  - `save_daily_forecasts`: 5:00 AM diario
  - `generate_restock_recommendations`: 6:00 AM diario
  - `update_forecast_accuracy`: 7:00 AM diario
  - `cleanup_old_metrics`: semanal
  - `check_service_health`: cada 5 minutos
- **Celery Worker**: Procesamiento paralelo con 2 workers

---

## 🛠️ Stack Tecnológico

### Backend
- **Framework**: Django 4.2 + Django REST Framework 3.14
- **Base de Datos**: PostgreSQL 15 Alpine
- **Cache/Broker**: Redis 7 Alpine
- **Task Queue**: Celery 5.3 + Celery Beat
- **WSGI Server**: Gunicorn (3 workers, timeout 120s)
- **ML Library**: Prophet 1.1 (forecasting)
- **Authentication**: SimpleJWT
- **Testing**: pytest + pytest-django + pytest-cov
- **Validación**: Frictionless (CSV data quality)
- **Monitoring**: Prometheus client

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 7.1.7
- **Language**: TypeScript 5.9.3
- **Styling**: Tailwind CSS 3.4.18
- **Routing**: React Router 6.22.0
- **Charts**: Recharts 3.3.0
- **HTTP Client**: Axios 1.12.2
- **Icons**: Lucide React 0.545.0
- **Export**: jsPDF 3.0.3, XLSX 0.18.5
- **State Management**: React hooks (useState, useEffect, useContext)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx Alpine
- **Web Server (Prod)**: Nginx (servir React build)
- **Networking**: Docker bridge network (micro_net)
- **Volumes**: Persistencia para PostgreSQL, Redis, static files

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Docker Desktop 4.x o superior
- Git
- PowerShell (Windows) o Bash (Linux/Mac)

### 1. Clonar el Repositorio
```powershell
git clone https://github.com/RazorZ7X/rep_drill.git
cd rep_drill
```

### 2. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz:

```env
# Database
DB_NAME=rep_drill_db
DB_USER=usuario
DB_PASSWORD=contraseña_segura_aquí

# Django
DJANGO_SECRET_KEY=tu_secret_key_super_segura_aquí
JWT_SIGNING_KEY=tu_jwt_signing_key_aquí
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# Redis
REDIS_PASSWORD=redis_password_aquí

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Analytics
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_CALCULATION_BATCH_SIZE=100
```

### 3. Levantar Todos los Servicios
```powershell
docker compose up -d --build
```

Esto iniciará:
- PostgreSQL (puerto 5432)
- Redis (puerto 6379)
- Auth Service (puerto 8001)
- Personas Service (puerto 8004)
- Inventario Service (puerto 8003)
- Ventas Service (puerto 8002)
- Analytics Service (puerto 8005)
- Celery Worker + Beat
- Nginx Gateway (puerto 80)
- Frontend React (puerto 3000)

### 4. Ejecutar Migraciones
```powershell
docker compose exec auth python manage.py migrate
docker compose exec personas python manage.py migrate
docker compose exec inventario python manage.py migrate
docker compose exec ventas python manage.py migrate
docker compose exec analytics python manage.py migrate
```

### 5. Crear Superusuario (Opcional)
```powershell
docker compose exec auth python manage.py createsuperuser
```

### 6. Acceder al Sistema
- **Frontend**: http://localhost:3000
- **Nginx Gateway**: http://localhost
- **Auth API**: http://localhost/auth/api/v1/
- **Personas API**: http://localhost/personas/api/
- **Inventario API**: http://localhost/inventario/api/
- **Ventas API**: http://localhost/ventas/api/
- **Analytics API**: http://localhost/analytics/api/

### 7. Poblar con Datos de Prueba (Opcional)
```powershell
# Inventario
docker compose exec inventario python populate_automotive.py

# Ventas
docker compose exec ventas python populate_automotive_sales.py

# Analytics (requiere datos de inventario y ventas)
docker compose exec analytics python populate_inventory_clean.py
```

---

## 🧩 Microservicios

### 1. **Auth Service** (Puerto 8001)
**Propósito**: Autenticación centralizada, gestión de usuarios, roles y permisos.

**Endpoints Principales**:
- `POST /api/v1/auth/login/` - Login con email/password
- `POST /api/v1/auth/token/refresh/` - Renovar access token
- `POST /api/v1/auth/logout/` - Logout (blacklist refresh token)
- `GET /api/v1/auth/profile/` - Perfil del usuario autenticado
- `PATCH /api/v1/auth/profile/` - Actualizar perfil
- `POST /api/v1/auth/register/` - Registro de nuevos usuarios
- `GET /api/v1/auth/users/permissions/` - Permisos del usuario
- `GET /api/v1/auth/admin/users/` - Listar usuarios (admin)
- `POST /api/v1/auth/admin/users/` - Crear usuario (admin)
- `GET /api/v1/auth/roles/` - Listar roles
- `GET /api/v1/auth/permissions/` - Listar permisos

**Modelos**:
- `User` (CustomUser con roles)
- `Role` (admin, vendedor, bodeguero, etc.)
- `Permission` (read_products, create_sales, etc.)
- `RolePermission` (many-to-many)
- `UserSession` (tracking de sesiones)

**Autenticación**: JWT (access token 30min, refresh token 7 días)

---

### 2. **Personas Service** (Puerto 8004)
**Propósito**: Gestión de clientes, proveedores, empleados y representantes.

**Endpoints Principales**:
- `GET /api/personas/` - Listar personas (con filtros es_cliente, es_proveedor)
- `POST /api/personas/` - Crear persona
- `GET /api/personas/{id}/` - Detalle de persona
- `PATCH /api/personas/{id}/` - Actualizar persona
- `DELETE /api/personas/{id}/` - Eliminar persona
- `GET /api/personas/search_customers/` - Búsqueda rápida de clientes
- `GET /api/customers/` - Clientes (legacy)
- `GET /api/employees/` - Empleados (legacy)
- `GET /api/suppliers/` - Proveedores (legacy, usar inventario/suppliers para nuevo)
- `GET /api/reps/` - Representantes (legacy)

**Modelos**:
- `Persona` (unificado: nombre, documento, teléfono, email, dirección, es_cliente, es_proveedor)
- `Customer`, `Employee`, `Supplier`, `Rep` (legacy, mantenidos por compatibilidad)

**Permisos**:
- `CanManageCustomers`
- `CanManageEmployees`
- `CanManageSuppliers`
- `CanManageReps`

---

### 3. **Inventario Service** (Puerto 8003)
**Propósito**: Gestión de productos, bodegas, categorías, stock, reórdenes y proveedores.

**Endpoints Principales**:
- `GET /api/products/` - Listar productos
- `POST /api/products/` - Crear producto
- `GET /api/products/{id}/` - Detalle de producto
- `PATCH /api/products/{id}/` - Actualizar producto
- `DELETE /api/products/{id}/` - Eliminar producto
- `GET /api/products/{id}/stock_by_warehouse/` - Stock por bodega
- `POST /api/products/{id}/adjust_stock/` - Ajustar stock manualmente
- `GET /api/warehouses/` - Listar bodegas
- `POST /api/warehouses/` - Crear bodega
- `GET /api/categories/` - Listar categorías
- `POST /api/categories/` - Crear categoría
- `GET /api/stock-alerts/` - Alertas de stock bajo
- `GET /api/stock-alerts/count/` - Contador de alertas (críticas, advertencias)
- `GET /api/reorders/` - Solicitudes de reorden
- `POST /api/reorders/` - Crear solicitud de reorden
- `PATCH /api/reorders/{id}/` - Actualizar estado (requested → ordered → received)
- `GET /api/suppliers/` - Listar proveedores
- `POST /api/suppliers/` - Crear proveedor
- `GET /api/suppliers/{id}/products/` - Productos del proveedor
- `POST /api/suppliers/{id}/attach_product/` - Asociar producto a proveedor
- `GET /api/suppliers/{id}/purchases/` - Historial de compras
- `GET /api/suppliers/{id}/performance/` - Métricas de desempeño

**Modelos**:
- `Product` (SKU, nombre, precio, categoría, proveedor)
- `Warehouse` (nombre, ubicación, capacidad)
- `Category` (nombre, descripción)
- `Stock` (producto, bodega, cantidad, mín/máx)
- `StockMovement` (entrada/salida, razón, cantidad, auditoría)
- `ReorderRequest` (producto, proveedor, cantidad, estado, prioridad)
- `Supplier` (nombre, email, teléfono, rating)

**Auditoría**: Middleware `CurrentActorMiddleware` para rastrear quién hace cambios.

---

### 4. **Ventas Service** (Puerto 8002)
**Propósito**: Órdenes de venta, envíos, pagos y actualización automática de inventario.

**Endpoints Principales**:
- `GET /api/orders/` - Listar órdenes
- `POST /api/orders/` - Crear orden (draft)
- `GET /api/orders/{id}/` - Detalle de orden
- `PATCH /api/orders/{id}/` - Actualizar orden
- `POST /api/orders/{id}/confirm/` - Confirmar orden (descuenta stock)
- `POST /api/orders/{id}/cancel/` - Cancelar orden (reversa stock si estaba confirmed)
- `GET /api/orders/{id}/items/` - Items de la orden
- `POST /api/orders/{id}/add_item/` - Agregar item
- `GET /api/shipments/` - Listar envíos
- `POST /api/shipments/` - Crear envío
- `PATCH /api/shipments/{id}/` - Actualizar estado de envío
- `GET /api/payments/` - Listar pagos
- `POST /api/payments/` - Registrar pago
- `GET /api/order-events/` - Eventos de órdenes (SSE para real-time)

**Modelos**:
- `Order` (cliente, vendedor, total, estado: draft/confirmed/completed/cancelled)
- `OrderItem` (producto, cantidad, precio unitario, subtotal)
- `Shipment` (orden, método, dirección, estado: pending/in_transit/delivered)
- `Payment` (orden, monto, método: efectivo/transferencia/crédito, fecha)

**Integración con Inventario**:
- Al confirmar orden: llama `adjust_stock` en inventario service
- Al cancelar orden confirmada: reversa ajuste de stock

**Permisos**:
- `CanManageOrders`
- `CanManageShipments`
- `CanManagePayments`

---

### 5. **Analytics Service** (Puerto 8005)
**Propósito**: Métricas agregadas, Prophet forecasting, recomendaciones de restock, reportes.

**Endpoints Principales**:

**Métricas**:
- `GET /api/metrics/daily-sales/` - Métricas diarias de ventas
- `GET /api/metrics/product-demand/` - Demanda de productos
- `GET /api/metrics/inventory-turnover/` - Rotación de inventario
- `GET /api/metrics/restock-recommendations/` - Recomendaciones de reorden

**Prophet Forecasting**:
- `GET /api/prophet/dashboard-stats/` - Stats para dashboard (críticos, urgentes, accuracy)
- `GET /api/prophet/sales-forecast/` - Forecast de ventas totales
- `GET /api/prophet/product-forecast/?product_id=X` - Forecast por producto
- `GET /api/prophet/top-products-forecast/?top=10` - Top productos con forecast
- `GET /api/prophet/category-forecast/?category_id=X` - Forecast por categoría
- `GET /api/prophet/warehouse-forecast/?warehouse_id=X` - Forecast por bodega
- `GET /api/prophet/forecast-components/` - Componentes de tendencia/estacionalidad

**Restock**:
- `GET /api/restock/recommendations/` - Recomendaciones detalladas
- `POST /api/restock/bulk-generate/` - Generar recomendaciones masivas

**Reportes**:
- `GET /api/reports/kardex/?product_id=X&warehouse_id=Y` - Kardex (movimientos)
- `GET /api/reports/sales/?period=month` - Reporte de ventas
- `GET /api/reports/profitability/?period=month` - Reporte de rentabilidad

**Dashboard**:
- `GET /api/dashboard/overview/` - Resumen general
- `GET /api/dashboard/sales-trend/` - Tendencia de ventas
- `GET /api/dashboard/top-products/` - Top productos vendidos

**Acciones Manuales**:
- `POST /api/actions/calculate-metrics/` - Forzar cálculo de métricas
- `POST /api/actions/refresh-forecasts/` - Regenerar forecasts

**Monitoreo**:
- `GET /api/celery/status/` - Estado de workers Celery
- `GET /api/celery/scheduled/` - Tareas programadas
- `GET /api/cache/stats/` - Estadísticas de caché
- `POST /api/cache/clear/` - Limpiar caché

**Modelos**:
- `DailySalesMetrics` (fecha, total_sales, total_orders, avg_order_value)
- `ProductDemandMetrics` (producto, período, total_sold, avg_daily_demand, velocity)
- `InventoryTurnoverMetrics` (producto, turnover_ratio, days_to_sell, classification: A/B/C)
- `StockReorderRecommendation` (producto, reorder_point, safety_stock, recommended_qty, reorder_priority, stockout_risk)
- `ForecastAccuracyHistory` (fecha, mape, rmse, mae)
- `TaskRun` (tracking de ejecuciones de Celery)

**Tareas Celery**:
- `calculate_daily_metrics`: Agrega ventas del día anterior
- `calculate_product_demand`: Calcula demanda de productos (últimos 30 días)
- `calculate_inventory_turnover`: Rotación de inventario
- `save_daily_forecasts`: Genera forecasts diarios con Prophet
- `generate_restock_recommendations`: Calcula ROP, Safety Stock, EOQ
- `update_forecast_accuracy`: Compara forecasts vs ventas reales (MAPE, RMSE, MAE)
- `cleanup_old_metrics`: Limpia datos antiguos según `ANALYTICS_RETENTION_DAYS`
- `check_service_health`: Monitorea salud de servicios dependientes

**Prometheus Metrics**:
- `analytics_forecast_requests_total`
- `analytics_forecast_duration_seconds`
- `analytics_recommendations_generated_total`
- `analytics_active_recommendations`
- `analytics_daily_sales_total`
- `analytics_forecast_accuracy_mape`
- `analytics_celery_queue_length`
- `analytics_data_quality_checks_total`

---

## 🎨 Frontend

### Estructura de Páginas (15 páginas)
1. **DashboardPage** (`/`) - Métricas generales, ventas, top productos, alertas críticas
2. **AnalyticsPage** (`/analytics`) - Gráficos avanzados de ventas y demanda
3. **ForecastingPage** (`/forecasting`) - Prophet forecasting y recomendaciones de restock
4. **ReportsPage** (`/reportes`) - Kardex, ventas, rentabilidad (PDF/Excel export)
5. **InventarioPage** (`/inventario`) - CRUD de productos, categorías, bodegas
6. **StockAlertsPage** (`/alertas-stock`) - Alertas de stock bajo con filtros
7. **ReordersPage** (`/reordenes`) - Solicitudes de reorden y seguimiento
8. **SuppliersPage** (`/proveedores`) - Gestión de proveedores y asociación de productos
9. **VentasPage** (`/ventas`) - Órdenes de venta con filtros y estados
10. **CreateOrderPage** (`/crear-orden`) - Formulario multi-paso (orden → pago → envío)
11. **PersonasPage** (`/personas`) - Clientes y proveedores
12. **UsersManagementPage** (`/usuarios`) - Administración de usuarios (admin only)
13. **AuditLogsPage** (`/auditoria`) - Logs de auditoría y cambios
14. **LoginPage** (`/login`) - Autenticación
15. **Index** (`/pages/index.tsx`) - Exportaciones centralizadas

### Características del Frontend
- **Lazy Loading**: AnalyticsPage y ForecastingPage cargados bajo demanda
- **Protected Routes**: Todas las rutas excepto `/login` requieren autenticación
- **Toast Notifications**: Sistema de notificaciones global (success, error, info, warning)
- **Real-time Alerts**: Watcher de stock bajo cada 10 segundos
- **Error Boundaries**: Manejo de errores con recuperación graceful
- **Token Refresh**: Interceptor Axios automático para renovar tokens expirados
- **Auth Skip for Reports**: `/api/reports/` no envía Authorization header (AllowAny en backend)
- **Responsive Design**: Tailwind CSS con diseño mobile-first
- **Charts**: Recharts para gráficos de línea, barras, área
- **Export**: PDF (jsPDF) y Excel (XLSX) para reportes
- **Type Safety**: TypeScript con interfaces estrictas

### Servicios Frontend (services/)
- `authService.ts` - Login, logout, refresh token, perfil
- `personasService.ts` - Clientes, proveedores, búsqueda
- `inventarioService.ts` - Productos, bodegas, categorías, stock, reorders
- `ventasService.ts` - Órdenes, items, envíos, pagos
- `forecastingService.ts` - Prophet forecasts, dashboard stats, recomendaciones
- `reportsService.ts` - Kardex, ventas, rentabilidad
- `userManagementService.ts` - Gestión de usuarios (admin)
- `suppliersService.ts` - Proveedores y asociación de productos
- `notificationsService.ts` - Watcher de alertas de stock
- `api.ts` - Axios client con interceptores

### Contextos (contexts/)
- `AuthContext` - Estado de autenticación global
- `ToastContext` - Sistema de notificaciones

---

## 🔒 Seguridad

### Autenticación y Autorización
- **JWT Tokens**: Access token (30 min), refresh token (7 días)
- **Token Blacklist**: Tokens invalidados en logout
- **Permisos Granulares**: Decoded desde JWT, verificados en cada endpoint
- **Role-Based Access**: Admin, vendedor, bodeguero, analista
- **Session Tracking**: `UserSession` registra IP, user agent, expiración

### Middleware de Seguridad
- **SecurityHeadersMiddleware**: Headers de seguridad (X-Frame-Options, CSP, etc.)
- **SecurityAuditMiddleware**: Detección de patrones de ataque
  - XSS (script tags, event handlers)
  - SQL Injection (UNION, DROP, etc.)
  - Path Traversal (../, ..\)
  - Command Injection (shell commands)
- **RateLimitMiddleware**: Límites por IP y usuario (cache-based)
- **RequestLoggingMiddleware**: Log de todas las requests con timing
- **CORSMiddleware**: Control de orígenes permitidos
- **IPWhitelistMiddleware**: Restricción de admin endpoints por IP

### Configuración de Seguridad
```python
# HTTPS y cookies seguras
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000

# Headers de seguridad
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    MinimumLengthValidator (12 caracteres),
    CommonPasswordValidator,
    UserAttributeSimilarityValidator,
    NumericPasswordValidator
]

# Rate limiting
DEFAULT_THROTTLE_RATES = {
    'anon': '100/hour',
    'user': '1000/hour',
    'burst': '60/minute'
}
```

### Secretos y Credenciales
- **Docker Secrets**: Almacenamiento seguro en producción
- **Environment Variables**: `.env` para desarrollo (no comitear)
- **Rotación de Keys**: JWT_SIGNING_KEY debe rotarse periódicamente
- **Passwords Hash**: bcrypt automático en Django

### Auditoría
- **Security Audit Logger**: Canal separado para eventos de seguridad
- **Request Logging**: Todas las requests con usuario, IP, método, path, duración
- **Stock Movement Audit**: `CurrentActorMiddleware` rastrea quién hace cambios
- **Order Events**: Tracking de cambios de estado en órdenes

---

## 📊 Monitoreo y Observabilidad

### Prometheus Metrics
**Endpoint**: `http://localhost:8005/api/analytics/metrics/`

**Métricas Disponibles**:
```
# Contadores
analytics_forecast_requests_total{product_id, status}
analytics_recommendations_generated_total{priority}
analytics_data_quality_checks_total{result}
analytics_celery_task_execution_total{task_name, status}
analytics_cache_operations_total{operation, status}

# Histogramas (duración)
analytics_forecast_duration_seconds{forecast_type}
analytics_api_request_duration_seconds{endpoint, method}

# Gauges (estado actual)
analytics_active_recommendations{priority}
analytics_daily_sales_total
analytics_forecast_accuracy_mape{forecast_type}
analytics_celery_queue_length{queue_name}

# Info (metadatos)
analytics_service_info{version, prophet_version, environment}
```

**Uso con Prometheus**:
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'rep_drill_analytics'
    static_configs:
      - targets: ['analytics:8000']
    metrics_path: '/api/analytics/metrics/'
```

### Health Checks
**Full Health Check** (`/health/full/`):
```json
{
  "status": "healthy",
  "database": "ok",
  "redis": "ok",
  "celery_worker": "ok",
  "disk_usage": "45%",
  "memory_usage": "60%",
  "timestamp": "2025-11-01T12:00:00Z"
}
```

**Liveness Probe** (`/health/live/`):
- Verifica que el servicio responde (para Kubernetes)

**Readiness Probe** (`/health/ready/`):
- Verifica dependencias (DB, Redis) antes de recibir tráfico

### Logging
**Formato**: JSON estructurado

**Niveles**:
- `DEBUG`: Detalles de ejecución
- `INFO`: Operaciones normales (cálculo de métricas, forecasts)
- `WARNING`: Problemas no críticos (datos faltantes, caches miss)
- `ERROR`: Errores recuperables (API timeouts, forecasts fallidos)
- `CRITICAL`: Fallos críticos (DB down, Redis unreachable)

**Canales**:
- `django`: Logs generales de Django
- `analytics`: Logs del servicio analytics
- `celery`: Logs de tareas Celery
- `security.audit`: Eventos de seguridad

**Configuración**:
```python
LOGGING = {
    'formatters': {
        'json': {
            'class': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        }
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'app.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 5,
            'formatter': 'json'
        }
    }
}
```

### Monitoreo de Celery
**Endpoints**:
- `GET /api/celery/status/` - Estado de workers
- `GET /api/celery/scheduled/` - Tareas programadas
- `GET /api/celery/active/` - Tareas en ejecución

**Flower** (opcional):
```powershell
docker compose exec analytics_worker celery -A servicio_analytics flower
# Acceder a http://localhost:5555
```

### Dashboards Recomendados (Grafana)
1. **System Health**: CPU, memoria, disco por servicio
2. **Request Metrics**: Latencia, throughput, tasa de error
3. **Celery Queue**: Longitud de cola, tasks completados/fallidos
4. **Forecast Accuracy**: MAPE histórico, drift detection
5. **Stock Alerts**: Alertas críticas, recomendaciones pendientes

---

## 💻 Desarrollo

### Setup Local (Sin Docker)

#### Backend (por servicio)
```powershell
cd backend/servicio_auth
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Configurar .env
cp .env.example .env

# Migraciones
python manage.py migrate

# Crear superuser
python manage.py createsuperuser

# Ejecutar servidor
python manage.py runserver 8001

# Tests
pytest authentication/tests/ -v --cov
```

Repetir para cada servicio (personas:8004, inventario:8003, ventas:8002, analytics:8005).

#### Frontend
```powershell
cd frontend
npm install
npm run dev  # Vite dev server en http://localhost:5173
npm run build  # Build para producción
npm run preview  # Preview del build
```

### Variables de Entorno Importantes

**Backend** (cada servicio):
```env
# Database
DATABASE_DB=rep_drill_db
DATABASE_USER=usuario
DATABASE_PASSWORD=password
DATABASE_SERVER=localhost  # 'db' en Docker
DATABASE_PORT=5432

# Django
SECRET_KEY=secret-key-here
JWT_SIGNING_KEY=jwt-key-here  # DEBE SER LA MISMA EN TODOS LOS SERVICIOS
DEBUG=True  # False en producción
ALLOWED_HOSTS=localhost,127.0.0.1

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# URLs de otros servicios
AUTH_SERVICE_URL=http://auth:8000  # http://localhost:8001 local
VENTAS_SERVICE_URL=http://ventas:8000
INVENTARIO_SERVICE_URL=http://inventario:8000
PERSONAS_SERVICE_URL=http://personas:8000

# Redis (solo analytics)
REDIS_URL=redis://:password@redis:6379/1
CELERY_BROKER_URL=redis://:password@redis:6379/0
CELERY_RESULT_BACKEND=redis://:password@redis:6379/0

# Analytics
ANALYTICS_RETENTION_DAYS=365
ANALYTICS_CALCULATION_BATCH_SIZE=100
PROPHET_CACHE_TIMEOUT=3600
```

**Frontend**:
```env
VITE_API_BASE_URL=http://localhost  # URL del gateway Nginx
```

### Comandos Útiles

**Django Management**:
```powershell
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py shell
python manage.py collectstatic
python manage.py test
python manage.py dbshell
```

**Celery** (dentro del contenedor analytics):
```powershell
# Ver tareas registradas
celery -A servicio_analytics inspect registered

# Ver tareas activas
celery -A servicio_analytics inspect active

# Ver tareas programadas
celery -A servicio_analytics inspect scheduled

# Purge queue
celery -A servicio_analytics purge

# Flower (monitoring UI)
celery -A servicio_analytics flower
```

**Docker**:
```powershell
# Logs de un servicio
docker compose logs -f analytics

# Ejecutar comando en contenedor
docker compose exec analytics python manage.py shell

# Rebuild sin cache
docker compose build --no-cache analytics

# Ver uso de recursos
docker stats

# Limpiar todo
docker compose down -v
docker system prune -a
```

**Frontend**:
```powershell
npm run dev        # Dev server
npm run build      # Build producción
npm run preview    # Preview build
npm run lint       # ESLint
npm run type-check # TypeScript check
```

### Testing

**Backend (pytest)**:
```powershell
# Todos los tests con coverage
pytest --cov=. --cov-report=html

# Tests específicos
pytest authentication/tests/test_auth.py -v
pytest analytics/tests/test_forecasting.py::TestProphetForecasting::test_sales_forecast -v

# Tests en paralelo
pytest -n auto

# Tests con verbose
pytest -vv

# Tests con markers
pytest -m "slow"  # Solo tests marcados como slow
pytest -m "not slow"  # Excluir tests lentos
```

**Frontend (Vitest)**:
```powershell
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Con coverage
```

### Debugging

**Backend (Django)**:
```python
# En cualquier parte del código
import pdb; pdb.set_trace()

# O con ipdb (más amigable)
import ipdb; ipdb.set_trace()

# Logging
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Variable value: {var}")
```

**Frontend (React)**:
```typescript
// Console logs
console.log('Debug:', data);
console.table(users);
console.time('API call'); 
// ... código ...
console.timeEnd('API call');

// React DevTools (extensión Chrome/Firefox)
// VSCode debugger con Chrome
```

**Docker Logs**:
```powershell
# Logs en tiempo real
docker compose logs -f analytics

# Últimas 100 líneas
docker compose logs --tail=100 analytics

# Logs desde timestamp
docker compose logs --since 2024-11-01T10:00:00 analytics
```

---

## 🚀 Despliegue en Producción

### Preparación

1. **Variables de Entorno**:
```env
# .env.prod
DEBUG=False
SECRET_KEY=super-secure-random-key-min-50-chars
JWT_SIGNING_KEY=another-super-secure-key
ALLOWED_HOSTS=tudominio.com,www.tudominio.com,api.tudominio.com
CORS_ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com

# Database (usar instancia dedicada)
DB_NAME=rep_drill_prod
DB_USER=rep_drill_user
DB_PASSWORD=password-super-seguro-aqui
DATABASE_SERVER=db-prod.example.com
DATABASE_PORT=5432

# Redis (usar instancia dedicada)
REDIS_PASSWORD=redis-password-seguro
REDIS_URL=redis://:redis-password-seguro@redis-prod.example.com:6379/1

# SSL
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

2. **Configurar Docker Secrets**:
```powershell
# Crear secrets
echo "tu-secret-key-super-segura" | docker secret create django_secret_key -
echo "jwt-signing-key" | docker secret create jwt_signing_key -
echo "db-password" | docker secret create db_password -
echo "redis-password" | docker secret create redis_password -
```

3. **Actualizar docker-compose.prod.yml**:
```yaml
services:
  auth:
    secrets:
      - django_secret_key
      - jwt_signing_key
      - db_password
    environment:
      - SECRET_KEY_FILE=/run/secrets/django_secret_key
      - JWT_SIGNING_KEY_FILE=/run/secrets/jwt_signing_key
      - DB_PASSWORD_FILE=/run/secrets/db_password
```

### Despliegue con Docker Compose

```powershell
# Build todas las imágenes
docker compose -f docker-compose.prod.yml build

# Up en modo detached
docker compose -f docker-compose.prod.yml up -d

# Migraciones
docker compose -f docker-compose.prod.yml exec auth python manage.py migrate
docker compose -f docker-compose.prod.yml exec personas python manage.py migrate
docker compose -f docker-compose.prod.yml exec inventario python manage.py migrate
docker compose -f docker-compose.prod.yml exec ventas python manage.py migrate
docker compose -f docker-compose.prod.yml exec analytics python manage.py migrate

# Collectstatic
docker compose -f docker-compose.prod.yml exec auth python manage.py collectstatic --noinput
docker compose -f docker-compose.prod.yml exec analytics python manage.py collectstatic --noinput

# Crear superuser
docker compose -f docker-compose.prod.yml exec auth python manage.py createsuperuser
```

### Nginx Configuration (Producción)

```nginx
# /etc/nginx/conf.d/rep_drill.conf
upstream auth_backend {
    server auth:8000;
}

upstream personas_backend {
    server personas:8000;
}

upstream inventario_backend {
    server inventario:8000;
}

upstream ventas_backend {
    server ventas:8000;
}

upstream analytics_backend {
    server analytics:8000;
}

server {
    listen 80;
    server_name tudominio.com www.tudominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    # Frontend React
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Backend services
    location /auth/ {
        proxy_pass http://auth_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /personas/ {
        proxy_pass http://personas_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /inventario/ {
        proxy_pass http://inventario_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ventas/ {
        proxy_pass http://ventas_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /analytics/ {
        proxy_pass http://analytics_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files
    location /static/ {
        alias /app/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### SSL con Let's Encrypt

```powershell
# Instalar certbot
apt install certbot python3-certbot-nginx

# Obtener certificado
certbot --nginx -d tudominio.com -d www.tudominio.com

# Renovación automática (crontab)
0 3 * * * certbot renew --quiet
```

### Monitoreo en Producción

**1. Prometheus + Grafana**:
```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

**2. Logs Centralizados (ELK Stack)**:
```yaml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./monitoring/logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
```

### Backups

**PostgreSQL**:
```powershell
# Backup manual
docker compose exec db pg_dump -U usuario rep_drill_db > backup_$(date +%Y%m%d).sql

# Backup automatizado (cron)
0 2 * * * docker compose exec -T db pg_dump -U usuario rep_drill_db | gzip > /backups/rep_drill_$(date +\%Y\%m\%d).sql.gz

# Restore
docker compose exec -T db psql -U usuario rep_drill_db < backup_20251101.sql
```

**Redis**:
```powershell
# Redis hace RDB snapshots automáticos
# Copiar /data/dump.rdb para backup
docker compose exec redis redis-cli BGSAVE
docker cp rep_drill_redis:/data/dump.rdb ./backup_redis_$(date +%Y%m%d).rdb
```

### Checklist de Producción

- [ ] `DEBUG=False` en todos los servicios
- [ ] `SECRET_KEY` y `JWT_SIGNING_KEY` únicos y seguros (min 50 chars)
- [ ] `ALLOWED_HOSTS` configurado correctamente
- [ ] SSL/TLS habilitado (HTTPS)
- [ ] Certificados Let's Encrypt renovándose automáticamente
- [ ] CORS configurado solo para dominios de producción
- [ ] Rate limiting habilitado
- [ ] IP whitelist para endpoints admin
- [ ] Logs configurados y rotando
- [ ] Backups automáticos de DB y Redis
- [ ] Monitoreo con Prometheus + Grafana
- [ ] Alertas configuradas (Slack, email)
- [ ] Gunicorn con workers suficientes (2-4 x CPU cores)
- [ ] Nginx con caching de estáticos
- [ ] PostgreSQL tuneado para producción
- [ ] Redis con persistencia AOF habilitada
- [ ] Celery workers con autorestart
- [ ] Health checks funcionando
- [ ] Rollback plan documentado

---

## 📚 API Documentation

### Acceso a Documentación Interactiva

Cada servicio expone Swagger UI con drf-spectacular:

- **Auth**: http://localhost:8001/api/schema/swagger-ui/
- **Personas**: http://localhost:8004/api/schema/swagger-ui/
- **Inventario**: http://localhost:8003/api/schema/swagger-ui/
- **Ventas**: http://localhost:8002/api/schema/swagger-ui/
- **Analytics**: http://localhost:8005/api/schema/swagger-ui/

### Autenticación en Swagger

1. Hacer login en `POST /api/v1/auth/login/`
2. Copiar el `access` token de la respuesta
3. Hacer clic en "Authorize" (icono de candado)
4. Ingresar: `Bearer <tu_access_token>`
5. Ahora puedes probar todos los endpoints protegidos

### Ejemplos de Uso

#### 1. Login y Obtener Token
```bash
curl -X POST http://localhost/auth/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'

# Respuesta:
{
  "message": "Inicio de sesión exitoso",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "full_name": "Admin User",
    "role": "admin"
  },
  "tokens": {
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

#### 2. Crear Producto
```bash
curl -X POST http://localhost/inventario/api/products/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "Laptop Dell XPS 15",
    "sku": "LAPTOP-DELL-001",
    "category": 1,
    "price": "1500000",
    "cost": "1200000",
    "supplier": 1,
    "min_stock": 5,
    "max_stock": 50
  }'
```

#### 3. Crear Orden de Venta
```bash
curl -X POST http://localhost/ventas/api/orders/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "customer_id": 1,
    "warehouse_id": 1,
    "status": "draft",
    "items": [
      {
        "product_id": 1,
        "quantity": 2,
        "unit_price": "1500000"
      }
    ]
  }'
```

#### 4. Confirmar Orden (Descuenta Stock)
```bash
curl -X POST http://localhost/ventas/api/orders/1/confirm/ \
  -H "Authorization: Bearer <access_token>"
```

#### 5. Obtener Forecast de Ventas
```bash
curl -X GET "http://localhost/analytics/api/prophet/sales-forecast/?periods=30" \
  -H "Authorization: Bearer <access_token>"
```

#### 6. Obtener Recomendaciones de Restock
```bash
curl -X GET "http://localhost/analytics/api/prophet/restock-recommendations/?priority=critical" \
  -H "Authorization: Bearer <access_token>"
```

#### 7. Generar Reporte Kardex (PDF/Excel)
```bash
# Obtener datos (en frontend se exporta con jsPDF/XLSX)
curl -X GET "http://localhost/analytics/api/reports/kardex/?product_id=1&warehouse_id=1" \
  # No requiere Authorization (AllowAny)
```

---

## 🤝 Contribución

### Flujo de Trabajo
1. Fork el repositorio
2. Crear feature branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -m 'Add: nueva funcionalidad'`
4. Push a branch: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

### Estándares de Código

**Python**:
- PEP8 (usar `black` para formateo)
- Docstrings en Google style
- Type hints cuando sea posible
- Tests para funcionalidades nuevas

**TypeScript**:
- ESLint + Prettier
- Interfaces para todos los tipos
- Comentarios en lógica compleja
- Nombres descriptivos

### Tests
- Cobertura mínima: 70%
- Tests unitarios para lógica de negocio
- Tests de integración para APIs
- Tests E2E para flujos críticos (login, crear orden, confirmar orden)

---

## 📄 Licencia

Este proyecto está bajo licencia MIT. Ver archivo `LICENSE` para más detalles.

---

## 📞 Soporte

- **Issues**: https://github.com/RazorZ7X/rep_drill/issues
- **Documentación adicional**: Ver carpeta `/docs`
  - `BACKEND_ARCHITECTURE.md` - Arquitectura detallada del backend
  - `FRONTEND_DOCUMENTATION.md` - Componentes y estructura del frontend
  - `PROPHET_SYSTEM.md` - Sistema de forecasting con Prophet

---

**Última actualización**: 2025-11-01  
**Versión**: 1.0.0  
**Autor**: RazorZ7X

