/**
 * Forecasting Service con Caché
 * Wrapper del forecastingService original con caching automático
 */

import { forecastingService } from './forecastingService';
import { withCache } from '../utils/cacheUtils';

// TTL por tipo de dato (en milisegundos)
const CACHE_TTL = {
  SALES_FORECAST: 5 * 60 * 1000, // 5 minutos
  PRODUCT_FORECAST: 3 * 60 * 1000, // 3 minutos
  RESTOCK: 2 * 60 * 1000, // 2 minutos
  COMPONENTS: 10 * 60 * 1000, // 10 minutos
};

/**
 * Forecasting Service con caché automático
 * Reduce llamadas al backend y mejora performance
 */
export const cachedForecastingService = {
  // Prophet Forecasts con caché
  getSalesForecast: withCache(
    'forecast:sales',
    forecastingService.getSalesForecast,
    CACHE_TTL.SALES_FORECAST
  ),

  getProductForecast: withCache(
    'forecast:product',
    forecastingService.getProductForecast,
    CACHE_TTL.PRODUCT_FORECAST
  ),

  getTopProductsForecast: withCache(
    'forecast:top-products',
    forecastingService.getTopProductsForecast,
    CACHE_TTL.PRODUCT_FORECAST
  ),

  getCategoryForecast: withCache(
    'forecast:category',
    forecastingService.getCategoryForecast,
    CACHE_TTL.SALES_FORECAST
  ),

  getWarehouseForecast: withCache(
    'forecast:warehouse',
    forecastingService.getWarehouseForecast,
    CACHE_TTL.SALES_FORECAST
  ),

  getForecastComponents: withCache(
    'forecast:components',
    forecastingService.getForecastComponents,
    CACHE_TTL.COMPONENTS
  ),

  // Restock con caché
  analyzeProduct: withCache(
    'restock:analyze',
    forecastingService.analyzeProduct,
    CACHE_TTL.RESTOCK
  ),

  calculateReorderPoint: withCache(
    'restock:reorder-point',
    forecastingService.calculateReorderPoint,
    CACHE_TTL.RESTOCK
  ),

  getRecommendations: withCache(
    'restock:recommendations',
    forecastingService.getRecommendations,
    CACHE_TTL.RESTOCK
  ),

  // Métodos que NO deben cachearse (modifican datos)
  generateRecommendations: forecastingService.generateRecommendations,
  createPurchaseOrder: forecastingService.createPurchaseOrder,
  triggerRestockTask: forecastingService.triggerRestockTask,
  triggerAccuracyUpdate: forecastingService.triggerAccuracyUpdate,

  // Accuracy (cacheable)
  getForecastAccuracy: withCache(
    'forecast:accuracy',
    forecastingService.getForecastAccuracy,
    CACHE_TTL.COMPONENTS
  ),

  getAccuracyHistory: withCache(
    'forecast:accuracy-history',
    forecastingService.getAccuracyHistory,
    CACHE_TTL.COMPONENTS
  ),
};

// Re-exportar tipos
export * from './forecastingService';
