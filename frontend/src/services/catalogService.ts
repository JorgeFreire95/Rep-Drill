import apiClient from './api';

export interface CategoryOption {
  id: number;
  name: string;
}

export interface WarehouseOption {
  id: number;
  name: string;
}

export const catalogService = {
  async getCategories(limit: number = 1000): Promise<CategoryOption[]> {
    const res = await apiClient.get('/inventario/api/categories/', {
      params: { limit }
    });
  const items = (res.data?.results ?? res.data ?? []) as Array<{ id: number; name: string }>;
  return items.map(({ id, name }) => ({ id, name }));
  },

  async getWarehouses(limit: number = 1000): Promise<WarehouseOption[]> {
    const res = await apiClient.get('/inventario/api/warehouses/', {
      params: { limit }
    });
  const items = (res.data?.results ?? res.data ?? []) as Array<{ id: number; name: string }>;
  return items.map(({ id, name }) => ({ id, name }));
  },
};

export default catalogService;
