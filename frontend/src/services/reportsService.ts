import apiClient, { API_URLS } from './api';

export type GroupBy = 'day' | 'week' | 'month';

export const reportsService = {
  // Inventario - Kardex
  getKardex: async (params: { product_id: number; warehouse_id?: number; start_date?: string; end_date?: string }) => {
    const { data } = await apiClient.get(`${API_URLS.INVENTARIO}/api/reports/kardex/`, { params });
    return data as {
      product: { id: number; name?: string; sku?: string };
      warehouse_id?: number | null;
      start_date: string;
      end_date: string;
      opening_balance: number;
      rows: Array<{
        date: string;
        warehouse_id: number;
        warehouse_name?: string;
        type: string;
        quantity: number;
        delta: number;
        balance: number;
        notes?: string;
      }>;
    };
  },

  // Analytics - Ventas por período
  getSalesReport: async (params: { start?: string; end?: string; group_by?: GroupBy }) => {
  const { data } = await apiClient.get(`${API_URLS.PREDICCIONES}/api/reports/sales/`, { params });
    return data as {
      start: string;
      end: string;
      group_by: GroupBy;
      rows: Array<{ period: string; total_sales: number; total_orders: number; products_sold: number; average_order_value: number }>;
    };
  },

  // Analytics - Rentabilidad por producto
  getProfitabilityReport: async (params: { start?: string; end?: string }) => {
  const { data } = await apiClient.get(`${API_URLS.PREDICCIONES}/api/reports/profitability/`, { params });
    return data as {
      start: string;
      end: string;
      rows: Array<{ product_id: number; product_name: string; product_sku: string; quantity_sold: number; revenue: number; unit_cost: number; cost: number; profit: number; margin_pct: number }>;
    };
  },
};
