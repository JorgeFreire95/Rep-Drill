import apiClient, { API_URLS } from './api';

// Tipos para las respuestas del dashboard
export interface DashboardSummary {
  total_sales: number;
  total_orders: number;
  products_sold: number;
  average_order_value: number;
  sales_change_percent: number;
  orders_change_percent: number;
  period_days: number;
  start_date: string;
  end_date: string;
}

export interface SalesTrendData {
  date: string;
  sales: number;
  orders: number;
  products: number;
}

export interface SalesTrendResponse {
  trend: SalesTrendData[];
  period_days: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  product_sku: string;
  total_revenue: number;
  total_quantity_sold: number;
  total_orders: number;
}

export interface TopProductsResponse {
  products: TopProduct[];
  limit: number;
  period_days: number;
}

export interface StockProduct {
  id: number;
  name: string;
  sku?: string;
  quantity: number;
  min_stock: number;
  alert_level: string;
  alert_message: string;
}

export interface CriticalStockResponse {
  critical: StockProduct[];
  warning: StockProduct[];
  medium: StockProduct[];
  critical_count: number;
  warning_count: number;
  medium_count: number;
}

// Servicio de analytics para el dashboard
export const dashboardService = {
  // Obtener resumen de métricas principales
  getSummary: async (days: number = 30): Promise<DashboardSummary> => {
    const response = await apiClient.get<DashboardSummary>(
      `${API_URLS.PREDICCIONES}/api/dashboard/summary/`,
      { params: { days } }
    );
    return response.data;
  },

  // Obtener tendencia de ventas
  getSalesTrend: async (days: number = 30): Promise<SalesTrendResponse> => {
    const response = await apiClient.get<SalesTrendResponse>(
      `${API_URLS.PREDICCIONES}/api/dashboard/sales_trend/`,
      { params: { days } }
    );
    return response.data;
  },

  // Obtener top productos
  getTopProducts: async (limit: number = 10, days: number = 30): Promise<TopProductsResponse> => {
    const response = await apiClient.get<TopProductsResponse>(
      `${API_URLS.PREDICCIONES}/api/dashboard/top_products/`,
      { params: { limit, days } }
    );
    return response.data;
  },

  // Obtener productos con stock crítico
  getCriticalStock: async (): Promise<CriticalStockResponse> => {
    const response = await apiClient.get<CriticalStockResponse>(
      `${API_URLS.PREDICCIONES}/api/dashboard/critical_stock/`
    );
    return response.data;
  },
};
