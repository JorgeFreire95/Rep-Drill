# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Rep Drill is an enterprise management system built with a **microservices architecture**. The backend consists of 4 independent Django services (Auth, Personas, Inventario, Ventas) communicating via HTTP REST APIs, with a React + TypeScript frontend.

### Key Architecture Points

- **4 Backend Microservices**: Each runs independently on different ports and can have separate databases
  - Auth (Port 8000): JWT authentication, users, roles, permissions
  - Personas (Port 8003): Customers, employees, suppliers
  - Inventario (Port 8002): Products, categories, warehouses, stock management
  - Ventas (Port 8001): Orders, payments, shipments, dashboard statistics

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
  - Development: Port 5173 (Vite)
  - Production/Docker: Port 3000

- **Inter-Service Communication**: Services call each other directly via HTTP
  - Ventas → Inventario: Updates stock when orders are confirmed
  - Ventas → Personas: Fetches customer/employee data
  - All services validate JWT tokens from Auth

### Critical Business Logic

**Order → Inventory Integration** (in `servicio_ventas/ventas/signals.py`):
- When an Order changes to `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, or `COMPLETED` status, a Django signal (`post_save`) automatically decrements product quantities in the Inventario service
- The `inventory_updated` boolean field on Order prevents duplicate inventory decrements
- This field MUST be checked before any inventory update operations
- The signal makes HTTP PATCH requests to `http://localhost:8002/api/products/{id}/` to update quantities

**Payment-Driven Status Changes**:
- When a Payment is created/updated, the system checks if the Order is fully paid
- Fully paid orders automatically transition to `COMPLETED` status
- Deleting payments may revert status to `CONFIRMED` or `PENDING`

## Development Commands

### Starting Services (Local Development)

Each backend service must run in a separate terminal:

```bash
# Terminal 1 - Auth Service
cd backend/servicio_auth
python manage.py runserver 8000

# Terminal 2 - Personas Service  
cd backend/servicio_personas
python manage.py runserver 8003

# Terminal 3 - Inventario Service
cd backend/servicio_inventario
python manage.py runserver 8002

# Terminal 4 - Ventas Service
# IMPORTANT: Ventas requires DJANGO_SETTINGS_MODULE environment variable
$env:DJANGO_SETTINGS_MODULE='servicio_ventas.settings'  # PowerShell
# export DJANGO_SETTINGS_MODULE='servicio_ventas.settings'  # Bash
cd backend/servicio_ventas
python manage.py runserver 8001

# Terminal 5 - Frontend
cd frontend
npm run dev
# Opens at http://localhost:5173
```

### Docker Commands

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Build and start
docker-compose up --build

# View logs
docker-compose logs -f
docker-compose logs -f <service_name>  # e.g., auth, ventas

# Stop services
docker-compose down

# Stop and remove volumes (database data)
docker-compose down -v

# Restart specific service
docker-compose restart <service_name>
```

### Database Migrations

Run for each service separately:

```bash
# In each backend service directory
python manage.py makemigrations
python manage.py migrate

# With Docker
docker-compose exec auth python manage.py migrate
docker-compose exec personas python manage.py migrate
docker-compose exec inventario python manage.py migrate
docker-compose exec ventas python manage.py migrate
```

### Testing

```bash
# Backend - Run from each service directory
python manage.py test                    # All tests
python manage.py test <app_name>         # Specific app
python manage.py test <app_name>.tests.test_models.TestClassName  # Specific test

# Frontend
cd frontend
npm run test              # Unit tests (if configured)
npm run lint              # ESLint
npm run build             # Type check + build
```

### Other Django Commands

```bash
# Create superuser (run in servicio_auth)
python manage.py createsuperuser

# Django shell
python manage.py shell

# Collect static files (production)
python manage.py collectstatic --no-input
```

### Frontend Commands

```bash
cd frontend

npm install          # Install dependencies
npm run dev          # Development server (port 5173)
npm run build        # Production build (includes TypeScript check)
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## Code Architecture

### Backend Structure

Each Django service follows the same pattern:

```
servicio_<name>/
├── <app_name>/           # Main Django app
│   ├── models.py         # Database models
│   ├── serializers.py    # DRF serializers
│   ├── views.py          # API viewsets
│   ├── permissions.py    # Custom permissions
│   ├── signals.py        # Django signals (if applicable)
│   └── migrations/       # Database migrations
├── servicio_<name>/      # Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── requirements.txt      # Python dependencies
├── Dockerfile
└── manage.py
```

### Frontend Structure

```
frontend/
├── src/
│   ├── components/       # Reusable React components
│   │   ├── common/      # Button, Input, Modal, Table, etc.
│   │   ├── layout/      # Header, Sidebar, Layout
│   │   ├── auth/        # Login, Register
│   │   ├── personas/    # Customer/Employee/Supplier CRUD
│   │   ├── inventario/  # Product/Category CRUD
│   │   └── ventas/      # Order/Payment/Shipment CRUD
│   ├── contexts/        # React Context (AuthContext)
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components (Dashboard, Login, etc.)
│   ├── services/        # API client services
│   │   ├── api.ts      # Axios configuration + interceptors
│   │   ├── authService.ts
│   │   ├── personasService.ts
│   │   ├── inventarioService.ts
│   │   └── ventasService.ts
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Helper functions
└── public/              # Static assets
```

