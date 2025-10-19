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
};
