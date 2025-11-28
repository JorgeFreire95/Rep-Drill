import apiClient, { API_URLS } from './api';
import type { 
  Warehouse, 
  WarehouseFormData, 
  Category, 
  CategoryFormData, 
  Product, 
  ProductFormData,
  LowStockResponse,
  LowStockCountResponse,
  ReorderRequest,
  ReorderStatusHistory,
  StockReservation,
  ReservationSummary
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

    // Stock Alerts
    getLowStockProducts: async (): Promise<LowStockResponse> => {
      const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/products/low-stock/`);
      return response.data;
    },

    getLowStockCount: async (): Promise<LowStockCountResponse> => {
      const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/products/low-stock/count/`);
      return response.data;
    },
  
  // Reorders
  createReorder: async (productId: number, quantity?: number, notes?: string): Promise<ReorderRequest> => {
    const payload: { product: number; quantity?: number; notes?: string } = { product: productId };
    if (quantity && quantity > 0) payload.quantity = quantity;
    if (notes) payload.notes = notes;
    const response = await apiClient.post(`${API_URLS.INVENTARIO}/api/reorders/`, payload);
    return response.data;
  },
  listReorders: async (): Promise<ReorderRequest[]> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/reorders/`);
    return response.data;
  },
  countRequestedReorders: async (): Promise<number> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/reorders/`, { params: { status: 'requested' } });
    const data = response.data;
    return Array.isArray(data) ? data.length : 0;
  },
  markReorderOrdered: async (id: number): Promise<ReorderRequest> => {
    const response = await apiClient.post(`${API_URLS.INVENTARIO}/api/reorders/${id}/mark_ordered/`, {});
    return response.data;
  },
  markReorderReceived: async (id: number): Promise<ReorderRequest> => {
    const response = await apiClient.post(`${API_URLS.INVENTARIO}/api/reorders/${id}/mark_received/`, {});
    return response.data;
  },
  cancelReorder: async (id: number): Promise<ReorderRequest> => {
    const response = await apiClient.post(`${API_URLS.INVENTARIO}/api/reorders/${id}/cancel/`, {});
    return response.data;
  },
  getReorderHistory: async (id: number): Promise<ReorderStatusHistory[]> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/reorders/${id}/history/`);
    return response.data;
  },

  // Stock Reservations
  getActiveReservations: async (): Promise<ReservationSummary> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/reservations/active_summary/`);
    return response.data;
  },

  getReservationsByOrder: async (orderId: string): Promise<StockReservation[]> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/reservations/by_order/`, {
      params: { order_id: orderId }
    });
    return response.data;
  },

  releaseReservation: async (id: number): Promise<void> => {
    await apiClient.post(`${API_URLS.INVENTARIO}/api/reservations/${id}/release/`);
  },
};
