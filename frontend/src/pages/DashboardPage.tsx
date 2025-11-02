import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Package, TrendingUp, ShoppingCart } from 'lucide-react';
import { inventarioService } from '../services/inventarioService';
import { dashboardService, type DashboardSummary, type SalesTrendData, type TopProduct, type StockProduct } from '../services/dashboardService';
import type { ProductWithAlert } from '../types';
import apiClient, { API_URLS } from '../services/api';
import { Modal } from '../components/common';
import { useToast } from '../hooks/useToast';
import { MetricCard, TrendChart, TopProductsTable, CriticalStockAlert } from '../components/dashboard';
import { logger } from '../utils/logger';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  lowStockProducts: number;
  totalCustomers: number;
  totalProducts: number;
  totalRevenue: number;
  criticalStock: ProductWithAlert[];
}

export const DashboardPage: React.FC = () => {
  interface OrderDTO { id: number; customer_name?: string; customer_id?: number; total: number | string; status: string; order_date: string; }
  interface CustomerDTO { id: number; }
  interface ProductDTO { quantity?: number; min_stock?: number; }
  
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalRevenue: 0,
    criticalStock: [],
  });

  // Analytics data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesTrend, setSalesTrend] = useState<SalesTrendData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [criticalStock, setCriticalStock] = useState<{ critical: StockProduct[]; warning: StockProduct[]; medium: StockProduct[]; critical_count: number; warning_count: number; medium_count: number; }>({
    critical: [],
    warning: [],
    medium: [],
    critical_count: 0,
    warning_count: 0,
    medium_count: 0,
  });

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const { success, error } = useToast();

  // Reorden modal state
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderProduct, setReorderProduct] = useState<StockProduct | null>(null);
  const [reorderQty, setReorderQty] = useState<number>(0);
  const [reorderNotes, setReorderNotes] = useState<string>("");
  const [reorderSubmitting, setReorderSubmitting] = useState(false);

  const handleReorder = (product: StockProduct) => {
    setReorderProduct(product);
    const suggestedQty = Math.max(product.min_stock - product.quantity, 1);
    setReorderQty(suggestedQty);
    setReorderNotes("");
    setReorderOpen(true);
  };

  const loadBasicStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Cargar órdenes (solo para métricas, sin tabla)
      const ordersRes = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/`);
      if (ordersRes.status === 200) {
        const orders = ordersRes.data as OrderDTO[];
        const pendingCount = orders.filter((o: OrderDTO) => o.status === 'pending').length;
        const totalRevenue = orders.reduce((sum: number, o: OrderDTO) => sum + Number(o.total), 0);

        setStats(prev => ({
          ...prev,
          totalOrders: orders.length,
          pendingOrders: pendingCount,
          totalRevenue,
        }));
      }

      // Cargar clientes
      const customersRes = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/`, { params: { limit: 1000 } });
      if (customersRes.status === 200) {
        const customers = customersRes.data as CustomerDTO[] | { results?: CustomerDTO[] };
        const customerList = Array.isArray(customers) ? customers : customers.results || [];
        setStats(prev => ({
          ...prev,
          totalCustomers: customerList.length
        }));
      }

      // Cargar productos
      const productsRes = await apiClient.get(`${API_URLS.INVENTARIO}/api/products/`);
      if (productsRes.status === 200) {
        const products = productsRes.data as ProductDTO[] | { results?: ProductDTO[] };
        const productList: ProductDTO[] = Array.isArray(products) ? products : products.results || [];
        const lowStock = productList.filter((p: ProductDTO) => (p.quantity || 0) <= (p.min_stock || 5)).length;

        setStats(prev => ({
          ...prev,
          totalProducts: productList.length,
          lowStockProducts: lowStock
        }));
      }

      // Cargar productos con stock crítico (old format for modal)
      try {
        const lowStockData = await inventarioService.getLowStockProducts();
        setStats(prev => ({
          ...prev,
          criticalStock: lowStockData.results.slice(0, 5),
          lowStockProducts: lowStockData.count
        }));
      } catch (error) {
        logger.error('Error cargando productos con stock bajo:', error);
      }
    } catch (error) {
      logger.error('Error cargando datos del dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      
      // Cargar datos en paralelo
      const [summaryData, trendData, productsData, stockData] = await Promise.all([
        dashboardService.getSummary(30).catch(() => null),
        dashboardService.getSalesTrend(30).catch(() => ({ trend: [] })),
        dashboardService.getTopProducts(10, 30).catch(() => ({ products: [] })),
        dashboardService.getCriticalStock().catch(() => ({ critical: [], warning: [], medium: [], critical_count: 0, warning_count: 0, medium_count: 0 })),
      ]);

      if (summaryData) setSummary(summaryData);
      if (trendData) setSalesTrend(trendData.trend);
      if (productsData) setTopProducts(productsData.products);
      if (stockData) setCriticalStock(stockData);
    } catch (error) {
      logger.error('Error cargando analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBasicStats();
    loadAnalyticsData();
    
    // Auto-refresh cada 60 segundos
    const interval = setInterval(() => {
      loadAnalyticsData();
    }, 60000);

    // Escuchar eventos de cambios en alertas de stock
    const handler = () => {
      loadBasicStats();
      loadAnalyticsData();
    };
    window.addEventListener('low-stock-alert', handler as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('low-stock-alert', handler as EventListener);
    };
  }, [loadBasicStats, loadAnalyticsData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading && analyticsLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Cargando dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Vista general del negocio</p>
        </div>

        {/* Métricas principales con Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Ventas Totales"
            value={summary ? formatCurrency(summary.total_sales) : formatCurrency(stats.totalRevenue)}
            change={summary?.sales_change_percent}
            icon={DollarSign}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
          />
          <MetricCard
            title="Órdenes"
            value={summary ? summary.total_orders : stats.totalOrders}
            change={summary?.orders_change_percent}
            icon={ShoppingCart}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
            subtitle={`${stats.pendingOrders} pendientes`}
          />
          <MetricCard
            title="Productos"
            value={summary ? summary.products_sold : stats.totalProducts}
            icon={Package}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
            subtitle={`${stats.lowStockProducts} con stock bajo`}
          />
          <MetricCard
            title="Ventas Promedio"
            value={summary ? formatCurrency(summary.average_order_value) : formatCurrency(stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0)}
            icon={TrendingUp}
            iconColor="text-orange-600"
            iconBgColor="bg-orange-100"
            tooltip="Promedio de ventas por orden (ingresos totales / número de órdenes)"
          />
        </div>

        {/* Gráfico de tendencias */}
        {salesTrend.length > 0 && (
          <TrendChart 
            data={salesTrend} 
            title={`Tendencia de Ventas - Últimos ${summary?.period_days || 30} días`}
          />
        )}

        {/* Grid de 2 columnas: Top productos y Stock crítico */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopProductsTable products={topProducts} />
          <CriticalStockAlert
            critical={criticalStock.critical}
            warning={criticalStock.warning}
            medium={criticalStock.medium}
            criticalCount={criticalStock.critical_count}
            warningCount={criticalStock.warning_count}
            mediumCount={criticalStock.medium_count}
            onReorder={handleReorder}
          />
        </div>
      </div>

      {/* Modal de reorden */}
      <Modal
        isOpen={reorderOpen}
        onClose={() => setReorderOpen(false)}
        title="Crear solicitud de reorden"
      >
        {reorderProduct && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Producto</p>
              <p className="font-medium text-gray-900">{reorderProduct.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock actual / Mínimo</p>
              <p className="font-medium text-gray-900">{reorderProduct.quantity} / {reorderProduct.min_stock}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a reordenar *</label>
              <input
                type="number"
                min="1"
                className="w-full border rounded px-3 py-2"
                value={reorderQty}
                onChange={(e) => setReorderQty(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea
                className="w-full border rounded px-3 py-2"
                rows={3}
                value={reorderNotes}
                onChange={(e) => setReorderNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
                onClick={() => setReorderOpen(false)}
                disabled={reorderSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm text-white rounded ${reorderSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!reorderProduct) return;
                  try {
                    setReorderSubmitting(true);
                    await inventarioService.createReorder(reorderProduct.id, reorderQty, reorderNotes);
                    success('Solicitud de reorden creada');
                    setReorderOpen(false);
                    window.dispatchEvent(new CustomEvent('low-stock-alert', { detail: { manual: true } }));
                  } catch {
                    error('No se pudo crear la solicitud');
                  } finally {
                    setReorderSubmitting(false);
                  }
                }}
                disabled={reorderSubmitting || reorderQty < 1}
              >
                {reorderSubmitting ? 'Creando…' : 'Confirmar reorden'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default DashboardPage;
