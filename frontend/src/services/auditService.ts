import apiClient, { API_URLS } from './api';

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: number;
  created_at: string; // ISO
  model: string; // 'Product' | 'Inventory' | ...
  object_id: number;
  object_repr?: string | null;
  action: AuditAction;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  actor?: string | null;
  ip_address?: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export interface AuditSummaryResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: { create: number; update: number; delete: number };
  results: AuditLog[];
}

export const auditService = {
  // Lista cruda (con búsqueda) usando el ViewSet de audit
  list: async (params?: { search?: string; model?: string; action?: AuditAction; ordering?: string; page?: number; page_size?: number }): Promise<PaginatedResponse<AuditLog>> => {
    const { data } = await apiClient.get(`${API_URLS.INVENTARIO}/api/audit/`, { params });
    return data;
  },

  // Resumen + resultados filtrados (sin search) usando ReportsViewSet.audit
  summary: async (params?: { days?: number; model?: string; action?: AuditAction; page?: number; page_size?: number }): Promise<AuditSummaryResponse> => {
    const { data } = await apiClient.get(`${API_URLS.INVENTARIO}/api/reports/audit/`, { params });
    return data;
  },

  // Cambios de precios y costos por producto
  priceChanges: async (product_id: number): Promise<{ product_id: number; sale: Array<{type:'sale'; price:number; start_date:string; end_date?:string|null}>; cost: Array<{type:'cost'; price:number; start_date:string; end_date?:string|null}>; }> => {
    const { data } = await apiClient.get(`${API_URLS.INVENTARIO}/api/reports/price-changes/`, { params: { product_id } });
    return data;
  },

  // Export CSV con los mismos filtros (scope: 'page' | 'all')
  exportCSV: async (params: { days?: number; model?: string; action?: AuditAction; search?: string; scope?: 'page'|'all'; page?: number; page_size?: number }): Promise<Blob> => {
    const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/reports/audit/export/`, {
      params,
      responseType: 'blob',
      headers: { Accept: 'text/csv' },
    });
    return response.data as Blob;
  },
};
