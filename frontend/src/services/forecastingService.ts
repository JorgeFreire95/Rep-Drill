import apiClient from './api';

/**
 * Servicio para Prophet Forecasting y Restock Recommendations
 */

// Types
export interface ForecastData {
  ds: string; // date
  yhat: number; // prediction
  yhat_lower?: number; // confidence lower
  yhat_upper?: number; // confidence upper
}

export interface ProphetComponents {
  trend: Array<{ ds: string; value: number }>;
  yearly: Array<{ ds: string; value: number }>;
  weekly: Array<{ ds: string; value: number }>;
}

export interface RestockRecommendation {
  id?: number;
  product_id: number;
  product_name?: string;
  warehouse_id?: number;
  current_stock: number;
  reorder_point: number;
  recommended_quantity: number;
  reorder_priority: 'critical' | 'urgent' | 'high' | 'medium' | 'low';
  stockout_risk?: number;
  days_until_stockout: number;
  forecast_data?: ForecastData[];
  created_at?: string;
}

export interface ForecastAccuracy {
  avg_mape: number;
  avg_mae: number;
  confidence_rate: number;
  total_forecasts: number;
}

export interface CategoryForecast {
  category_id: number;
  category_name?: string;
  forecast: ForecastData[];
  total_products: number;
  current_value: number;
}

export interface WarehouseForecast {
  warehouse_id: number;
  warehouse_name?: string;
  forecast: ForecastData[];
  total_products: number;
  current_value: number;
}

