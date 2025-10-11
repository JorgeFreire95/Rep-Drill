import apiClient, { API_URLS } from './api';
import type { PrediccionConfig, PrediccionResponse } from '../types';

/**
 * Servicio para manejo de predicciones con Prophet
 * Este servicio está preparado para cuando se implemente
 * el backend de predicciones con Prophet
 */
export const prediccionesService = {
  /**
   * Generar predicción para un producto
   */
  generar: async (config: PrediccionConfig): Promise<PrediccionResponse> => {
    const response = await apiClient.post(`${API_URLS.PREDICCIONES}/api/predicciones/generar/`, config);
    return response.data;
  },

  /**
   * Obtener predicciones guardadas de un producto
   */
  getByProducto: async (productoId: number): Promise<PrediccionResponse[]> => {
    const response = await apiClient.get(`${API_URLS.PREDICCIONES}/api/predicciones/`, {
      params: { producto_id: productoId },
    });
    return response.data.results || response.data;
  },

  /**
   * Obtener una predicción específica por ID
   */
  getById: async (id: number): Promise<PrediccionResponse> => {
    const response = await apiClient.get(`${API_URLS.PREDICCIONES}/api/predicciones/${id}/`);
    return response.data;
  },

  /**
   * Obtener histórico de ventas de un producto
   * Útil para visualizar junto con las predicciones
   */
  getHistoricoVentas: async (
    productoId: number,
    params?: {
      fecha_desde?: string;
      fecha_hasta?: string;
    }
  ): Promise<Array<{ fecha: string; cantidad: number }>> => {
    const response = await apiClient.get(
      `${API_URLS.PREDICCIONES}/api/predicciones/historico-ventas/${productoId}/`,
      { params }
    );
    return response.data;
  },

  /**
   * Validar configuración de predicción
   */
  validarConfig: async (config: PrediccionConfig): Promise<{ valid: boolean; errors?: string[] }> => {
    try {
      const response = await apiClient.post(
        `${API_URLS.PREDICCIONES}/api/predicciones/validar-config/`,
        config
      );
      return response.data;
    } catch (error) {
      return { valid: false, errors: ['Error validando configuración'] };
    }
  },
};
