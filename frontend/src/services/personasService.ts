import apiClient, { API_URLS } from './api';
import type { Persona, PersonaFormData, PaginatedResponse } from '../types';

export const personasService = {
  /**
   * Obtener lista de personas con paginación y filtros
   */
  getAll: async (params?: {
    page?: number;
    search?: string;
    es_cliente?: boolean;
    es_proveedor?: boolean;
  }): Promise<PaginatedResponse<Persona>> => {
    const response = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/`, { params });
    return response.data;
  },

  /**
   * Obtener una persona por ID
   */
  getById: async (id: number): Promise<Persona> => {
    const response = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/${id}/`);
    return response.data;
  },

  /**
   * Crear nueva persona
   */
  create: async (data: PersonaFormData): Promise<Persona> => {
    const response = await apiClient.post(`${API_URLS.PERSONAS}/api/personas/`, data);
    return response.data;
  },

  /**
   * Actualizar persona existente
   */
  update: async (id: number, data: Partial<PersonaFormData>): Promise<Persona> => {
    const response = await apiClient.patch(`${API_URLS.PERSONAS}/api/personas/${id}/`, data);
    return response.data;
  },

  /**
   * Eliminar persona
   */
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.PERSONAS}/api/personas/${id}/`);
  },

  /**
   * Obtener solo clientes
   */
  getClientes: async (search?: string): Promise<Persona[]> => {
    const response = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/`, {
      params: { es_cliente: true, search },
    });
    return response.data.results || response.data;
  },

  /**
   * Obtener solo proveedores
   */
  getProveedores: async (search?: string): Promise<Persona[]> => {
    const response = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/`, {
      params: { es_proveedor: true, search },
    });
    return response.data.results || response.data;
  },

  /**
   * Búsqueda rápida de clientes por teléfono, email o nombre
   * Optimizada para empleados buscar clientes en tiempo real
   */
  searchCustomers: async (params: {
    phone?: string;
    email?: string;
    name?: string;
    limit?: number;
  }): Promise<{
    count: number;
    results: Persona[];
  }> => {
    const response = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/search_customers/`, {
      params: {
        phone: params.phone || '',
        email: params.email || '',
        name: params.name || '',
        limit: params.limit || 50,
      },
    });
    return response.data;
  },
};