export const forecastingService = {
  // ================== Prophet Forecasts ==================

  /**
   * Get sales forecast
   */
  getSalesForecast: async (periods: number = 30): Promise<ForecastData[]> => {
    try {
      const response = await apiClient.get('/analytics/api/prophet/sales-forecast/', {
        params: { periods }
      });
      return response.data.forecast || [];
  } catch {
      // Fallback: usar tendencia de ventas como serie, para no romper la UI si Prophet no está disponible
      const trend = await apiClient.get('/analytics/api/daily-sales/trend/', {
        params: { days: periods }
      });
      const points: ForecastData[] = (trend.data || []).map((p: { period: string; total_sales: number }) => ({
        ds: p.period,
        yhat: Number(p.total_sales) || 0,
        yhat_lower: undefined,
        yhat_upper: undefined,
      }));
      return points;
    }
  },

  /**
   * Get product demand forecast
   */
  getProductForecast: async (
    productId: number,
    periods: number = 30
  ): Promise<{ forecast: ForecastData[]; product_id: number }> => {
    const response = await apiClient.get('/analytics/api/prophet/product-forecast/', {
      params: { product_id: productId, periods }
    });
    return response.data;
  },

  /**
   * Get top products forecasts (batch)
   */
  getTopProductsForecast: async (
    limit: number = 10,
    periods: number = 30
  ): Promise<Array<{ product_id: number; forecast: ForecastData[] }>> => {
    const response = await apiClient.get('/analytics/api/prophet/top-products-forecast/', {
      params: { top_n: limit, periods }
    });
    return response.data.forecasts || [];
  },

  /**
   * Get forecast by category (aggregated)
   */
  getCategoryForecast: async (
    categoryId: number,
    periods: number = 30
  ): Promise<CategoryForecast> => {
    const response = await apiClient.get('/analytics/api/prophet/category-forecast/', {
      params: { category_id: categoryId, periods }
    });
    return response.data;
  },

  /**
   * Get forecast by warehouse (aggregated)
   */
  getWarehouseForecast: async (
    warehouseId: number,
    periods: number = 30
  ): Promise<WarehouseForecast> => {
    const response = await apiClient.get('/analytics/api/prophet/warehouse-forecast/', {
      params: { warehouse_id: warehouseId, periods }
    });
    return response.data;
  },

  /**
   * Get Prophet components (trend, seasonality)
   */
  getForecastComponents: async (
    productId?: number,
    periods: number = 90
  ): Promise<ProphetComponents> => {
    const response = await apiClient.get('/analytics/api/prophet/forecast-components/', {
      params: { product_id: productId, periods }
    });
    const raw = response.data?.components || response.data;

    const normalize = (
      arr: Array<{ ds: string; value?: number; trend?: number; weekly?: number; yearly?: number }> = []
    ) =>
      arr.map((r) => ({
        ds: r.ds,
        value: r.value ?? r.trend ?? r.weekly ?? r.yearly ?? 0,
      }));

    return {
      trend: normalize(raw?.trend),
      yearly: normalize(raw?.yearly),
      weekly: normalize(raw?.weekly),
    } as ProphetComponents;
  },

  // ================== Restock Recommendations ==================

  /**
   * Analyze single product for restock needs
   */
  analyzeProduct: async (
    productId: number,
    leadTimeDays: number = 7,
    serviceLevel: number = 0.95
  ): Promise<RestockRecommendation> => {
    const response = await apiClient.post('/analytics/api/restock/analyze-product/', {
      product_id: productId,
      lead_time_days: leadTimeDays,
      service_level: serviceLevel
    });
    return response.data.recommendation;
  },

  /**
   * Generate batch restock recommendations
   */
  generateRecommendations: async (params?: {
    min_priority?: string;
    max_products?: number;
    lead_time_days?: number;
  }): Promise<{
    recommendations: RestockRecommendation[];
    created: number;
    updated: number;
  }> => {
    const response = await apiClient.post('/analytics/api/restock/generate-recommendations/', params || {});
    return response.data;
  },

  /**
   * Calculate reorder point for a product
   */
  calculateReorderPoint: async (
    productId: number,
    leadTimeDays: number = 7,
    serviceLevel: number = 0.95
  ): Promise<{
    reorder_point: number;
    safety_stock: number;
    eoq: number;
    daily_demand_mean: number;
    daily_demand_std: number;
  }> => {
    const response = await apiClient.get('/analytics/api/restock/reorder-point/', {
      params: {
        product_id: productId,
        lead_time_days: leadTimeDays,
        service_level: serviceLevel
      }
    });
    return response.data;
  },

  /**
   * Get all restock recommendations (from DB)
   */
  getRecommendations: async (params?: {
    priority?: string;
    warehouse_id?: number;
  }): Promise<RestockRecommendation[]> => {
    const response = await apiClient.get('/analytics/api/reorder-recommendations/', {
      params
    });
    return response.data.results || response.data;
  },

  // ================== Forecast Accuracy ==================

  /**
   * Get forecast accuracy metrics
   */
  getForecastAccuracy: async (params?: {
    forecast_type?: string;
    days?: number;
  }): Promise<ForecastAccuracy> => {
    const response = await apiClient.get('/analytics/api/forecast-accuracy/', {
      params
    });
    return response.data;
  },

  /**
   * Get forecast accuracy history
   */
  getAccuracyHistory: async (params?: {
    product_id?: number;
    forecast_type?: string;
    limit?: number;
  }): Promise<Array<{
    id: number;
    forecast_type: string;
    product_id: number;
    predicted_date: string;
    predicted_value: number;
    actual_value: number;
    percentage_error: number;
    within_confidence: boolean;
  }>> => {
    const response = await apiClient.get('/analytics/api/forecast-accuracy-history/', {
      params
    });
    return response.data.results || response.data;
  },

  // ================== Manual Testing ==================

  /**
   * Manually trigger daily restock recommendations (admin only)
   */
  triggerRestockTask: async (): Promise<{
    status: string;
    created: number;
    updated: number;
  }> => {
    const response = await apiClient.post('/analytics/api/celery/trigger-task/', {
      task_name: 'analytics.tasks.generate_restock_recommendations'
    });
    return response.data;
  },

  /**
   * Manually trigger forecast accuracy update (admin only)
   */
  triggerAccuracyUpdate: async (): Promise<{
    status: string;
    updated: number;
  }> => {
    const response = await apiClient.post('/analytics/api/celery/trigger-task/', {
      task_name: 'analytics.tasks.update_forecast_accuracy'
    });
    return response.data;
  },

  // ================== Purchase Orders ==================

  /**
   * Create purchase order from recommendation(s)
   */
  createPurchaseOrder: async (params: {
    recommendation_id?: number;
    recommendation_ids?: number[];
    supplier_id?: number;
    notes?: string;
  }): Promise<{
    status: string;
    created_orders: Array<{
      order_id: number;
      product_id: number;
      quantity: number;
      recommendation_id: number;
    }>;
    total_created: number;
    errors: Array<{ recommendation_id: number; error: string }>;
    total_errors: number;
  }> => {
    const response = await apiClient.post('/analytics/restock/create-purchase-order/', params);
    return response.data;
  },

  // ================== Dashboard Stats ==================

  /**
   * Get dashboard statistics for forecasting page
   */
  getDashboardStats: async (): Promise<{
    critical_count: number;
    urgent_count: number;
    forecast_accuracy: number;
    total_recommendations: number;
  }> => {
    const response = await apiClient.get('/analytics/api/prophet/dashboard-stats/');
    return response.data;
  },
};

export default forecastingService;
