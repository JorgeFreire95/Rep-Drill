# 📚 Documentación Completa - Rep Drill

> Sistema de Gestión Empresarial con Arquitectura de Microservicios

**Última actualización:** 2025-10-11  
**Versión:** 1.0.0

---

## 📑 Tabla de Contenidos

1. [Descripción del Proyecto](#-descripción-del-proyecto)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Stack Tecnológico](#-stack-tecnológico)
4. [Estructura del Proyecto](#-estructura-del-proyecto)
5. [Microservicios](#-microservicios)
6. [Frontend](#-frontend)
7. [Instalación y Configuración](#-instalación-y-configuración)
8. [Credenciales y Acceso](#-credenciales-y-acceso)
9. [API Reference](#-api-reference)
10. [Base de Datos](#-base-de-datos)
11. [Autenticación y Seguridad](#-autenticación-y-seguridad)
12. [Desarrollo](#-desarrollo)
13. [Testing](#-testing)
14. [Despliegue](#-despliegue)
15. [Solución de Problemas](#-solución-de-problemas)
16. [Contribución](#-contribución)

---

## 🎯 Descripción del Proyecto

**Rep Drill** es un sistema integral de gestión empresarial desarrollado con arquitectura de microservicios. El sistema permite administrar de manera eficiente:

- 👥 **Personas** (Clientes, Empleados, Proveedores)
- 📦 **Inventario** (Productos, Categorías, Stock, Almacenes)
- 💰 **Ventas** (Órdenes, Pagos, Envíos)
- 🔐 **Autenticación** (Usuarios, Roles, Permisos)
- 📊 **Dashboard** (Métricas, Estadísticas, Reportes en tiempo real)

### Características Principales

- ✅ Arquitectura de microservicios independientes
- ✅ Autenticación JWT con refresh tokens
- ✅ Dashboard con datos en tiempo real
- ✅ Sistema de roles y permisos personalizable
- ✅ Integración automática entre servicios
- ✅ Actualización de inventario automática al confirmar órdenes
- ✅ Prevención de descuentos duplicados de inventario
- ✅ Frontend moderno y responsive
- ✅ Documentación API interactiva (Swagger)
- ✅ Health checks para monitoreo
- ✅ Dockerizado para fácil despliegue

---

## 🏗️ Arquitectura del Sistema

El sistema está compuesto por **4 microservicios backend independientes** y un **frontend en React**:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    FRONTEND                         │
│              React + TypeScript                     │
│              Puerto: 3000 / 5173                    │
│                                                     │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ HTTP/REST
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐     ┌───────────────┐
│ Servicio Auth │     │ Servicio      │
│ Puerto: 8000  │◄───►│ Personas      │
│ (JWT, Users)  │     │ Puerto: 8003  │
└───────────────┘     └───────────────┘
        │                     │
        │                     │
        ▼                     ▼
┌───────────────┐     ┌───────────────┐
│ Servicio      │     │ Servicio      │
│ Inventario    │◄───►│ Ventas        │
│ Puerto: 8002  │     │ Puerto: 8001  │
└───────────────┘     └───────────────┘
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
        ┌──────────────────┐
        │   PostgreSQL     │
        │   (4 Bases de    │
        │    Datos)        │
        └──────────────────┘
```

### Flujo de Comunicación

1. **Frontend ↔ Auth**: Autenticación, obtención de tokens JWT
2. **Auth ↔ Personas**: Validación de usuarios y permisos
3. **Ventas ↔ Personas**: Obtención de datos de clientes
4. **Ventas ↔ Inventario**: Actualización automática de stock al confirmar órdenes
5. **Dashboard**: Consolida datos de todos los servicios

---

## 💻 Stack Tecnológico

### Backend

| Componente | Tecnología | Versión |
|-----------|------------|---------|
| **Framework** | Django | 5.2.7 |
| **API** | Django REST Framework | 3.16.1 |
| **Base de Datos** | PostgreSQL | 15+ |
| **Autenticación** | Simple JWT | 5.3.0 |
| **Documentación API** | drf-spectacular | 0.28.0 |
| **Health Checks** | django-health-check | 3.17.0 |
| **CORS** | django-cors-headers | 4.3.0 |
| **Servidor** | Gunicorn | 21.2.0 |
| **Lenguaje** | Python | 3.13+ |

### Frontend

| Componente | Tecnología | Versión |
|-----------|------------|---------|
| **Framework** | React | 18.3+ |
| **Lenguaje** | TypeScript | 5.x |
| **Build Tool** | Vite | 6.x |
| **CSS Framework** | Tailwind CSS | 4.x |
| **Routing** | React Router | 7.x |
| **HTTP Client** | Axios | 1.x |
| **State Management** | Redux Toolkit | 2.x |
| **Forms** | React Hook Form | 7.x |
| **Validation** | Zod | 3.x |
| **Charts** | Recharts | 2.x |
| **Icons** | Lucide React | Latest |
| **Date Handling** | date-fns | 4.x |

### DevOps

- **Docker** & **Docker Compose**
- **Git** para control de versiones
- **Nginx** como servidor web en producción

---

## 📁 Estructura del Proyecto

```
rep_drill/
├── backend/
│   ├── servicio_auth/              # Microservicio de Autenticación
│   │   ├── authentication/
│   │   │   ├── models.py          # User, Role, Permission, UserSession
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   ├── permissions.py
│   │   │   └── signals.py
│   │   ├── servicio_auth/
│   │   │   ├── settings.py
│   │   │   └── urls.py
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── manage.py
│   │
│   ├── servicio_personas/         # Microservicio de Personas
│   │   ├── personas/
│   │   │   ├── models.py          # Customer, Employee, Supplier, Persona
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   └── permissions.py
│   │   ├── servicio_personas/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── manage.py
│   │
│   ├── servicio_inventario/       # Microservicio de Inventario
│   │   ├── inventario/
│   │   │   ├── models.py          # Product, Category, Warehouse, Inventory
│   │   │   ├── serializers.py
│   │   │   └── views.py
│   │   ├── servicio_inventario/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── manage.py
│   │
│   └── servicio_ventas/           # Microservicio de Ventas
│       ├── ventas/
│       │   ├── models.py          # Order, OrderDetails, Payment, Shipment
│       │   ├── serializers.py
│       │   ├── views.py
│       │   └── signals.py         # Actualización automática de inventario
│       ├── servicio_ventas/
│       ├── Dockerfile
│       ├── requirements.txt
│       └── manage.py
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Componentes React
│   │   │   ├── common/           # Button, Input, Modal, Table, etc.
│   │   │   ├── layout/           # Header, Sidebar, Layout
│   │   │   ├── auth/             # Login, Register
│   │   │   ├── personas/         # CRUD Personas
│   │   │   ├── inventario/       # CRUD Inventario
│   │   │   └── ventas/           # CRUD Ventas
│   │   ├── contexts/             # AuthContext
│   │   ├── hooks/                # Custom hooks
│   │   ├── pages/                # Dashboard, Login, etc.
│   │   ├── services/             # API clients
│   │   │   ├── api.ts           # Axios config
│   │   │   ├── authService.ts
│   │   │   ├── personasService.ts
│   │   │   ├── inventarioService.ts
│   │   │   └── ventasService.ts
│   │   ├── types/                # TypeScript types
│   │   ├── utils/                # Helpers
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── docker-compose.yml
├── .env
├── .gitignore
├── README.md
└── DOCUMENTACION_COMPLETA.md
```

---

## 🔧 Microservicios

### 1. Servicio de Autenticación (Puerto 8000)

**Responsabilidades:**
- Gestión de usuarios
- Autenticación JWT (access + refresh tokens)
- Sistema de roles y permisos
- Tracking de sesiones
- Verificación de email

**Modelos:**
```python
- User: email, first_name, last_name, phone, avatar, role, permissions
- Role: name (admin, manager, employee, customer, supplier)
- Permission: action (create, read, update, delete), resource
- UserSession: user, token_jti, ip_address, user_agent, expires_at
```

**Endpoints principales:**
```
POST /api/v1/auth/register/          # Registro
POST /api/v1/auth/login/             # Login (retorna tokens)
POST /api/v1/auth/logout/            # Logout
POST /api/v1/auth/token/refresh/     # Refresh token
GET  /api/v1/auth/profile/           # Perfil del usuario
PUT  /api/v1/auth/profile/           # Actualizar perfil
POST /api/v1/auth/change-password/   # Cambiar contraseña
GET  /api/v1/auth/my-permissions/    # Permisos del usuario
```

### 2. Servicio de Personas (Puerto 8003)

**Responsabilidades:**
- Gestión de clientes
- Gestión de empleados
- Gestión de proveedores
- Modelo unificado de Persona

**Modelos:**
```python
- Persona: nombre, tipo_documento, numero_documento, email, telefono
- Customer: persona, credit_limit, payment_terms
- Employee: persona, hire_date, position, salary
- Supplier: persona, contact_person, payment_terms
```

**Endpoints principales:**
```
GET/POST    /api/customers/          # Listar/Crear clientes
GET/PUT/DEL /api/customers/{id}/     # Detalle/Actualizar/Eliminar
GET/POST    /api/employees/          # Listar/Crear empleados
GET/PUT/DEL /api/employees/{id}/     # Detalle/Actualizar/Eliminar
GET/POST    /api/suppliers/          # Listar/Crear proveedores
GET/PUT/DEL /api/suppliers/{id}/     # Detalle/Actualizar/Eliminar
GET/POST    /api/personas/           # Listar/Crear personas
```

### 3. Servicio de Inventario (Puerto 8002)

**Responsabilidades:**
- Gestión de productos
- Categorías de productos
- Control de almacenes
- Gestión de stock
- Historial de precios
- Movimientos de inventario

**Modelos:**
```python
- Product: name, description, sku, category, price, unit_of_measure, quantity, min_stock
- Category: name, description
- Warehouse: name, location, capacity
- Inventory: product, warehouse, quantity, entry_date
- ProductPriceHistory: product, old_price, new_price, change_date
- InventoryEvent: inventory, event_type, quantity, reason
```

**Endpoints principales:**
```
GET/POST    /api/products/             # Listar/Crear productos
GET/PUT/DEL /api/products/{id}/        # Detalle/Actualizar/Eliminar
GET/POST    /api/categories/           # Listar/Crear categorías
GET/POST    /api/warehouses/           # Listar/Crear almacenes
GET/POST    /api/inventories/          # Listar/Crear inventario
GET/POST    /api/price-history/        # Historial de precios
GET/POST    /api/inventory-events/     # Eventos de inventario
```

### 4. Servicio de Ventas (Puerto 8001)

**Responsabilidades:**
- Gestión de órdenes de venta
- Detalles de órdenes
- Registro de pagos
- Gestión de envíos
- Dashboard con estadísticas
- **Actualización automática de inventario**

**Modelos:**
```python
- Order: customer_id, employee_id, order_date, warehouse_id, status, total, inventory_updated
- OrderDetails: order, product_id, quantity, unit_price, discount, subtotal
- Payment: order, amount, payment_date, payment_method
- Shipment: order, shipment_date, warehouse_id, delivered, delivery_status
```

**Estados de Orden:**
- `PENDING`: Pendiente
- `CONFIRMED`: Confirmada (dispara actualización de inventario)
- `PROCESSING`: En Proceso
- `SHIPPED`: Enviada
- `DELIVERED`: Entregada
- `COMPLETED`: Completada (cuando está pagada totalmente)
- `CANCELLED`: Cancelada

**Endpoints principales:**
```
GET/POST    /api/ventas/orders/              # Listar/Crear órdenes
GET/PUT/DEL /api/ventas/orders/{id}/         # Detalle/Actualizar/Eliminar
GET/POST    /api/ventas/order-details/       # Listar/Crear detalles
GET/POST    /api/ventas/payments/            # Listar/Crear pagos
GET/POST    /api/ventas/shipments/           # Listar/Crear envíos
GET         /api/ventas/dashboard/stats/     # Estadísticas del dashboard
```

**Lógica de Negocio Importante:**

1. **Actualización Automática de Inventario:**
   - Cuando una orden cambia a estado `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED` o `COMPLETED`
   - Se ejecuta un **signal** (`post_save`) que descuenta los productos del inventario
   - Usa el campo `inventory_updated` para evitar descuentos duplicados
   - Llama al API del servicio de inventario para actualizar cantidades

2. **Prevención de Descuentos Duplicados:**
   - Campo booleano `inventory_updated` en el modelo `Order`
   - Se establece en `True` después del primer descuento
   - El signal verifica este campo antes de procesar

3. **Actualización de Estado por Pagos:**
   - Cuando se crea/actualiza un pago, se verifica si la orden está completamente pagada
   - Si está pagada, el estado cambia automáticamente a `COMPLETED`
   - Si se elimina un pago y la orden ya no está pagada, revierte a `CONFIRMED` o `PENDING`

---

## 🎨 Frontend

### Tecnologías y Características

- **React 18** con TypeScript para tipado estático
- **Vite** como build tool (desarrollo y producción)
- **Tailwind CSS** para estilos utility-first
- **React Router** para navegación
- **Redux Toolkit** para estado global
- **React Hook Form + Zod** para formularios y validación
- **Axios** con interceptors para manejo de JWT
- **Recharts** para gráficos y visualizaciones
- **Lucide React** para iconos modernos

### Páginas Principales

1. **Login/Register** - Autenticación de usuarios
2. **Dashboard** - Métricas y estadísticas en tiempo real
3. **Personas**
   - Lista de clientes/empleados/proveedores
   - Crear/Editar/Eliminar personas
4. **Inventario**
   - Lista de productos
   - Gestión de categorías
   - Control de stock
   - Alertas de stock bajo
5. **Ventas**
   - Lista de órdenes
   - Crear/Editar órdenes
   - Gestión de pagos
   - Gestión de envíos
   - Filtros avanzados

### Componentes Reutilizables

**Common:**
- `Button`, `Input`, `Select`, `Textarea`
- `Modal`, `Alert`, `Badge`
- `Table`, `Pagination`
- `Card`, `Spinner`, `Toast`

**Layout:**
- `Header` - Navegación principal
- `Sidebar` - Menú lateral
- `Layout` - Wrapper principal

### Configuración de API

```typescript
// src/services/api.ts
export const API_URLS = {
  AUTH: 'http://localhost:8000',       // Autenticación
  PERSONAS: 'http://localhost:8003',   // Personas
  INVENTARIO: 'http://localhost:8002', // Inventario
  VENTAS: 'http://localhost:8001',     // Ventas
};
```

### Interceptors de Axios

- **Request Interceptor**: Agrega automáticamente el token JWT en el header `Authorization`
- **Response Interceptor**: Maneja errores 401 e intenta refresh del token automáticamente

### Responsive Design

- ✅ Desktop (1920px+)
- ✅ Laptop (1024px - 1919px)
- ✅ Tablet (768px - 1023px)
- ✅ Mobile (< 768px)

---

## 🚀 Instalación y Configuración

### Prerrequisitos

- Python 3.13+
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (opcional)

### 1. Clonar el Repositorio

```bash
git clone https://github.com/RazorZ7X/rep_drill.git
cd rep_drill
```

### 2. Configurar Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Base de Datos
DATABASE_SERVER=localhost
DATABASE_USER=postgres
DATABASE_PASSWORD=tu_password
DATABASE_PORT=5432
DATABASE_DB_AUTH=auth_db
DATABASE_DB_PERSONAS=personas_db
DATABASE_DB_INVENTARIO=inventario_db
DATABASE_DB_VENTAS=ventas_db

# Django
SECRET_KEY=tu-secret-key-super-secreta-aqui
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# URLs
BASE_URL=http://localhost:8000/
BASE_URL_FRONTEND=http://localhost:3000/

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Opción A: Instalación Manual

#### Backend

```bash
# Crear bases de datos en PostgreSQL
createdb auth_db
createdb personas_db
createdb inventario_db
createdb ventas_db

# Para cada servicio:
cd backend/servicio_auth
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000

# Repetir para cada servicio en su puerto correspondiente
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Opción B: Docker Compose (Recomendado)

```bash
# Construir y ejecutar todos los servicios
docker-compose up --build

# En segundo plano
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Ejecutar migraciones
docker-compose exec auth python manage.py migrate
docker-compose exec personas python manage.py migrate
docker-compose exec inventario python manage.py migrate
docker-compose exec ventas python manage.py migrate

# Crear superusuario
docker-compose exec auth python manage.py createsuperuser
```

---

## 🔐 Credenciales y Acceso

### Usuarios Predefinidos

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| **Admin** | admin@repdrill.com | admin123 | Administrador |
| **Vendedor** | vendedor@repdrill.com | (por definir) | Employee |

### URLs de Acceso

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:3000 | Aplicación web |
| **Auth API** | http://localhost:8000/api/ | API de autenticación |
| **Personas API** | http://localhost:8003/api/ | API de personas |
| **Inventario API** | http://localhost:8002/api/ | API de inventario |
| **Ventas API** | http://localhost:8001/api/ventas/ | API de ventas |

### Documentación Swagger

| Servicio | Swagger UI | ReDoc |
|----------|-----------|-------|
| **Auth** | http://localhost:8000/api/docs/ | http://localhost:8000/api/redoc/ |
| **Personas** | http://localhost:8003/api/docs/ | http://localhost:8003/api/redoc/ |
| **Inventario** | http://localhost:8002/api/docs/ | http://localhost:8002/api/redoc/ |
| **Ventas** | http://localhost:8001/api/docs/ | http://localhost:8001/api/redoc/ |

### Cómo Usar Swagger

1. Ir a la URL de Swagger UI del servicio deseado
2. Hacer clic en **"Authorize"** (botón con candado)
3. Ingresar el token JWT: `Bearer <tu_token>`
4. Ahora puedes probar todos los endpoints directamente desde el navegador

---

## 📡 API Reference

### Autenticación

#### Obtener Token (Login)

```http
POST /api/v1/auth/login/
Content-Type: application/json

{
  "email": "admin@repdrill.com",
  "password": "admin123"
}

Response 200:
{
  "message": "Inicio de sesión exitoso",
  "user": {
    "id": 1,
    "email": "admin@repdrill.com",
    "full_name": "Admin RepDrill",
    "role": "admin"
  },
  "tokens": {
    "access": "eyJhbGci...",
    "refresh": "eyJhbGci..."
  }
}
```

#### Refrescar Token

```http
POST /api/token/refresh/
Content-Type: application/json

{
  "refresh": "eyJhbGci..."
}

Response 200:
{
  "access": "eyJhbGci..."
}
```

#### Usar Token en Requests

```http
GET /api/v1/auth/profile/
Authorization: Bearer eyJhbGci...
```

### Personas

#### Listar Clientes

```http
GET /api/customers/
Authorization: Bearer <token>

Response 200:
[
  {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com",
    "telefono": "+56912345678",
    "credit_limit": "5000.00"
  }
]
```

#### Crear Cliente

```http
POST /api/customers/
Authorization: Bearer <token>
Content-Type: application/json

{
  "nombre": "María González",
  "tipo_documento": "RUT",
  "numero_documento": "12345678-9",
  "email": "maria@example.com",
  "telefono": "+56987654321",
  "credit_limit": "3000.00",
  "payment_terms": "30 días"
}
```

### Inventario

#### Listar Productos

```http
GET /api/products/
Authorization: Bearer <token>

Response 200:
[
  {
    "id": 1,
    "name": "Producto A",
    "sku": "PROD-001",
    "price": "19990.00",
    "quantity": 50,
    "min_stock": 10,
    "category": {
      "id": 1,
      "name": "Categoría 1"
    }
  }
]
```

#### Actualizar Stock

```http
PATCH /api/products/1/
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 45
}
```

### Ventas

#### Crear Orden

```http
POST /api/ventas/orders/
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer_id": 1,
  "employee_id": 2,
  "warehouse_id": 1,
  "status": "PENDING",
  "notes": "Orden urgente",
  "details": [
    {
      "product_id": 1,
      "quantity": 2,
      "unit_price": "19990.00",
      "discount": "0.00"
    }
  ]
}
```

#### Registrar Pago

```http
POST /api/ventas/payments/
Authorization: Bearer <token>
Content-Type: application/json

{
  "order": 1,
  "amount": "39980.00",
  "payment_method": "Tarjeta de Crédito"
}
```

#### Obtener Estadísticas del Dashboard

```http
GET /api/ventas/dashboard/stats/
Authorization: Bearer <token>

Response 200:
{
  "ventas_hoy": "125000.00",
  "ventas_mes": "3450000.00",
  "ordenes_pendientes": 12,
  "ordenes_completadas": 145,
  "pagos_mes": "3200000.00",
  "envios_pendientes": 8,
  "productos_mas_vendidos": [
    {
      "product_id": 1,
      "product_name": "Producto A",
      "total_quantity": 150,
      "total_sales": "2998500.00"
    }
  ],
  "ventas_diarias": [
    {
      "date": "2025-10-05",
      "total": "45000.00"
    }
  ]
}
```

---

## 🗄️ Base de Datos

### Diagrama Relacional

```
┌─────────────────┐
│      User       │
├─────────────────┤
│ id              │
│ email           │
│ password        │
│ first_name      │
│ last_name       │
│ role_id  ───────┼───► Role
│ is_active       │
└─────────────────┘

┌─────────────────┐
│    Persona      │
├─────────────────┤
│ id              │
│ nombre          │
│ tipo_documento  │
│ numero_documento│
│ email           │
│ telefono        │
└─────────────────┘
        │
        ├──► Customer
        ├──► Employee
        └──► Supplier

┌─────────────────┐       ┌─────────────────┐
│    Product      │       │    Category     │
├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │
│ name            │       │ name            │
│ sku             │       │ description     │
│ category_id ────┼──────►│                 │
│ price           │       └─────────────────┘
│ quantity        │
│ min_stock       │
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│     Order       │       │  OrderDetails   │
├─────────────────┤       ├─────────────────┤
│ id              │◄──────┤ order_id        │
│ customer_id     │       │ product_id      │
│ employee_id     │       │ quantity        │
│ order_date      │       │ unit_price      │
│ status          │       │ discount        │
│ total           │       │ subtotal        │
│ inventory_updated│       └─────────────────┘
└─────────────────┘
        │
        ├──► Payment
        └──► Shipment
```

### Modelos Clave

#### User (Auth)
```python
email: EmailField (único, username_field)
first_name, last_name: CharField
phone: CharField (opcional)
avatar: ImageField (opcional)
role: ForeignKey(Role)
custom_permissions: ManyToMany(Permission)
is_active, is_staff, is_superuser, is_verified: BooleanField
```

#### Order (Ventas)
```python
customer_id: IntegerField (FK a Customer)
employee_id: IntegerField (FK a Employee, opcional)
order_date: DateField (auto: today())
warehouse_id: IntegerField (FK a Warehouse, opcional)
status: CharField (choices: PENDING, CONFIRMED, PROCESSING, etc.)
total: DecimalField
notes: TextField (opcional)
inventory_updated: BooleanField (default=False)
```

#### Product (Inventario)
```python
name: CharField
description: TextField (opcional)
sku: CharField (único)
category: ForeignKey(Category, opcional)
price: DecimalField
unit_of_measure: CharField
quantity: IntegerField
min_stock: IntegerField (default=0)
```

---

## 🔐 Autenticación y Seguridad

### Sistema de Autenticación JWT

1. **Obtener tokens** al hacer login
2. **Access token** (válido por 1 hora): Para todas las peticiones
3. **Refresh token** (válido por 30 días): Para obtener nuevos access tokens
4. **Blacklisting**: Los tokens se invalidan al hacer logout

### Flujo de Autenticación

```
┌────────┐     1. Login      ┌────────┐
│        ├─────────────────►│        │
│ Client │                  │  Auth  │
│        │◄─────────────────┤ Service│
└────────┘   2. Tokens      └────────┘
               (access+refresh)
     │
     │ 3. Request con token
     ▼
┌────────┐     4. Validar    ┌──────────┐
│        ├─────────────────►│ Servicio │
│ Client │                  │ (Personas│
│        │◄─────────────────│ Inv, Vent│
└────────┘   5. Respuesta   └──────────┘
```

### Roles Predefinidos

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **admin** | Administrador | Acceso total al sistema |
| **manager** | Gerente | Gestión de ventas, inventario, reportes |
| **employee** | Empleado | Crear órdenes, ver inventario |
| **customer** | Cliente | Ver su historial, crear órdenes |
| **supplier** | Proveedor | Ver sus productos |

### Permisos Personalizados

Sistema de permisos granular con formato: `{action}_{resource}`

**Acciones:**
- `create`, `read`, `update`, `delete`, `list`

**Recursos:**
- `users`, `customers`, `employees`, `suppliers`
- `products`, `inventory`, `sales`, `reports`

Ejemplo: `create_products`, `read_sales`, `update_customers`

### Seguridad Implementada

- ✅ Contraseñas hasheadas con PBKDF2
- ✅ Validación de contraseñas (mínimo 8 caracteres)
- ✅ Tokens JWT con expiración
- ✅ Blacklisting de tokens al logout
- ✅ CORS configurado correctamente
- ✅ Headers de seguridad (en producción)
- ✅ CSRF protection
- ✅ Rate limiting (recomendado para producción)
- ✅ HTTPS (recomendado para producción)

---

## 💻 Desarrollo

### Iniciar Servicios de Desarrollo

#### Backend (cada servicio en una terminal separada)

```bash
# Terminal 1 - Autenticación
cd backend/servicio_auth
python manage.py runserver 8000

# Terminal 2 - Personas
cd backend/servicio_personas
python manage.py runserver 8003

# Terminal 3 - Inventario
cd backend/servicio_inventario
python manage.py runserver 8002

# Terminal 4 - Ventas
$env:DJANGO_SETTINGS_MODULE='servicio_ventas.settings'
cd backend/servicio_ventas
python manage.py runserver 8001
```

#### Frontend

```bash
cd frontend
npm run dev
# Abre http://localhost:5173
```

### Comandos Útiles

#### Django

```bash
# Crear migraciones
python manage.py makemigrations

# Aplicar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Ejecutar shell de Django
python manage.py shell

# Ejecutar tests
python manage.py test

# Colectar archivos estáticos
python manage.py collectstatic
```

#### Docker

```bash
# Construir imágenes
docker-compose build

# Iniciar servicios
docker-compose up

# Detener servicios
docker-compose down

# Ver logs
docker-compose logs -f servicio_nombre

# Ejecutar comando en contenedor
docker-compose exec servicio_nombre comando

# Reiniciar servicio específico
docker-compose restart servicio_nombre

# Limpiar todo (¡CUIDADO!)
docker-compose down -v
```

#### Frontend

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build

# Preview build
npm run preview

# Lint
npm run lint

# Type check
npm run type-check
```

### Estructura de Commits

```
feat: Nueva funcionalidad
fix: Corrección de bug
docs: Cambios en documentación
style: Formato, punto y coma faltante, etc.
refactor: Refactorización de código
test: Agregar tests
chore: Tareas de mantenimiento
```

---

## 🧪 Testing

### Backend Tests

```bash
# Ejecutar todos los tests
python manage.py test

# Test de una app específica
python manage.py test authentication

# Con cobertura
coverage run --source='.' manage.py test
coverage report
coverage html

# Ejecutar test específico
python manage.py test authentication.tests.test_models.UserModelTest
```

### Tests de API con cURL

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@repdrill.com", "password": "admin123"}'

# Obtener perfil
curl -X GET http://localhost:8000/api/v1/auth/profile/ \
  -H "Authorization: Bearer <access_token>"

# Listar productos
curl -X GET http://localhost:8002/api/products/ \
  -H "Authorization: Bearer <access_token>"

# Crear orden
curl -X POST http://localhost:8001/api/ventas/orders/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "status": "PENDING",
    "details": [
      {"product_id": 1, "quantity": 2, "unit_price": "19990.00"}
    ]
  }'
```

### Frontend Tests

```bash
# Ejecutar tests unitarios
npm run test

# Tests con coverage
npm run test:coverage

# Tests E2E (si están configurados)
npm run test:e2e
```

---

## 🚀 Despliegue

### Producción con Docker

1. **Configurar variables de entorno de producción**

```env
DEBUG=False
SECRET_KEY=<generar-clave-secreta-fuerte>
ALLOWED_HOSTS=tudominio.com,www.tudominio.com
DATABASE_SERVER=db-produccion
CORS_ALLOWED_ORIGINS=https://tudominio.com
```

2. **Build de imágenes**

```bash
docker-compose -f docker-compose.prod.yml build
```

3. **Ejecutar migraciones**

```bash
docker-compose -f docker-compose.prod.yml run auth python manage.py migrate
docker-compose -f docker-compose.prod.yml run personas python manage.py migrate
docker-compose -f docker-compose.prod.yml run inventario python manage.py migrate
docker-compose -f docker-compose.prod.yml run ventas python manage.py migrate
```

4. **Colectar archivos estáticos**

```bash
docker-compose -f docker-compose.prod.yml run auth python manage.py collectstatic --no-input
```

5. **Iniciar servicios**

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Nginx como Reverse Proxy

```nginx
server {
    listen 80;
    server_name tudominio.com;

    location /api/v1/auth/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/personas/ {
        proxy_pass http://localhost:8003;
    }

    location /api/inventario/ {
        proxy_pass http://localhost:8002;
    }

    location /api/ventas/ {
        proxy_pass http://localhost:8001;
    }

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### Checklist de Producción

- [ ] `DEBUG=False` en todos los servicios
- [ ] `SECRET_KEY` única y segura en cada servicio
- [ ] `ALLOWED_HOSTS` configurado correctamente
- [ ] Base de datos PostgreSQL en servidor separado
- [ ] SSL/TLS configurado (HTTPS)
- [ ] Servidor WSGI (Gunicorn) en cada servicio
- [ ] Nginx como reverse proxy
- [ ] Archivos estáticos servidos por Nginx
- [ ] Backups automáticos de base de datos
- [ ] Logging configurado
- [ ] Monitoreo activo (Sentry, New Relic, etc.)
- [ ] Rate limiting configurado
- [ ] Firewall configurado

---

## 🔍 Solución de Problemas

### Error: "No se puede conectar a la base de datos"

**Solución:**
1. Verificar que PostgreSQL esté corriendo
2. Verificar credenciales en `.env`
3. Verificar que las bases de datos existan
4. Verificar permisos del usuario de base de datos

```bash
# Verificar conexión
psql -U postgres -h localhost -p 5432
# Listar bases de datos
\l
```

### Error: "CORS policy blocked"

**Solución:**
1. Verificar `CORS_ALLOWED_ORIGINS` en `settings.py`
2. Asegurar que el frontend esté en la lista
3. Para desarrollo, usar `CORS_ALLOW_ALL_ORIGINS = True`

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]
```

### Error: "Token inválido o expirado"

**Solución:**
1. Verificar que el token sea válido
2. Intentar refresh del token
3. Si persiste, hacer logout/login nuevamente

```bash
# Refresh token
curl -X POST http://localhost:8000/api/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<refresh_token>"}'
```

### Error: "Inventario no se actualiza al confirmar orden"

**Solución:**
1. Verificar que el servicio de inventario esté corriendo en puerto 8002
2. Revisar logs del servicio de ventas
3. Verificar que el campo `inventory_updated` esté en `False`
4. Verificar que la orden esté en estado `CONFIRMED` o superior

```bash
# Ver logs del servicio de ventas
docker-compose logs -f ventas
```

### Error: "Frontend no se conecta al backend"

**Solución:**
1. Verificar URLs en `src/services/api.ts`
2. Verificar que todos los servicios backend estén corriendo
3. Verificar CORS en backend

```typescript
// src/services/api.ts
export const API_URLS = {
  AUTH: 'http://localhost:8000',
  PERSONAS: 'http://localhost:8003',
  INVENTARIO: 'http://localhost:8002',
  VENTAS: 'http://localhost:8001',
};
```

### Error: "Migraciones no se aplican"

**Solución:**
```bash
# Eliminar migraciones anteriores
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete

# Crear nuevas migraciones
python manage.py makemigrations

# Aplicar
python manage.py migrate
```

### Servicios no inician correctamente

**Solución:**
```bash
# Detener todos los servicios
docker-compose down

# Limpiar contenedores, redes y volúmenes
docker-compose down -v

# Reconstruir
docker-compose build --no-cache

# Iniciar
docker-compose up
```

---

## 👥 Contribución

### Cómo Contribuir

1. **Fork** del repositorio
2. Crear una **rama** para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. **Commit** de los cambios (`git commit -m 'feat: Agregar nueva funcionalidad'`)
4. **Push** a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear un **Pull Request**

### Estándares de Código

**Python (Backend):**
- Seguir PEP 8
- Docstrings para clases y funciones
- Type hints cuando sea posible
- Tests para nuevas funcionalidades

**TypeScript (Frontend):**
- Seguir guía de estilo de Airbnb
- Componentes funcionales con hooks
- Tipado estricto
- Comentarios en funciones complejas

---

## 📞 Soporte y Contacto

- **Issues**: [rep_drill/issues](https://github.com/RazorZ7X/rep_drill/issues)

---

## 📌 Notas Importantes

### Consideraciones de Seguridad

- **Nunca** commitear archivos `.env` con credenciales reales
- **Siempre** usar contraseñas fuertes en producción
- **Implementar** rate limiting en endpoints públicos
- **Habilitar** HTTPS en producción
- **Configurar** backups automáticos

### Performance

- Usar **paginación** en listados grandes
- Implementar **caché** con Redis para datos frecuentes
- Optimizar **queries** de base de datos (select_related, prefetch_related)
- Usar **indexes** en campos frecuentemente consultados

### Escalabilidad

- Cada microservicio puede escalar independientemente
- Considerar **load balancer** para múltiples instancias
- Usar **message queues** (RabbitMQ, Celery) para tareas asíncronas
- Implementar **API Gateway** para centralizar requests

---

**Última actualización**: 2025-10-11  
**Versión de la documentación**: 1.0.0  
**Mantenido por**: Rep Drill Team

---

