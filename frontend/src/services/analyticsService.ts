import apiClient, { API_URLS } from './api';

export type SalesTrendPoint = {
  period: string;
  total_sales: string;
  total_orders: number;
  average_order_value: string;
  products_sold: number;
};

export const analyticsService = {
  // Ventas diarias y tendencias
  getDailySales: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/daily-sales/`, { params });
    return res.data;
  },
  getSalesTrend: async (days: number = 30) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/daily-sales/trend/`, { params: { days } });
    return res.data as SalesTrendPoint[];
  },

  // Demanda de productos
  getProductDemand: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/product-demand/`, { params });
    return res.data;
  },
  getTopProducts: async (limit: number = 10) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/product-demand/top_products/`, { params: { limit } });
    return res.data;
  },

  // Rotación de inventario
  getInventoryTurnover: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/inventory-turnover/`, { params });
    return res.data;
  },
  getInventoryHealth: async () => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/inventory-turnover/inventory_health/`);
    return res.data;
  },

  // Recomendaciones de reorden
  getReorderRecommendations: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/reorder-recommendations/`, { params });
    return res.data;
  },

  // Prophet forecasting endpoints
  getSalesForecast: async (periods: number = 30) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/prophet/sales-forecast/`, { params: { periods } });
    // Backend suele responder { forecast: [...] }
    return (res.data?.forecast ?? res.data) as { ds: string; yhat: number; yhat_lower?: number; yhat_upper?: number }[];
  },
  getProductForecast: async (productId: number, periods: number = 30) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/prophet/product-forecast/`, { params: { product_id: productId, periods } });
    return res.data;
  },
  getTopProductsForecast: async (topN: number = 10, periods: number = 30) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/prophet/top-products-forecast/`, { params: { top_n: topN, periods } });
    return res.data;
  },

  // Restock & Stockout Risk Analysis endpoints
  analyzeProductRestock: async (productId: number, currentStock: number, leadTimeDays: number = 7) => {
    const res = await apiClient.post(`${API_URLS.PREDICCIONES}/api/restock/analyze-product/`, {
      product_id: productId,
      current_stock: currentStock,
      lead_time_days: leadTimeDays,
      service_level: 0.95
    });
    return res.data;
  },
  generateRestockRecommendations: async (params?: { warehouse_id?: number; min_priority?: string; max_products?: number }) => {
    const res = await apiClient.post(`${API_URLS.PREDICCIONES}/api/restock/generate-recommendations/`, {
      lead_time_days: 7,
      max_products: 50,
      ...params
    });
    return res.data;
  },
  calculateReorderPoint: async (productId: number, leadTimeDays: number = 7, serviceLevel: number = 0.95) => {
    const res = await apiClient.get(`${API_URLS.PREDICCIONES}/api/restock/reorder-point/`, {
      params: { product_id: productId, lead_time_days: leadTimeDays, service_level: serviceLevel }
    });
    return res.data;
  },
};
