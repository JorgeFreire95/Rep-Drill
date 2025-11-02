import React, { useEffect, useState } from 'react';
import { Card } from '../components/common';
import SalesCharts from '../components/analytics/SalesCharts';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area } from 'recharts';
import { analyticsService } from '../services/analyticsService';
import { inventarioService } from '../services/inventarioService';
import { AlertCircle, TrendingUp, Loader, Package, AlertTriangle, Activity } from 'lucide-react';
import { logger } from '../utils/logger';

interface ForecastPoint {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

// (Eliminado) interface ProductForecast: ya no se usa

interface RestockRecommendation {
  product_id: number;
  product_name: string;
  product_sku?: string;
  current_stock: number;
  reorder_point: number;
  safety_stock: number;
  recommended_order_quantity: number;
  priority: 'critical' | 'urgent' | 'high' | 'medium' | 'low';
  days_until_stockout: number | null;
  stockout_date: string | null;
  should_reorder: boolean;
  stockout_probability?: number;
}

// Eliminado: TopProductsForecastResponse (no se usa tras cambio a ventas 30 días)

type CatalogProduct = {
  id: number;
  name?: string;
  sku?: string;
  product_name?: string;
  product_sku?: string;
};

const PRIORITY_COLORS = {
  critical: '#EF4444',
  urgent: '#F97316',
  high: '#F59E0B',
  medium: '#10B981',
  low: '#6B7280',
};

export const AnalyticsPage: React.FC = () => {
  const [salesForecast30, setSalesForecast30] = useState<ForecastPoint[]>([]);
  const [restockRecommendations, setRestockRecommendations] = useState<RestockRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helpers: de-duplicate items by product_id and prefer highest severity
  const priorityRank: Record<RestockRecommendation['priority'], number> = {
    critical: 5,
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const dedupeRecommendations = (recs: RestockRecommendation[]): RestockRecommendation[] => {
    const byId = new Map<number, RestockRecommendation>();
    for (const r of recs) {
      const existing = byId.get(r.product_id);
      if (!existing) {
        byId.set(r.product_id, r);
      } else {
        const existingScore = priorityRank[existing.priority];
        const newScore = priorityRank[r.priority];
        const existingDays = existing.days_until_stockout ?? Number.POSITIVE_INFINITY;
        const newDays = r.days_until_stockout ?? Number.POSITIVE_INFINITY;
        // Prefer higher priority; tie-breaker: fewer days until stockout
        if (newScore > existingScore || (newScore === existingScore && newDays < existingDays)) {
          byId.set(r.product_id, r);
        }
      }
    }
    return Array.from(byId.values());
  };

  // eliminado dedupe de pronósticos por producto (se reemplaza por ventas 30 días)

  const fetchAnalytics = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener pronóstico de ventas 30 días y recomendaciones de reorden en paralelo
      const sales30 = (await analyticsService.getSalesForecast(30).catch(() => ([] as ForecastPoint[]))) as ForecastPoint[];
      const restockData = (await analyticsService
          .generateRestockRecommendations({ max_products: 20, min_priority: 'medium' })
          .catch(() => ({ recommendations: [] }))) as { recommendations: RestockRecommendation[] };
      const productsCatalog = (await inventarioService.getProducts().catch(() => ([] as CatalogProduct[]))) as CatalogProduct[];

      // Enrich names/skus from inventory catalog
      const byId: Record<number, { name: string; sku?: string }> = {};
      for (const p of productsCatalog) {
        if (p && typeof p.id === 'number') {
          byId[p.id] = { name: p.name || p.product_name || '', sku: (p.sku || p.product_sku) as string | undefined };
        }
      }
      const uniqueRecs = dedupeRecommendations(restockData.recommendations || []);
      const enrichedRecs = uniqueRecs.map(r => {
        const meta = byId[r.product_id];
        if (meta) {
          return { ...r, product_name: meta.name || r.product_name, product_sku: meta.sku ?? r.product_sku };
        }
        return r;
      });

      setSalesForecast30(sales30);
      setRestockRecommendations(enrichedRecs);
    } catch (err) {
      logger.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar datos de analytics');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inicialización (después de declarar fetchAnalytics)
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-8 h-8 text-blue-600" />
          Analytics & Predicciones
        </h1>
        <p className="text-sm text-gray-600 mt-1">Análisis de ventas, pronósticos de productos y gestión de reorden</p>
      </div>

      {/* Sales Charts */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Ventas (últimos 30 días)</h2>
          <SalesCharts />
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Error al cargar analytics</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Pronóstico Ventas 30 días */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Pronóstico de Ventas (30 días)</h2>
                <p className="text-sm text-gray-600 mt-1">Predicción general de ventas usando Prophet ML</p>
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando...</span>
              </div>
            )}
          </div>

          {!loading && salesForecast30.length > 0 ? (
            <div className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesForecast30}>
                  <defs>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="ds" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} label={{ value: 'Ventas', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value) => `${(value as number).toFixed(0)}`}
                    labelFormatter={(date) => new Date(date).toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="yhat_upper"
                    stroke="none"
                    fill="#60A5FA"
                    fillOpacity={0.15}
                    name="Límite Superior"
                  />
                  <Area
                    type="monotone"
                    dataKey="yhat"
                    stroke="#2563EB"
                    fill="url(#colorForecast)"
                    strokeWidth={2}
                    name="Pronóstico"
                  />
                  <Area
                    type="monotone"
                    dataKey="yhat_lower"
                    stroke="none"
                    fill="#F59E0B"
                    fillOpacity={0.12}
                    name="Límite Inferior"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : !loading ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay datos de pronóstico de ventas disponibles</p>
              <button
                onClick={fetchAnalytics}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Reorder Stock Analysis */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Análisis de Puntos de Reorden</h2>
              <p className="text-sm text-gray-600 mt-1">Cantidades óptimas de reorden y stock de seguridad</p>
            </div>
          </div>

          {!loading && restockRecommendations.length > 0 ? (
            <>
              <div className="w-full h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={restockRecommendations.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="product_name" 
                      tick={{ fontSize: 11 }} 
                      width={150}
                      tickFormatter={(name) => name.length > 20 ? name.substring(0, 20) + '...' : name}
                    />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'Stock Actual') return [`${value} unidades`, name];
                        if (name === 'Punto de Reorden') return [`${value} unidades`, name];
                        if (name === 'Cantidad Recomendada') return [`${value} unidades`, name];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="current_stock" fill="#94A3B8" name="Stock Actual" />
                    <Bar dataKey="reorder_point" fill="#F59E0B" name="Punto de Reorden" />
                    <Bar dataKey="recommended_order_quantity" fill="#10B981" name="Cantidad Recomendada" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Reorder Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Stock Actual</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Punto Reorden</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Stock Seguridad</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Cantidad Reorden</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Prioridad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {restockRecommendations.map((rec, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{rec.product_name}</div>
                          {rec.product_sku && <div className="text-xs text-gray-500">{rec.product_sku}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">{rec.current_stock}</td>
                        <td className="px-4 py-3 text-center font-medium text-orange-600">{rec.reorder_point}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{rec.safety_stock}</td>
                        <td className="px-4 py-3 text-center font-semibold text-green-600">{rec.recommended_order_quantity}</td>
                        <td className="px-4 py-3 text-center">
                          <span 
                            className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                            style={{ backgroundColor: PRIORITY_COLORS[rec.priority] }}
                          >
                            {rec.priority.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : !loading ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay recomendaciones de reorden disponibles</p>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Stockout Risk Analysis */}
      <Card>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Análisis de Riesgo de Stockout</h2>
              <p className="text-sm text-gray-600 mt-1">Probabilidad de quedarse sin stock y días estimados hasta agotamiento</p>
            </div>
          </div>

          {!loading && restockRecommendations.length > 0 ? (
            <>
              {/* Risk Chart */}
              <div className="w-full h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={restockRecommendations.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="product_name" 
                      tick={{ fontSize: 11 }} 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tickFormatter={(name) => name.length > 15 ? name.substring(0, 15) + '...' : name}
                    />
                    <YAxis tick={{ fontSize: 12 }} label={{ value: 'Días hasta stockout', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'Días hasta Stockout') {
                          return value === null ? ['Sin riesgo inmediato', name] : [`${value} días`, name];
                        }
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Producto: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="days_until_stockout" name="Días hasta Stockout">
                      {restockRecommendations.slice(0, 10).map((rec, index) => (
                        <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[rec.priority]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Stock Actual</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Días hasta Stockout</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Fecha Estimada</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Nivel de Riesgo</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {restockRecommendations.filter(r => r.should_reorder).map((rec, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{rec.product_name}</div>
                          {rec.product_sku && <div className="text-xs text-gray-500">{rec.product_sku}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={rec.current_stock === 0 ? 'font-bold text-red-600' : ''}>{rec.current_stock}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold" style={{ color: PRIORITY_COLORS[rec.priority] }}>
                            {rec.days_until_stockout !== null ? `${rec.days_until_stockout} días` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {rec.stockout_date ? new Date(rec.stockout_date).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span 
                            className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                            style={{ backgroundColor: PRIORITY_COLORS[rec.priority] }}
                          >
                            {rec.priority.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {rec.should_reorder ? (
                            <span className="text-red-600 font-semibold">⚠️ Reordenar</span>
                          ) : (
                            <span className="text-green-600">✓ OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : !loading ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No hay datos de análisis de riesgo disponibles</p>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