**API Configuration** (`src/services/api.ts`):
```typescript
export const API_URLS = {
  AUTH: 'http://localhost:8000',
  PERSONAS: 'http://localhost:8003',
  INVENTARIO: 'http://localhost:8002',
  VENTAS: 'http://localhost:8001',
};
```

**Axios Interceptors**:
- Request interceptor: Automatically adds JWT token to Authorization header
- Response interceptor: Handles 401 errors and attempts token refresh

### Authentication Flow

1. User logs in via `/api/v1/auth/login/` → receives access + refresh tokens
2. Frontend stores tokens (localStorage/sessionStorage)
3. All API requests include `Authorization: Bearer <access_token>` header
4. Access tokens expire after 1 hour; refresh tokens after 30 days
5. On 401 error, frontend automatically calls `/api/token/refresh/` with refresh token
6. Logout calls `/api/v1/auth/logout/` and blacklists tokens

### Key Models

**Order** (`servicio_ventas/ventas/models.py`):
- `inventory_updated`: Boolean flag that prevents duplicate inventory updates
- Status choices: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED
- Signals trigger on status change to update inventory

**Product** (`servicio_inventario/inventario/models.py`):
- `quantity`: Current stock quantity
- `min_stock`: Minimum stock threshold for alerts
- Updated via PATCH requests from Ventas service

**User** (`servicio_auth/authentication/models.py`):
- Custom user model with email as username
- ForeignKey to Role model
- ManyToMany to Permission for granular permissions

## Development Patterns

### When Adding New Endpoints

1. Define model in `models.py`
2. Create serializer in `serializers.py`
3. Create ViewSet in `views.py` (usually extends `ModelViewSet`)
4. Register URL in `urls.py`
5. Run migrations: `python manage.py makemigrations && python manage.py migrate`
6. Add corresponding API service function in frontend's `services/` directory
7. Update TypeScript types in `frontend/src/types/`

### When Working with Signals

- Signals are in `signals.py` files (currently only in Ventas service)
- Must be imported in `apps.py` ready() method to be active
- Be cautious with HTTP requests in signals - they can cause performance issues
- Always include error handling for external service calls

### Inter-Service Communication

When one service needs data from another:
- Use direct HTTP requests (requests library in Python)
- Include proper error handling and timeouts
- Consider caching for frequently accessed data
- Example: Ventas service calls Inventario to update product quantities

### Environment Variables

Services read from `.env` file or environment variables:
- `DATABASE_*`: PostgreSQL connection details
- `SECRET_KEY`: Django secret key (unique per service)
- `DEBUG`: Enable/disable debug mode
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `CORS_ALLOWED_ORIGINS`: Frontend URLs for CORS

## Testing Strategy

### Backend Tests
- Unit tests for models, serializers, and views
- API integration tests using DRF's APITestCase
- Test inter-service communication with mocked HTTP responses
- Run before committing: `python manage.py test`

### Frontend Tests
- Component tests would use React Testing Library (if configured)
- Type checking via TypeScript compiler: `npm run build`
- Linting via ESLint: `npm run lint`

## Common Issues

### "CORS policy blocked" Error
- Verify `CORS_ALLOWED_ORIGINS` in each service's `settings.py`
- Ensure frontend URL (http://localhost:5173 or http://localhost:3000) is included

### Inventory Not Updating on Order Confirmation
- Check Inventario service is running on port 8002
- Verify `inventory_updated` field is False on the Order
- Review Ventas service logs for HTTP request errors
- Confirm Order status is CONFIRMED or higher

### Migration Conflicts
- If migrations conflict, delete migration files (except `__init__.py`), remake them, and reapply
- Each service has independent migrations

### Token Expired Errors
- Access tokens expire after 1 hour
- Frontend should automatically refresh via response interceptor
- If refresh fails, user must log in again

## API Documentation

Each service exposes Swagger documentation:
- Auth: http://localhost:8000/api/docs/
- Personas: http://localhost:8003/api/docs/
- Inventario: http://localhost:8002/api/docs/
- Ventas: http://localhost:8001/api/docs/

Use "Authorize" button in Swagger UI with: `Bearer <access_token>`

## Production Deployment

1. Set `DEBUG=False` in all services
2. Generate unique `SECRET_KEY` for each service
3. Configure `ALLOWED_HOSTS` properly
4. Use `docker-compose.prod.yml` (if available) or modify `docker-compose.yml`
5. Set up PostgreSQL on separate server/container
6. Enable HTTPS with SSL certificates
7. Use Nginx as reverse proxy
8. Set up monitoring and logging
9. Configure automated database backups

## Coding Standards

**Python (Backend)**:
- Follow PEP 8 style guide
- Use type hints where appropriate
- Write docstrings for classes and complex functions
- Keep ViewSets thin - move business logic to models or separate service modules

**TypeScript (Frontend)**:
- Use functional components with hooks
- Strict typing - avoid `any` type
- Props should be typed with interfaces
- Extract reusable logic into custom hooks
- Keep components focused and single-purpose
