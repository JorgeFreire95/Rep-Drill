import apiClient, { API_URLS } from './api';
import type { 
  Warehouse, 
  WarehouseFormData, 
  Category, 
  CategoryFormData, 
  Product, 
  ProductFormData 
} from '../types';

export const inventarioService = {
  // Warehouses
  getWarehouses: async (): Promise<Warehouse[]> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/warehouses/`);
    return response.data;
  },

  createWarehouse: async (data: WarehouseFormData): Promise<Warehouse> => {
    const response = await apiClient.post(`${API_URLS.INVENTARIO}/api/warehouses/`, data);
    return response.data;
  },

  updateWarehouse: async (id: number, data: Partial<WarehouseFormData>): Promise<Warehouse> => {
    const response = await apiClient.patch(`${API_URLS.INVENTARIO}/api/warehouses/${id}/`, data);
    return response.data;
  },

  deleteWarehouse: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.INVENTARIO}/api/warehouses/${id}/`);
  },

  // Categories
  getCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/categories/`);
    return response.data;
  },

  createCategory: async (data: CategoryFormData): Promise<Category> => {
    const response = await apiClient.post(`${API_URLS.INVENTARIO}/api/categories/`, data);
    return response.data;
  },

  updateCategory: async (id: number, data: Partial<CategoryFormData>): Promise<Category> => {
    const response = await apiClient.patch(`${API_URLS.INVENTARIO}/api/categories/${id}/`, data);
    return response.data;
  },

  deleteCategory: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.INVENTARIO}/api/categories/${id}/`);
  },

  // Products
  getProducts: async (params?: { search?: string; category?: number }): Promise<Product[]> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/products/`, { params });
    return response.data;
  },

  getProduct: async (id: number): Promise<Product> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/products/${id}/`);
    return response.data;
  },

  createProduct: async (data: ProductFormData): Promise<Product> => {
    const response = await apiClient.post(`${API_URLS.INVENTARIO}/api/products/`, data);
    return response.data;
  },

  updateProduct: async (id: number, data: Partial<ProductFormData>): Promise<Product> => {
    const response = await apiClient.patch(`${API_URLS.INVENTARIO}/api/products/${id}/`, data);
    return response.data;
  },

  deleteProduct: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.INVENTARIO}/api/products/${id}/`);
  },
};
