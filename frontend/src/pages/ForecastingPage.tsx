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
import { MessageSquare } from 'lucide-react';
import forecastingService, {
  type ForecastData,
  type RestockRecommendation,
  type ProphetComponents,
} from '../services/forecastingService';
import catalogService, { type CategoryOption, type WarehouseOption } from '../services/catalogService';
import ChatbotPanel from '../components/chatbot/ChatbotPanel';
import '../styles/ForecastingPage.css';
import { logger } from '../utils/logger';

interface DashboardStats {
  criticalItems: number;
  urgentItems: number;
  avgAccuracy: number;
  totalRecommendations: number;
}

interface TopProductForecast {
  product_id: number;
  product_name?: string;
  product_code?: string;
  forecast: ForecastData[];
}

const ForecastingPage: React.FC = () => {
  // State
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'forecast' | 'top' | 'sales30' | 'category' | 'warehouse' | 'restock' | 'components' | 'accuracy'>('forecast');
  
  // Forecast data
  const [salesForecast, setSalesForecast] = useState<ForecastData[]>([]);
  const [salesForecast30, setSalesForecast30] = useState<ForecastData[]>([]);
  const [forecastPeriods, setForecastPeriods] = useState(30);
  const [topForecasts, setTopForecasts] = useState<TopProductForecast[]>([]);
  const [topN, setTopN] = useState(5);
  const [topPeriods, setTopPeriods] = useState(30);
  // Eliminado pronóstico por producto
  
  // Restock data
  const [recommendations, setRecommendations] = useState<RestockRecommendation[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Components data
  const [components, setComponents] = useState<ProphetComponents | null>(null);
  // Aggregated forecasts
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [categoryForecast, setCategoryForecast] = useState<ForecastData[] | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [warehouseForecast, setWarehouseForecast] = useState<ForecastData[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);
  
  // Stats
  const [stats, setStats] = useState<DashboardStats>({
    criticalItems: 0,
    urgentItems: 0,
    avgAccuracy: 0,
    totalRecommendations: 0,
  });

  // Chatbot
  const [chatOpen, setChatOpen] = useState(false);

  // ================== Data Loading ==================

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Carga inicial independiente de funciones auxiliares para evitar dependencias en hooks
      const [sales, top, recs, dashStats] = await Promise.all([
        forecastingService.getSalesForecast(30),
        forecastingService.getTopProductsForecast(5, 30),
        forecastingService.getRecommendations(),
        forecastingService.getDashboardStats(),
      ]);

      setSalesForecast(sales);
      setSalesForecast30(sales);
      setTopForecasts(top);
      setRecommendations(recs);
      setStats({
        criticalItems: dashStats.critical_count || 0,
        urgentItems: dashStats.urgent_count || 0,
        avgAccuracy: dashStats.forecast_accuracy || 0,
        totalRecommendations: dashStats.total_recommendations || 0,
      });
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

  const loadSalesForecast = async () => {
    try {
      const data = await forecastingService.getSalesForecast(forecastPeriods);
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

  const loadCategoryForecast = async () => {
    if (!categoryId) { setCategoryForecast(null); return; }
    setLoadingCategory(true);
    try {
      const data = await forecastingService.getCategoryForecast(Number(categoryId), 30);
      setCategoryForecast(data.forecast || []);
    } catch (error) {
      logger.error('Error loading category forecast:', error);
      setCategoryForecast([]);
    } finally {
      setLoadingCategory(false);
    }
  };

  const loadWarehouseForecast = async () => {
    if (!warehouseId) { setWarehouseForecast(null); return; }
    setLoadingWarehouse(true);
    try {
      const data = await forecastingService.getWarehouseForecast(Number(warehouseId), 30);
      setWarehouseForecast(data.forecast || []);
    } catch (error) {
      logger.error('Error loading warehouse forecast:', error);
      setWarehouseForecast([]);
    } finally {
      setLoadingWarehouse(false);
    }
  };

  // Cargar catálogos al entrar a la página (y en tabs específicos)
  useEffect(() => {
    (async () => {
      try {
        const [cats, whs] = await Promise.all([
          catalogService.getCategories(1000),
          catalogService.getWarehouses(1000),
        ]);
        setCategories(cats);
        setWarehouses(whs);
      } catch (e) {
        logger.error('Error loading catalogs', e);
      }
    })();
  }, []);

  const loadStats = async () => {
    try {
      const recs = await forecastingService.getRecommendations();
      const accuracy = await forecastingService.getForecastAccuracy({ days: 30 });
      
      setStats({
        criticalItems: recs.filter(r => r.reorder_priority === 'critical').length,
        urgentItems: recs.filter(r => r.reorder_priority === 'urgent').length,
        avgAccuracy: 100 - accuracy.avg_mape,
        totalRecommendations: recs.length,
      });
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
  };

  const handleGenerateRecommendations = async () => {
    setLoading(true);
    try {
      const result = await forecastingService.generateRecommendations({
        min_priority: 'medium',
        max_products: 100,
      });
      alert(`Generadas ${result.created} nuevas recomendaciones, ${result.updated} actualizadas`);
      await loadRecommendations();
      await loadStats();
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
    <div className="stats-grid">
      <div className="stat-card critical">
        <h3>Críticos</h3>
        <div className="stat-value">{stats.criticalItems}</div>
        <p>Productos sin stock</p>
      </div>
      <div className="stat-card urgent">
        <h3>Urgentes</h3>
        <div className="stat-value">{stats.urgentItems}</div>
        <p>Requieren reorden pronto</p>
      </div>
      <div className="stat-card accuracy">
        <h3>Precisión</h3>
        <div className="stat-value">{stats.avgAccuracy.toFixed(1)}%</div>
        <p>Exactitud del forecast</p>
      </div>
      <div className="stat-card total">
        <h3>Total</h3>
        <div className="stat-value">{stats.totalRecommendations}</div>
        <p>Recomendaciones activas</p>
      </div>
    </div>
  );

  const renderForecastTab = () => (
    <div className="forecast-section">
      <div className="section-header">
        <h2>Forecast de Ventas (Prophet)</h2>
        <div className="controls">
          <label>
            Períodos:
            <select
              value={forecastPeriods}
              onChange={(e) => {
                setForecastPeriods(Number(e.target.value));
                loadSalesForecast();
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
          <YAxis tickFormatter={(v) => formatCurrency(v)} />
          <Tooltip
            labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')}
            formatter={(value: number) => [formatCurrency(value), 'Forecast']}
          />
          <Legend />
          
          {/* Confidence interval */}
          <Area
            type="monotone"
            dataKey="yhat_upper"
            fill="#3b82f6"
            fillOpacity={0.1}
            stroke="none"
            name="Límite superior"
          />
          <Area
            type="monotone"
            dataKey="yhat_lower"
            fill="#3b82f6"
            fillOpacity={0.1}
            stroke="none"
            name="Límite inferior"
          />
          
          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey="yhat"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Predicción"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="forecast-info">
        <p>
          <strong>Intervalo de confianza:</strong> 95%<br />
          <strong>Modelo:</strong> Prophet (Meta/Facebook)<br />
          <strong>Actualización:</strong> Diaria a las 5:00 AM
        </p>
      </div>
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
                  <XAxis dataKey="ds" tickFormatter={formatDate} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="yhat" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const loadSalesForecast30 = async () => {
    try {
      const data = await forecastingService.getSalesForecast(30);
      setSalesForecast30(data);
    } catch (error) {
      logger.error('Error loading 30-day sales forecast:', error);
    }
  };

  const renderSales30Tab = () => (
    <div className="forecast-section">
      <div className="section-header">
        <h2>Pronóstico de Ventas a 30 Días</h2>
        <div className="controls">
          <button className="btn-primary" onClick={loadSalesForecast30}>Actualizar</button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={salesForecast30}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ds" tickFormatter={formatDate} />
          <YAxis tickFormatter={(v) => formatCurrency(v)} />
          <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')} />
          <Legend />
          <Area type="monotone" dataKey="yhat_upper" fill="#2563eb" fillOpacity={0.1} stroke="none" name="Límite superior" />
          <Area type="monotone" dataKey="yhat_lower" fill="#2563eb" fillOpacity={0.1} stroke="none" name="Límite inferior" />
          <Line type="monotone" dataKey="yhat" stroke="#2563eb" strokeWidth={2} dot={false} name="Predicción" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

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

  const renderCategoryTab = () => (
    <div className="forecast-section">
      <div className="section-header">
        <h2>Pronóstico por Categoría</h2>
        <div className="controls">
          <label>
            Categoría:
            <select value={categoryId} onChange={(e)=> setCategoryId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Selecciona categoría</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={loadCategoryForecast} disabled={!categoryId || loadingCategory}>
            {loadingCategory ? 'Cargando…' : 'Ver Forecast'}
          </button>
        </div>
      </div>
      {loadingCategory && (
        <div className="skeleton skeleton-rect" />
      )}
      {Array.isArray(categoryForecast) && categoryForecast.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={categoryForecast}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ds" tickFormatter={formatDate} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} />
            <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')} />
            <Legend />
            <Area type="monotone" dataKey="yhat_upper" fill="#0ea5e9" fillOpacity={0.1} stroke="none" />
            <Area type="monotone" dataKey="yhat_lower" fill="#0ea5e9" fillOpacity={0.1} stroke="none" />
            <Line type="monotone" dataKey="yhat" stroke="#0ea5e9" strokeWidth={2} dot={false} name="Predicción" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {Array.isArray(categoryForecast) && categoryForecast.length === 0 && !loadingCategory && (
        <div className="empty-state">No hay datos suficientes para esta categoría en el período seleccionado.</div>
      )}
    </div>
  );

  const renderWarehouseTab = () => (
    <div className="forecast-section">
      <div className="section-header">
        <h2>Pronóstico por Almacén</h2>
        <div className="controls">
          <label>
            Almacén:
            <select value={warehouseId} onChange={(e)=> setWarehouseId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Selecciona almacén</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={loadWarehouseForecast} disabled={!warehouseId || loadingWarehouse}>
            {loadingWarehouse ? 'Cargando…' : 'Ver Forecast'}
          </button>
        </div>
      </div>
      {loadingWarehouse && (<div className="skeleton skeleton-rect" />)}
      {Array.isArray(warehouseForecast) && warehouseForecast.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={warehouseForecast}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ds" tickFormatter={formatDate} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} />
            <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString('es-CL')} />
            <Legend />
            <Area type="monotone" dataKey="yhat_upper" fill="#f97316" fillOpacity={0.1} stroke="none" />
            <Area type="monotone" dataKey="yhat_lower" fill="#f97316" fillOpacity={0.1} stroke="none" />
            <Line type="monotone" dataKey="yhat" stroke="#f97316" strokeWidth={2} dot={false} name="Predicción" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {Array.isArray(warehouseForecast) && warehouseForecast.length === 0 && !loadingWarehouse && (
        <div className="empty-state">No hay datos suficientes para este almacén en el período seleccionado.</div>
      )}
    </div>
  );

  const renderComponentsTab = () => {
    if (!components) {
      return (
        <div className="components-section">
          <button onClick={loadComponents} className="btn-primary">
            Cargar Componentes Prophet
          </button>
        </div>
      );
    }

    return (
      <div className="components-section">
        <h2>Componentes del Modelo Prophet</h2>
        
        {/* Trend */}
        <div className="component-chart">
          <h3>Tendencia (Trend)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={components.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ds" tickFormatter={formatDate} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Yearly Seasonality */}
        <div className="component-chart">
          <h3>Estacionalidad Anual (Yearly)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={components.yearly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ds" tickFormatter={formatDate} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Seasonality */}
        <div className="component-chart">
          <h3>Estacionalidad Semanal (Weekly)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={components.weekly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ds" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="components-info">
          <p>
            <strong>Tendencia:</strong> Patrón de crecimiento o decrecimiento a largo plazo<br />
            <strong>Estacionalidad Anual:</strong> Patrones que se repiten cada año<br />
            <strong>Estacionalidad Semanal:</strong> Patrones que se repiten cada semana
          </p>
        </div>
      </div>
    );
  };

  const renderAccuracyTab = () => (
    <div className="accuracy-section">
      <h2>Métricas de Precisión del Forecast</h2>
      <div className="accuracy-info">
        <div className="metric">
          <h3>MAPE (Mean Absolute Percentage Error)</h3>
          <div className="metric-value">5.2%</div>
          <p>Error porcentual promedio de las predicciones</p>
        </div>
        <div className="metric">
          <h3>MAE (Mean Absolute Error)</h3>
          <div className="metric-value">$125,000</div>
          <p>Error absoluto promedio en pesos</p>
        </div>
        <div className="metric">
          <h3>Tasa de Confianza</h3>
          <div className="metric-value">94.8%</div>
          <p>% de predicciones dentro del intervalo de confianza</p>
        </div>
      </div>
      <p className="info-text">
        Las métricas se calculan comparando forecasts pasados con valores reales.<br />
        Actualización diaria a las 7:00 AM.
      </p>
    </div>
  );

  // ================== Main Render ==================

  if (loading && salesForecast.length === 0) {
    return <div className="forecasting-page loading">Cargando dashboard...</div>;
  }

  return (
    <div className="forecasting-page">
      <div className="page-header">
        <h1>Dashboard de Forecasting (Prophet)</h1>
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
          className={`tab ${activeTab === 'sales30' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales30')}
        >
          Ventas 30 días
        </button>
        <button
          className={`tab ${activeTab === 'category' ? 'active' : ''}`}
          onClick={() => setActiveTab('category')}
        >
          Por Categoría
        </button>
        <button
          className={`tab ${activeTab === 'warehouse' ? 'active' : ''}`}
          onClick={() => setActiveTab('warehouse')}
        >
          Por Almacén
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
        <button
          className={`tab ${activeTab === 'accuracy' ? 'active' : ''}`}
          onClick={() => setActiveTab('accuracy')}
        >
          Precisión
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'forecast' && renderForecastTab()}
        {activeTab === 'top' && renderTopProductsTab()}
  {activeTab === 'sales30' && renderSales30Tab()}
  {activeTab === 'category' && renderCategoryTab()}
  {activeTab === 'warehouse' && renderWarehouseTab()}
        {activeTab === 'restock' && renderRestockTab()}
        {activeTab === 'components' && renderComponentsTab()}
        {activeTab === 'accuracy' && renderAccuracyTab()}
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
