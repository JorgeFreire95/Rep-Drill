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
    } catch (error: any) {
      console.error('❌ Error en login:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      throw error;
    }
  },

  /**
   * Registrar nuevo usuario
   */
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post(`${API_URLS.AUTH}/api/register/`, data);
    
    // Auto-login después del registro
    if (response.data.access && response.data.refresh) {
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      
      const userResponse = await apiClient.get(`${API_URLS.AUTH}/api/user/`);
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
    const response = await apiClient.get(`${API_URLS.AUTH}/api/user/`);
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
    
    const response = await apiClient.post(`${API_URLS.AUTH}/api/token/refresh/`, {
      refresh: refreshToken,
    });
    
    localStorage.setItem('access_token', response.data.access);
    return response.data.access;
  },
};
