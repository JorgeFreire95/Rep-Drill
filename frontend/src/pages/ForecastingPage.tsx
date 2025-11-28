import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { MessageSquare, Activity, AlertTriangle } from 'lucide-react';
import { Card } from '../components/common';
import { Cell } from 'recharts';
import forecastingService, {
  type ForecastData,
  type RestockRecommendation,
  type ProphetComponents,
} from '../services/forecastingService';
// import catalogService from '../services/catalogService'; // Commented out - not using category/warehouse forecasts
import ChatbotPanel from '../components/chatbot/ChatbotPanel';
import '../styles/ForecastingPage.css';
import { logger } from '../utils/logger';

// (DashboardStats removido: ya no se renderiza en Option C)

interface TopProductForecast {
  product_id: number;
  product_name?: string;
  product_code?: string;
  forecast: ForecastData[];
}


const PRIORITY_COLORS = {
  critical: '#EF4444',
  urgent: '#F97316',
  high: '#F59E0B',
  medium: '#10B981',
  low: '#6B7280',
};

const ForecastingPage: React.FC = () => {
  // State
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'forecast' | 'top' | 'restock' | 'components'>('forecast');
  
  // Forecast data
  const [salesForecast, setSalesForecast] = useState<ForecastData[]>([]);
  // const [salesForecast30, setSalesForecast30] = useState<ForecastData[]>([]);
  const [forecastPeriods, setForecastPeriods] = useState(30);
  const [topForecasts, setTopForecasts] = useState<TopProductForecast[]>([]);
  const [topN, setTopN] = useState(10);
  const [topPeriods, setTopPeriods] = useState(30);
  // Eliminado pronóstico por producto
  
  // Restock data
  const [recommendations, setRecommendations] = useState<RestockRecommendation[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Components data
  const [components, setComponents] = useState<ProphetComponents | null>(null);
  // Aggregated forecasts - Commented out unused states
  // const [categoryId, setCategoryId] = useState<number | ''>('');
  // const [categoryForecast, setCategoryForecast] = useState<ForecastData[] | null>(null);
  // const [warehouseId, setWarehouseId] = useState<number | ''>('');
  // const [warehouseForecast, setWarehouseForecast] = useState<ForecastData[] | null>(null);
  // const [categories, setCategories] = useState<CategoryOption[]>([]);
  // const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  // const [loadingCategory, setLoadingCategory] = useState(false);
  // const [loadingWarehouse, setLoadingWarehouse] = useState(false);
  
  // Stats (no longer rendered, kept for future use if needed)

  // Chatbot
  const [chatOpen, setChatOpen] = useState(false);

  // ================== Data Loading ==================

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Carga inicial independiente de funciones auxiliares para evitar dependencias en hooks
      const [sales, top, recs, comps] = await Promise.all([
        forecastingService.getSalesForecast(30),
        forecastingService.getTopProductsForecast(10, 30),
        forecastingService.getRecommendations(),
        forecastingService.getForecastComponents(undefined, 90),
      ]);

      setSalesForecast(sales);
      // setSalesForecast30(sales);
      setTopForecasts(top);
      setRecommendations(recs);
      setComponents(comps);
      
      // Calcular métricas para tarjetas (Option C)
      
      // (Tarjetas de overview eliminadas)
    } catch (error) {
      logger.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Inicialización
  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const loadSalesForecast = async (periods?: number) => {
    try {
      const periodsToUse = periods !== undefined ? periods : forecastPeriods;
      const data = await forecastingService.getSalesForecast(periodsToUse);
      setSalesForecast(data);
    } catch (error) {
      logger.error('Error loading forecast:', error);
    }
  };

  const loadTopForecasts = async () => {
    try {
      const data = await forecastingService.getTopProductsForecast(topN, topPeriods);
      setTopForecasts(data);
    } catch (error) {
      logger.error('Error loading top products forecast:', error);
    }
  };

  // Eliminado loader de producto

  const loadRecommendations = async () => {
    try {
      const data = await forecastingService.getRecommendations();
      setRecommendations(data);
    } catch (error) {
      logger.error('Error loading recommendations:', error);
    }
  };

  const loadComponents = async () => {
    try {
      const data = await forecastingService.getForecastComponents(undefined, 90);
      setComponents(data);
    } catch (error) {
      logger.error('Error loading components:', error);
    }
  };

  // const loadCategoryForecast = async () => {
  //   if (!categoryId) { setCategoryForecast(null); return; }
  //   setLoadingCategory(true);
  //   try {
  //     const data = await forecastingService.getCategoryForecast(Number(categoryId), 30);
  //     setCategoryForecast(data.forecast || []);
  //   } catch (error) {
  //     logger.error('Error loading category forecast:', error);
  //     setCategoryForecast([]);
  //   } finally {
  //     setLoadingCategory(false);
  //   }
  // };

  // const loadWarehouseForecast = async () => {
  //   if (!warehouseId) { setWarehouseForecast(null); return; }
  //   setLoadingWarehouse(true);
  //   try {
  //     const data = await forecastingService.getWarehouseForecast(Number(warehouseId), 30);
  //     setWarehouseForecast(data.forecast || []);
  //   } catch (error) {
  //     logger.error('Error loading warehouse forecast:', error);
  //     setWarehouseForecast([]);
  //   } finally {
  //     setLoadingWarehouse(false);
  //   }
  // };

  // Cargar catálogos al entrar a la página (y en tabs específicos)
  useEffect(() => {
    // Load catalogs (commented out - not using category/warehouse forecasts)
    // (async () => {
    //   try {
    //     const [cats, whs] = await Promise.all([
    //       catalogService.getCategories(1000),
    //       catalogService.getWarehouses(1000),
    //     ]);
    //     setCategories(cats);
    //     setWarehouses(whs);
    //   } catch (e) {
    //     logger.error('Error loading catalogs', e);
    //   }
    // })();
  }, []);

  // loadStats eliminado (no se usan tarjetas KPI antiguas)

  const handleGenerateRecommendations = async () => {
    setLoading(true);
    try {
      const result = await forecastingService.generateRecommendations({
        min_priority: 'medium',
        max_products: 100,
      });
      alert(`Generadas ${result.created} nuevas recomendaciones, ${result.updated} actualizadas`);
      await loadRecommendations();
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      alert('Error generando recomendaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePurchaseOrder = async (recommendationId: number) => {
    if (!confirm('¿Crear orden de compra para esta recomendación?')) return;
    
    setLoading(true);
    try {
      const result = await forecastingService.createPurchaseOrder({
        recommendation_id: recommendationId,
        notes: 'Orden automática desde forecast dashboard'
      });
      
      if (result.total_created > 0) {
        alert(`✅ Orden de compra creada exitosamente (ID: ${result.created_orders[0].order_id})`);
        await loadRecommendations();
      } else if (result.total_errors > 0) {
        alert(`❌ Error: ${result.errors[0].error}`);
      }
    } catch (error) {
      logger.error('Error creating purchase order:', error);
      alert('Error creando orden de compra');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBulkOrders = async () => {
    const criticalRecs = recommendations
      .filter(r => r.reorder_priority === 'critical' || r.reorder_priority === 'urgent')
      .map(r => r.id)
      .filter((id): id is number => id !== undefined);
    
    if (criticalRecs.length === 0) {
      alert('No hay recomendaciones críticas/urgentes');
      return;
    }
    
    if (!confirm(`¿Crear ${criticalRecs.length} órdenes de compra para todas las recomendaciones críticas/urgentes?`)) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await forecastingService.createPurchaseOrder({
        recommendation_ids: criticalRecs,
        notes: 'Batch automático de órdenes críticas'
      });
      
      alert(
        `✅ Órdenes creadas: ${result.total_created}\n` +
        `${result.total_errors > 0 ? `❌ Errores: ${result.total_errors}` : ''}`
      );
      await loadRecommendations();
    } catch (error) {
      logger.error('Error creating bulk orders:', error);
      alert('Error creando órdenes masivas');
    } finally {
      setLoading(false);
    }
  };

  // ================== Render Helpers ==================

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: '#dc2626',
      urgent: '#ea580c',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#10b981',
    };
    return colors[priority] || '#6b7280';
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = {
      critical: 'Crítico',
      urgent: 'Urgente',
      high: 'Alto',
      medium: 'Medio',
      low: 'Bajo',
    };
    return labels[priority] || priority;
  };

  // ================== Render Sections ==================

  const renderStats = () => (
    <div className="simple-subtitle">Vista general de predicciones y acciones</div>
  );

  const renderForecastTab = () => (
    <div className="forecast-section">
      <div className="section-header">
        <h2>Predicciones de Ventas</h2>
        <div className="controls">
          <label>
            Períodos:
            <select
              value={forecastPeriods}
              onChange={(e) => {
                const newPeriods = Number(e.target.value);
                setForecastPeriods(newPeriods);
                loadSalesForecast(newPeriods);
              }}
            >
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
          </label>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={salesForecast}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="ds"
            tickFormatter={formatDate}
          />
          <YAxis 
            tickFormatter={(value) => {
              if (value >= 1000000) {
                return `$${(value / 1000000).toFixed(1)}M`;
              } else if (value >= 1000) {
                return `$${(value / 1000).toFixed(0)}K`;
              }
              return `$${value}`;
            }}
          />
          <Tooltip
            labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')}
            formatter={(value: number, name: string) => {
              const formattedValue = formatCurrency(value);
              let label = name;
              if (name === 'yhat') label = 'Predicción';
              else if (name === 'yhat_upper') label = 'Límite Superior';
              else if (name === 'yhat_lower') label = 'Límite Inferior';
              return [formattedValue, label];
            }}
          />
          <Legend 
            formatter={(value) => {
              if (value === 'yhat') return 'Predicción';
              if (value === 'yhat_upper') return 'Límite Superior';
              if (value === 'yhat_lower') return 'Límite Inferior';
              return value;
            }}
          />
          
          {/* Confidence interval */}
          <Area
            type="monotone"
            dataKey="yhat_upper"
            fill="#10B981"
            fillOpacity={0.15}
            stroke="#10B981"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            name="yhat_upper"
          />
          <Area
            type="monotone"
            dataKey="yhat_lower"
            fill="#10B981"
            fillOpacity={0.15}
            stroke="#10B981"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            name="yhat_lower"
          />
          
          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey="yhat"
            stroke="#2563EB"
            strokeWidth={3}
            dot={false}
            name="yhat"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Reorder Point Analysis */}
      {!loading && recommendations.length > 0 && (
        <Card className="mt-6">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Análisis de Puntos de Reorden</h2>
                <p className="text-sm text-gray-600 mt-1">Cantidades óptimas de reorden y stock de seguridad</p>
              </div>
            </div>

            <div className="w-full h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recommendations.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    type="category" 
                    dataKey="product_name" 
                    tick={{ fontSize: 11 }} 
                    width={150}
                    tickFormatter={(name) => name && name.length > 20 ? name.substring(0, 20) + '...' : name}
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
                  <Bar dataKey="recommended_quantity" fill="#10B981" name="Cantidad Recomendada" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Stock Actual</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Punto Reorden</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Cantidad Reorden</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Prioridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recommendations.slice(0, 8).map((rec, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{rec.product_name}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{rec.current_stock}</td>
                      <td className="px-4 py-3 text-center font-medium text-orange-600">{rec.reorder_point}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{rec.recommended_quantity}</td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                          style={{ backgroundColor: PRIORITY_COLORS[rec.reorder_priority] }}
                        >
                          {rec.reorder_priority.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Stockout Risk Analysis */}
      {!loading && recommendations.length > 0 && (
        <Card className="mt-6">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Análisis de Riesgo de Stockout</h2>
                <p className="text-sm text-gray-600 mt-1">Probabilidad de quedarse sin stock y días estimados hasta agotamiento</p>
              </div>
            </div>

            <div className="w-full h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recommendations.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="product_name" 
                    tick={{ fontSize: 11 }} 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tickFormatter={(name) => name && name.length > 15 ? name.substring(0, 15) + '...' : name}
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
                    {recommendations.slice(0, 10).map((rec, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[rec.reorder_priority]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Stock Actual</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Días hasta Stockout</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Nivel de Riesgo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recommendations.slice(0, 10).map((rec, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{rec.product_name}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={rec.current_stock === 0 ? 'font-bold text-red-600' : ''}>{rec.current_stock}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold" style={{ color: PRIORITY_COLORS[rec.reorder_priority] }}>
                          {rec.days_until_stockout !== null && rec.days_until_stockout !== undefined ? `${rec.days_until_stockout} días` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span 
                          className="px-2 py-1 text-xs font-semibold rounded-full text-white"
                          style={{ backgroundColor: PRIORITY_COLORS[rec.reorder_priority] }}
                        >
                          {rec.reorder_priority.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderTopProductsTab = () => (
    <div className="forecast-section">
      <div className="section-header">
        <h2>Forecast Top Productos</h2>
        <div className="controls">
          <label>
            Top N:
            <select value={topN} onChange={(e) => { setTopN(Number(e.target.value)); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </label>
          <label>
            Períodos:
            <select value={topPeriods} onChange={(e) => { setTopPeriods(Number(e.target.value)); }}>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>
          <button className="btn-primary" onClick={loadTopForecasts}>Actualizar</button>
        </div>
      </div>

      <div className="grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'16px'}}>
        {topForecasts.map((item) => (
          <div key={item.product_id} className="card">
            <div className="card-header">
              {item.product_name || `Producto #${item.product_id}`}
            </div>
            {item.product_code && (
              <div style={{fontSize:'0.85rem',color:'#666',padding:'0 12px',marginTop:'-8px'}}>
                {item.product_code}
              </div>
            )}
            <div style={{width:'100%', height:220}}>
              <ResponsiveContainer>
                <ComposedChart data={item.forecast}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="ds" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => {
                      if (value >= 1000) {
                        return `${(value / 1000).toFixed(1)}K`;
                      }
                      return value.toFixed(0);
                    }}
                  />
                  <Tooltip 
                    labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')}
                    formatter={(value: number) => {
                      return [`${value.toFixed(2)} unidades`, 'Predicción'];
                    }}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="yhat" stroke="#2563EB" strokeWidth={2} dot={false} name="Predicción" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // const loadSalesForecast30 = async () => {
  //   try {
  //     const data = await forecastingService.getSalesForecast(30);
  //     setSalesForecast30(data);
  //   } catch (error) {
  //     logger.error('Error loading 30-day sales forecast:', error);
  //   }
  // };

  // const renderSales30Tab = () => (
  //   <div className="forecast-section">
  //     <div className="section-header">
  //       <h2>Pronóstico de Ventas a 30 Días</h2>
  //       <div className="controls">
  //         <button className="btn-primary" onClick={loadSalesForecast30}>Actualizar</button>
  //       </div>
  //     </div>

  //     <ResponsiveContainer width="100%" height={400}>
  //       <ComposedChart data={salesForecast30}>
  //         <CartesianGrid strokeDasharray="3 3" />
  //         <XAxis dataKey="ds" tickFormatter={formatDate} />
  //         <YAxis tickFormatter={(v) => formatCurrency(v)} />
  //         <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')} />
  //         <Legend />
  //         <Area type="monotone" dataKey="yhat_upper" fill="#2563eb" fillOpacity={0.1} stroke="none" name="Límite superior" />
  //         <Area type="monotone" dataKey="yhat_lower" fill="#2563eb" fillOpacity={0.1} stroke="none" name="Límite inferior" />
  //         <Line type="monotone" dataKey="yhat" stroke="#2563eb" strokeWidth={2} dot={false} name="Predicción" />
  //       </ComposedChart>
  //     </ResponsiveContainer>
  //   </div>
  // );

  const renderRestockTab = () => {
    const filteredRecs = priorityFilter === 'all'
      ? recommendations
      : recommendations.filter(r => r.reorder_priority === priorityFilter);

    return (
      <div className="restock-section">
        <div className="section-header">
          <h2>Recomendaciones de Reinventario</h2>
          <div className="controls">
            <label>
              Prioridad:
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="critical">Crítico</option>
                <option value="urgent">Urgente</option>
                <option value="high">Alto</option>
                <option value="medium">Medio</option>
                <option value="low">Bajo</option>
              </select>
            </label>
            <button
              className="btn-secondary"
              onClick={handleCreateBulkOrders}
              disabled={loading}
              title="Crear órdenes para críticos y urgentes"
            >
              🛒 Crear Órdenes Urgentes
            </button>
            <button
              className="btn-primary"
              onClick={handleGenerateRecommendations}
              disabled={loading}
            >
              {loading ? 'Generando...' : 'Generar Recomendaciones'}
            </button>
          </div>
        </div>

        {/* Priority distribution chart */}
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={[
              { priority: 'Crítico', count: recommendations.filter(r => r.reorder_priority === 'critical').length },
              { priority: 'Urgente', count: recommendations.filter(r => r.reorder_priority === 'urgent').length },
              { priority: 'Alto', count: recommendations.filter(r => r.reorder_priority === 'high').length },
              { priority: 'Medio', count: recommendations.filter(r => r.reorder_priority === 'medium').length },
              { priority: 'Bajo', count: recommendations.filter(r => r.reorder_priority === 'low').length },
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="priority" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>

        {/* Recommendations table */}
        <div className="recommendations-table">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock Actual</th>
                <th>Punto de Reorden</th>
                <th>Cantidad Recomendada</th>
                <th>Días hasta Stockout</th>
                <th>Riesgo</th>
                <th>Prioridad</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecs.map((rec) => (
                <tr key={rec.id || rec.product_id}>
                  <td>{rec.product_name || `Producto ${rec.product_id}`}</td>
                  <td>{rec.current_stock}</td>
                  <td>{rec.reorder_point.toFixed(0)}</td>
                  <td><strong>{rec.recommended_quantity}</strong></td>
                  <td>{rec.days_until_stockout}</td>
                  <td>
                    <div className="risk-bar">
                      <div
                        className="risk-fill"
                        style={{
                          width: `${rec.stockout_risk ?? 0}%`,
                          backgroundColor: (rec.stockout_risk ?? 0) > 75 ? '#dc2626' : (rec.stockout_risk ?? 0) > 50 ? '#f59e0b' : '#10b981'
                        }}
                      />
                      <span>{(rec.stockout_risk ?? 0).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(rec.reorder_priority) }}
                    >
                      {getPriorityLabel(rec.reorder_priority)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-action"
                      onClick={() => handleCreatePurchaseOrder(rec.id!)}
                      disabled={loading}
                      title="Crear orden de compra"
                    >
                      🛒 Ordenar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // const renderCategoryTab = () => (
  //   <div className="forecast-section">
  //     <div className="section-header">
  //       <h2>Pronóstico por Categoría</h2>
  //       <div className="controls">
  //         <label>
  //           Categoría:
  //           <select value={categoryId} onChange={(e)=> setCategoryId(e.target.value ? Number(e.target.value) : '')}>
  //             <option value="">Selecciona categoría</option>
  //             {categories.map(c => (
  //               <option key={c.id} value={c.id}>{c.name}</option>
  //             ))}
  //           </select>
  //         </label>
  //         <button className="btn-primary" onClick={loadCategoryForecast} disabled={!categoryId || loadingCategory}>
  //           {loadingCategory ? 'Cargando…' : 'Ver Forecast'}
  //         </button>
  //       </div>
  //     </div>
  //     {loadingCategory && (
  //       <div className="skeleton skeleton-rect" />
  //     )}
  //     {Array.isArray(categoryForecast) && categoryForecast.length > 0 && (
  //       <ResponsiveContainer width="100%" height={400}>
  //         <ComposedChart data={categoryForecast}>
  //           <CartesianGrid strokeDasharray="3 3" />
  //           <XAxis dataKey="ds" tickFormatter={formatDate} />
  //           <YAxis tickFormatter={(v) => formatCurrency(v)} />
  //           <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')} />
  //           <Legend />
  //           <Area type="monotone" dataKey="yhat_upper" fill="#0ea5e9" fillOpacity={0.1} stroke="none" />
  //           <Area type="monotone" dataKey="yhat_lower" fill="#0ea5e9" fillOpacity={0.1} stroke="none" />
  //           <Line type="monotone" dataKey="yhat" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Predicción" />
  //         </ComposedChart>
  //       </ResponsiveContainer>
  //     )}
  //     {Array.isArray(categoryForecast) && categoryForecast.length === 0 && !loadingCategory && (
  //       <div className="empty-state">No hay datos suficientes para esta categoría en el período seleccionado.</div>
  //     )}
  //   </div>
  // );

  // const renderWarehouseTab = () => (
  //   <div className="forecast-section">
  //     <div className="section-header">
  //       <h2>Pronóstico por Almacén</h2>
  //       <div className="controls">
  //         <label>
  //           Almacén:
  //           <select value={warehouseId} onChange={(e)=> setWarehouseId(e.target.value ? Number(e.target.value) : '')}>
  //             <option value="">Selecciona almacén</option>
  //             {warehouses.map(w => (
  //               <option key={w.id} value={w.id}>{w.name}</option>
  //             ))}
  //           </select>
  //         </label>
  //         <button className="btn-primary" onClick={loadWarehouseForecast} disabled={!warehouseId || loadingWarehouse}>
  //           {loadingWarehouse ? 'Cargando…' : 'Ver Forecast'}
  //         </button>
  //       </div>
  //     </div>
  //     {loadingWarehouse && (<div className="skeleton skeleton-rect" />)}
  //     {Array.isArray(warehouseForecast) && warehouseForecast.length > 0 && (
  //       <ResponsiveContainer width="100%" height={400}>
  //         <ComposedChart data={warehouseForecast}>
  //           <CartesianGrid strokeDasharray="3 3" />
  //           <XAxis dataKey="ds" tickFormatter={formatDate} />
  //           <YAxis tickFormatter={(v) => formatCurrency(v)} />
  //           <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')} />
  //           <Legend />
  //           <Area type="monotone" dataKey="yhat_upper" fill="#f97316" fillOpacity={0.1} stroke="none" />
  //           <Area type="monotone" dataKey="yhat_lower" fill="#f97316" fillOpacity={0.1} stroke="none" />
  //           <Line type="monotone" dataKey="yhat" stroke="#f97316" strokeWidth={2} dot={false} name="Predicción" />
  //         </ComposedChart>
  //       </ResponsiveContainer>
  //     )}
  //     {Array.isArray(warehouseForecast) && warehouseForecast.length === 0 && !loadingWarehouse && (
  //       <div className="empty-state">No hay datos suficientes para este almacén en el período seleccionado.</div>
  //     )}
  //   </div>
  // );

  const renderComponentsTab = () => {
    return (
      <div className="components-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2>Componentes del Modelo Prophet</h2>
            <p className="section-description">
              Descomposición del pronóstico en sus componentes fundamentales para análisis detallado
            </p>
          </div>
          <button onClick={loadComponents} className="btn-primary">
            Actualizar Componentes
          </button>
        </div>

        {!components ? (
          <div className="empty-state">Cargando componentes...</div>
        ) : (
          <>
            {/* Trend */}
            <div className="component-chart">
              <h3>Tendencia (Trend)</h3>
              <p className="chart-description">
                Patrón de crecimiento o decrecimiento a largo plazo de las ventas
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={components.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="ds" 
                    tickFormatter={(date) => new Date(date).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                  />
              <YAxis 
                tickFormatter={(value) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                  return `$${value}`;
                }}
                tick={{ fontSize: 12 }}
                label={{ value: 'Ventas Tendencia', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                formatter={(value: number) => [formatCurrency(value), 'Tendencia']}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}
              />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5} dot={false} name="Tendencia" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Yearly Seasonality */}
        <div className="component-chart">
          <h3>Estacionalidad Anual (Yearly)</h3>
          <p className="chart-description">
            Variaciones que se repiten cada año (patrones estacionales anuales)
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={components.yearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="ds" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={(value) => {
                  const absValue = Math.abs(value);
                  if (absValue >= 1000000) return `${value < 0 ? '-' : ''}$${(absValue / 1000000).toFixed(1)}M`;
                  if (absValue >= 1000) return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(0)}K`;
                  return `${value < 0 ? '-' : ''}$${absValue}`;
                }}
                tick={{ fontSize: 12 }}
                label={{ value: 'Efecto Anual', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString('es-CL', { month: 'long', day: 'numeric' })}
                formatter={(value: number) => {
                  const effect = value >= 0 ? 'Incremento' : 'Decremento';
                  return [formatCurrency(value), `${effect} Anual`];
                }}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}
              />
              <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2.5} dot={false} name="Estacionalidad Anual" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Seasonality */}
        <div className="component-chart">
          <h3>Estacionalidad Semanal (Weekly)</h3>
          <p className="chart-description">
            Variaciones que se repiten cada semana (patrones día a día)
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={components.weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="ds"
                tickFormatter={(date) => {
                  const d = new Date(date);
                  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
                }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={(value) => {
                  const absValue = Math.abs(value);
                  if (absValue >= 1000000) return `${value < 0 ? '-' : ''}$${(absValue / 1000000).toFixed(1)}M`;
                  if (absValue >= 1000) return `${value < 0 ? '-' : ''}$${(absValue / 1000).toFixed(0)}K`;
                  return `${value < 0 ? '-' : ''}$${absValue}`;
                }}
                tick={{ fontSize: 12 }}
                label={{ value: 'Efecto Semanal', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              <Tooltip 
                labelFormatter={(date) => {
                  const d = new Date(date);
                  return d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                }}
                formatter={(value: number) => {
                  const effect = value >= 0 ? 'Incremento' : 'Decremento';
                  return [formatCurrency(value), `${effect} Semanal`];
                }}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}
              />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} dot={false} name="Estacionalidad Semanal" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Info cards eliminadas según solicitud del usuario */}
          </>
        )}
      </div>
    );
  };

  // const renderAccuracyTab = () => (
  //   <div className="accuracy-section">
  //     <h2>Métricas de Precisión del Forecast</h2>
  //     <div className="accuracy-info">
  //       <div className="metric">
  //         <h3>MAPE (Mean Absolute Percentage Error)</h3>
  //         <div className="metric-value">5.2%</div>
  //         <p>Error porcentual promedio de las predicciones</p>
  //       </div>
  //       <div className="metric">
  //         <h3>MAE (Mean Absolute Error)</h3>
  //         <div className="metric-value">$125,000</div>
  //         <p>Error absoluto promedio en pesos</p>
  //       </div>
  //       <div className="metric">
  //         <h3>Tasa de Confianza</h3>
  //         <div className="metric-value">94.8%</div>
  //         <p>% de predicciones dentro del intervalo de confianza</p>
  //       </div>
  //     </div>
  //     <p className="info-text">
  //       Las métricas se calculan comparando forecasts pasados con valores reales.<br />
  //       Actualización diaria a las 7:00 AM.
  //     </p>
  //   </div>
  // );

  // ================== Main Render ==================

  if (loading && salesForecast.length === 0) {
    return <div className="forecasting-page loading">Cargando dashboard...</div>;
  }

  return (
    <div className="forecasting-page">
      <div className="page-header">
        <h1>Análisis y Predicciones</h1>
        <p>Predicciones de ventas y recomendaciones inteligentes de reinventario</p>
      </div>

      {renderStats()}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveTab('forecast')}
        >
          Forecast de Ventas
        </button>
        <button
          className={`tab ${activeTab === 'top' ? 'active' : ''}`}
          onClick={() => setActiveTab('top')}
        >
          Top Productos
        </button>
        <button
          className={`tab ${activeTab === 'restock' ? 'active' : ''}`}
          onClick={() => setActiveTab('restock')}
        >
          Recomendaciones
        </button>
        <button
          className={`tab ${activeTab === 'components' ? 'active' : ''}`}
          onClick={() => setActiveTab('components')}
        >
          Componentes Prophet
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'forecast' && renderForecastTab()}
        {activeTab === 'top' && renderTopProductsTab()}
        {activeTab === 'restock' && renderRestockTab()}
        {activeTab === 'components' && renderComponentsTab()}
      </div>

      {/* Botón flotante para abrir chatbot */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 flex items-center justify-center z-40 transition-all duration-200 group"
          aria-label="Abrir asistente de forecasting"
          title="Asistente IA de Forecasting"
        >
          <MessageSquare className="w-7 h-7 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse" />
        </button>
      )}

      {/* Panel del chatbot */}
      <ChatbotPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default ForecastingPage;
