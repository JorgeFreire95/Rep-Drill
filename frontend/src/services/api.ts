import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Configuración de URLs base
// Usar rutas relativas para que funcione en Docker y otros ambientes
export const API_URLS = {
  AUTH: '/auth', // Servicio de autenticación
  PERSONAS: '/personas', // Servicio de personas
  INVENTARIO: '/inventario', // Servicio de inventario
  VENTAS: '/ventas', // Servicio de ventas
  PREDICCIONES: '/analytics', // Analytics service (Prophet forecasting)
};

// Cliente Axios principal
// Prioriza VITE_API_BASE_URL cuando está definido (útil en dev) y cae al host actual
// Ej.:
//  - VITE_API_BASE_URL=http://localhost  -> usa el gateway Nginx
//  - Sin env: desde http://localhost:3000 o http://localhost/app/ -> http://localhost
const envBase = (typeof window !== 'undefined' && (import.meta as any)?.env?.VITE_API_BASE_URL)
  ? (import.meta as any).env.VITE_API_BASE_URL as string
  : undefined;

const gatewayBaseURL = envBase ?? (typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}`
  : undefined);

const apiClient = axios.create({
  baseURL: gatewayBaseURL,
  timeout: 60000,  // Increased to 60 seconds for slower operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Cliente sin interceptores para operaciones especiales (e.g., refresh)
const bareClient = axios.create({
  baseURL: gatewayBaseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor de requests para agregar el token JWT
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Skip auth for reports endpoints (they use AllowAny)
    const url = (config.url || '').toString();
    if (url.includes('/api/reports/')) {
      return config;
    }
    
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Interceptor de responses para manejar errores y refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Evitar bucle infinito: no intentar refrescar si el fallo viene del propio endpoint de refresh
    const url = (originalRequest?.url || '').toString();
    if (url.includes('/api/v1/auth/token/refresh/')) {
      return Promise.reject(error);
    }

    // Si es error 401 y no hemos intentado refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Intentar refrescar el token (usar el mismo cliente con baseURL del gateway)
        // Usar cliente "bare" sin interceptores para evitar recursión
        const response = await bareClient.post(`${API_URLS.AUTH}/api/v1/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);

        // Reintentar la petición original
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Si falla el refresh, limpiar tokens y redirigir a login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
