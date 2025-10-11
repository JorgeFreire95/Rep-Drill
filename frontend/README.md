# Frontend - Rep Drill

Frontend moderno para el sistema de gestión empresarial Rep Drill, construido con React, TypeScript y Tailwind CSS.

## 🚀 Tecnologías

- **React 18** - Librería UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **Tailwind CSS** - Framework CSS utility-first
- **React Router** - Enrutamiento
- **Axios** - Cliente HTTP
- **Recharts** - Gráficos y visualizaciones
- **Lucide React** - Iconos
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de esquemas

## 📁 Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── common/         # Componentes comunes (Button, Input, Modal, etc.)
│   │   ├── layout/         # Componentes de layout (Header, Sidebar, etc.)
│   │   ├── auth/           # Componentes de autenticación
│   │   ├── personas/       # Componentes del módulo de personas
│   │   ├── inventario/     # Componentes del módulo de inventario
│   │   ├── ventas/         # Componentes del módulo de ventas
│   │   └── predicciones/   # Componentes del módulo de predicciones
│   ├── contexts/           # React contexts (AuthContext, etc.)
│   ├── hooks/              # Custom hooks
│   ├── pages/              # Páginas principales
│   ├── services/           # Servicios API
│   ├── types/              # Tipos TypeScript
│   ├── utils/              # Utilidades
│   ├── styles/             # Estilos globales
│   ├── App.tsx             # Componente principal
│   └── main.tsx            # Entry point
├── public/                 # Archivos estáticos
├── Dockerfile              # Dockerfile para producción
├── nginx.conf              # Configuración de Nginx
├── tailwind.config.js      # Configuración de Tailwind
├── vite.config.ts          # Configuración de Vite
└── package.json
```

## 🛠️ Instalación y Configuración

### Prerrequisitos

- Node.js 18 o superior
- npm o yarn

### Instalación

```bash
# Instalar dependencias
npm install

# Copiar archivo de variables de entorno
cp .env.example .env

# Editar .env con tu configuración
VITE_API_BASE_URL=http://localhost:8000
```

### Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# El frontend estará disponible en http://localhost:5173
```

### Build para Producción

```bash
# Generar build optimizado
npm run build

# Preview del build de producción
npm run preview
```

## 🐳 Docker

### Build de la imagen

```bash
docker build -t rep-drill-frontend .
```

### Ejecutar contenedor

```bash
docker run -p 3000:80 rep-drill-frontend
```

## 📋 Módulos Principales

### 1. Autenticación

- Login con JWT
- Registro de usuarios
- Gestión de sesión
- Refresh token automático
- Rutas protegidas

### 2. Dashboard

- Resumen de métricas principales
- Gráficos de ventas
- Productos más vendidos
- Alertas de stock bajo

### 3. Gestión de Personas

CRUD completo para clientes y proveedores.

### 4. Gestión de Inventario

- CRUD de productos
- Gestión de categorías
- Control de stock
- Movimientos de inventario
- Alertas de stock bajo

### 5. Gestión de Ventas

- Crear y gestionar ventas
- Historial de ventas
- Estadísticas y reportes
- Filtros avanzados

### 6. Predicciones (Prophet)

Módulo preparado para análisis predictivo con Prophet

## 📱 Responsive Design

El frontend está completamente optimizado para:

- ✅ Desktop (1920px+)
- ✅ Laptop (1024px - 1919px)
- ✅ Tablet (768px - 1023px)
- ✅ Mobile (< 768px)

## 📝 Convenciones de Código

- Componentes: PascalCase (`MyComponent.tsx`)
- Hooks: camelCase con prefijo "use" (`useMyHook.ts`)
- Servicios: camelCase con sufijo "Service" (`myService.ts`)
- Tipos/Interfaces: PascalCase (`MyInterface`)
- Constantes: UPPER_SNAKE_CASE (`MY_CONSTANT`)

## 👤 Autor

Rep Drill Team
