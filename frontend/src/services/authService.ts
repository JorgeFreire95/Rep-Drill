import apiClient, { API_URLS } from './api';
import type { LoginCredentials, RegisterData, AuthResponse, User } from '../types';

export const authService = {
  /**
   * Iniciar sesión
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    console.log('🔐 Intentando login con:', { email: credentials.username });
    console.log('🌐 URL:', `${API_URLS.AUTH}/api/v1/auth/login/`);
    
    try {
      const response = await apiClient.post(`${API_URLS.AUTH}/api/v1/auth/login/`, {
        email: credentials.username, // El backend usa 'email' pero el form usa 'username'
        password: credentials.password
      });
      
      console.log('✅ Respuesta del servidor:', response.data);
      
      // Guardar tokens en localStorage
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      
      // El usuario ya viene en la respuesta
      const user = response.data.user;
      
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('✅ Login exitoso, tokens guardados');
      
      return {
        access: response.data.tokens.access,
        refresh: response.data.tokens.refresh,
        user,
      };
    } catch (error: unknown) {
      console.error('❌ Error en login (primer intento /auth/...):', error);
      const resp = (error as { response?: { data?: unknown; status?: number } }).response;
      const status = resp?.status;
      if (status === 404) {
        // Fallback: intentar ruta directa sin prefijo /auth
        try {
          console.warn('↪️ Reintentando login en /api/v1/auth/login/ (fallback sin /auth)');
          const alt = await apiClient.post(`/api/v1/auth/login/`, {
            email: credentials.username,
            password: credentials.password,
          });

          localStorage.setItem('access_token', alt.data.tokens.access);
          localStorage.setItem('refresh_token', alt.data.tokens.refresh);
          const user = alt.data.user;
          localStorage.setItem('user', JSON.stringify(user));
          console.log('✅ Login exitoso por ruta alternativa');
          return {
            access: alt.data.tokens.access,
            refresh: alt.data.tokens.refresh,
            user,
          };
        } catch (fallbackErr) {
          console.error('❌ Fallback de login también falló:', fallbackErr);
          throw fallbackErr;
        }
      }
      console.error('❌ Error response:', resp?.data);
      console.error('❌ Error status:', status);
      throw error;
    }
  },

  /**
   * Registrar nuevo usuario
   */
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post(`${API_URLS.AUTH}/api/v1/auth/register/`, data);
    
    // Auto-login después del registro
    if (response.data.access && response.data.refresh) {
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      
      const userResponse = await apiClient.get(`${API_URLS.AUTH}/api/v1/auth/profile/`);
      const user = userResponse.data;
      
      localStorage.setItem('user', JSON.stringify(user));
      
      return {
        ...response.data,
        user,
      };
    }
    
    return response.data;
  },

  /**
   * Cerrar sesión
   */
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  /**
   * Obtener usuario actual
   */
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get(`${API_URLS.AUTH}/api/v1/auth/profile/`);
    return response.data;
  },

  /**
   * Verificar si hay sesión activa
   */
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('access_token');
    return !!token;
  },

  /**
   * Obtener usuario desde localStorage
   */
  getUserFromStorage: (): User | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  /**
   * Refrescar token de acceso
   */
  refreshToken: async (): Promise<string> => {
    const refreshToken = localStorage.getItem('refresh_token');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await apiClient.post(`${API_URLS.AUTH}/api/v1/auth/token/refresh/`, {
      refresh: refreshToken,
    });
    
    localStorage.setItem('access_token', response.data.access);
    return response.data.access;
  },
};
