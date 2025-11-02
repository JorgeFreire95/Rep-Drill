import apiClient, { API_URLS } from './api';

export interface UserData {
  id?: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: string | number;
  is_active?: boolean;
  is_staff?: boolean;
  is_verified?: boolean;
  password?: string;
}

export interface UserListResponse {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: {
    id: number;
    name: string;
    description: string;
  } | null;
  is_active: boolean;
  is_staff: boolean;
  is_verified: boolean;
  last_login: string | null;
  created_at: string;
  avatar: string | null;
}

export interface RoleData {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

export const userManagementService = {
  /**
   * Obtener lista de todos los usuarios
   */
  getAllUsers: async (): Promise<UserListResponse[]> => {
    const response = await apiClient.get(`${API_URLS.AUTH}/api/v1/auth/admin/users/`);
    // Django REST Framework devuelve un objeto paginado: { count, next, previous, results }
    // Extraemos el array de results
    return response.data.results || response.data;
  },

  /**
   * Obtener un usuario por ID
   */
  getUser: async (id: number): Promise<UserListResponse> => {
    const response = await apiClient.get(`${API_URLS.AUTH}/api/v1/auth/admin/users/${id}/`);
    return response.data;
  },

  /**
   * Crear un nuevo usuario
   */
  createUser: async (data: UserData): Promise<UserListResponse> => {
    const response = await apiClient.post(`${API_URLS.AUTH}/api/v1/auth/admin/users/`, data);
    return response.data;
  },

  /**
   * Actualizar un usuario existente
   */
  updateUser: async (id: number, data: Partial<UserData>): Promise<UserListResponse> => {
    const response = await apiClient.patch(`${API_URLS.AUTH}/api/v1/auth/admin/users/${id}/`, data);
    return response.data;
  },

  /**
   * Eliminar un usuario
   */
  deleteUser: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.AUTH}/api/v1/auth/admin/users/${id}/`);
  },

  /**
   * Activar/Desactivar usuario
   */
  toggleUserStatus: async (id: number, is_active: boolean): Promise<UserListResponse> => {
    const response = await apiClient.patch(`${API_URLS.AUTH}/api/v1/auth/admin/users/${id}/`, {
      is_active,
    });
    return response.data;
  },

  /**
   * Cambiar contraseña de un usuario (admin)
   */
  changeUserPassword: async (id: number, newPassword: string): Promise<void> => {
    await apiClient.post(`${API_URLS.AUTH}/api/v1/auth/admin/users/${id}/change_password/`, {
      new_password: newPassword,
    });
  },

  /**
   * Obtener lista de roles disponibles
   */
  getRoles: async (): Promise<RoleData[]> => {
    const response = await apiClient.get(`${API_URLS.AUTH}/api/v1/auth/admin/roles/`);
    return response.data.results || response.data;
  },

  /**
   * Buscar usuarios por query
   */
  searchUsers: async (query: string): Promise<UserListResponse[]> => {
    const response = await apiClient.get(`${API_URLS.AUTH}/api/v1/auth/admin/users/`, {
      params: { search: query },
    });
    return response.data.results || response.data;
  },

  /**
   * Filtrar usuarios por rol
   */
  filterUsersByRole: async (role: string): Promise<UserListResponse[]> => {
    const response = await apiClient.get(`${API_URLS.AUTH}/api/v1/auth/admin/users/`, {
      params: { role },
    });
    return response.data.results || response.data;
  },
};
