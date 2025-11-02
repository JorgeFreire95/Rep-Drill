import apiClient, { API_URLS } from './api';

export const healthService = {
  checkAuth: async (): Promise<boolean> => {
    try {
      const res = await apiClient.get(`${API_URLS.AUTH}/health/`, { timeout: 5000 });
      return res.status === 200;
    } catch {
      return false;
    }
  },
  checkInventario: async (): Promise<boolean> => {
    try {
      const res = await apiClient.get(`${API_URLS.INVENTARIO}/health/`, { timeout: 5000 });
      return res.status === 200;
    } catch {
      return false;
    }
  },
};

export default healthService;
