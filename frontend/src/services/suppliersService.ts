import apiClient, { API_URLS } from './api';

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  payment_terms?: string;
  tax_id?: string;
  is_active: boolean;
  rating?: number | null;
  on_time_rate?: number | null;
  created_at?: string;
  updated_at?: string;
  products_count?: number;
}

export interface ProductSummary {
  id: number;
  name: string;
  sku: string;
  cost_price: number;
  price: number;
  quantity: number;
  min_stock: number;
}

export interface Reorder {
  id: number;
  product: number;
  product_name: string;
  supplier?: number;
  quantity: number;
  status: 'requested'|'ordered'|'received'|'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const suppliersService = {
  list: async (): Promise<Supplier[]> => {
    const { data } = await apiClient.get<Supplier[]>(`${API_URLS.INVENTARIO}/api/suppliers/`);
    return data;
  },
  create: async (payload: Partial<Supplier>): Promise<Supplier> => {
    const { data } = await apiClient.post<Supplier>(`${API_URLS.INVENTARIO}/api/suppliers/`, payload);
    return data;
  },
  update: async (id: number, payload: Partial<Supplier>): Promise<Supplier> => {
    const { data } = await apiClient.put<Supplier>(`${API_URLS.INVENTARIO}/api/suppliers/${id}/`, payload);
    return data;
  },
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.INVENTARIO}/api/suppliers/${id}/`);
  },
  getProducts: async (id: number): Promise<{count:number; results: ProductSummary[]}> => {
    const { data } = await apiClient.get(`${API_URLS.INVENTARIO}/api/suppliers/${id}/products/`);
    return data;
  },
  attachProduct: async (id: number, product_id: number): Promise<{status:string; product_id:number}> => {
    const { data } = await apiClient.post(`${API_URLS.INVENTARIO}/api/suppliers/${id}/attach_product/`, { product_id });
    return data;
  },
  detachProduct: async (id: number, product_id: number): Promise<{status:string; product_id:number}> => {
    const { data } = await apiClient.post(`${API_URLS.INVENTARIO}/api/suppliers/${id}/detach_product/`, { product_id });
    return data;
  },
  getPurchases: async (id: number, days=180, status?: string): Promise<{count:number; total_quantity:number; estimated_total_value:number; average_lead_time_days:number|null; results: Reorder[]}> => {
    const { data } = await apiClient.get(`${API_URLS.INVENTARIO}/api/suppliers/${id}/purchases/`, { params: { days, status } });
    return data;
  },
  getPerformance: async (id: number, params?: { days?: number; expected_days?: number; update?: boolean }): Promise<{evaluated_orders:number; on_time_orders:number; on_time_rate:number|null; average_lead_time_days:number|null; expected_days:number; window_days:number}> => {
    const { data } = await apiClient.get(`${API_URLS.INVENTARIO}/api/suppliers/${id}/performance/`, { params });
    return data;
  },
};
