import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Search, Package } from 'lucide-react';
import { inventarioService } from '../services/inventarioService';
import type { ProductWithAlert } from '../types';
import { useToast } from '../hooks/useToast';

export const StockAlertsPage: React.FC = () => {
  const [products, setProducts] = useState<ProductWithAlert[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductWithAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const toast = useToast();

  useEffect(() => {
    loadLowStockProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, alertFilter]);

  const loadLowStockProducts = async () => {
    try {
      setLoading(true);
      const response = await inventarioService.getLowStockProducts();
      setProducts(response.results);
    } catch (error) {
      console.error('Error cargando productos con stock bajo:', error);
      toast.error('Error al cargar productos con stock bajo');
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Filtro por nivel de alerta
    if (alertFilter !== 'all') {
      filtered = filtered.filter(p => p.alert_level === alertFilter);
    }

    // Filtro por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.category_name?.toLowerCase().includes(term)
      );
    }

    setFilteredProducts(filtered);
  };

  // Refresco en vivo cuando cambian las alertas globales
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = () => loadLowStockProducts();
    window.addEventListener('low-stock-alert', handler as EventListener);
    return () => window.removeEventListener('low-stock-alert', handler as EventListener);
  }, []);

  const getAlertBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getAlertBorder = (level: string) => {
    switch (level) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'high':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-l-4 border-yellow-500 bg-yellow-50';
      default:
        return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                <AlertTriangle className="w-10 h-10 text-red-600" />
                Alertas de Stock Crítico
              </h1>
              <p className="text-gray-600 mt-2">
                Productos con stock por debajo del mínimo configurado
              </p>
            </div>
            <button
              onClick={loadLowStockProducts}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, SKU o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filtro por nivel de alerta */}
            <div>
              <select
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos los niveles</option>
                <option value="critical">🔴 Crítico (0% stock)</option>
                <option value="high">🟠 Alto (&lt;50% stock)</option>
                <option value="medium">🟡 Medio (≥50% stock)</option>
              </select>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Alertas</p>
              <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">🔴 Crítico</p>
              <p className="text-2xl font-bold text-red-600">
                {products.filter(p => p.alert_level === 'critical').length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">🟠 Alto</p>
              <p className="text-2xl font-bold text-orange-600">
                {products.filter(p => p.alert_level === 'high').length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">🟡 Medio</p>
              <p className="text-2xl font-bold text-yellow-600">
                {products.filter(p => p.alert_level === 'medium').length}
              </p>
            </div>
          </div>
        </div>

        {/* Lista de productos */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No se encontraron productos
            </h3>
            <p className="text-gray-500">
              {products.length === 0
                ? '¡Excelente! Todos los productos tienen stock suficiente.'
                : 'Prueba ajustar los filtros de búsqueda.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`bg-white rounded-lg shadow-lg overflow-hidden ${getAlertBorder(product.alert_level)}`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    {/* Información del producto */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${getAlertBadge(product.alert_level)}`}>
                          {product.alert_level.toUpperCase()}
                        </span>
                        {product.needs_reorder && (
                          <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-800 font-medium">
                            REORDENAR
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">SKU: {product.sku}</p>
                      {product.category_name && (
                        <p className="text-sm text-gray-600">
                          Categoría: <span className="font-medium">{product.category_name}</span>
                        </p>
                      )}
                    </div>

                    {/* Métricas de stock */}
                    <div className="text-right">
                      <div className="mb-4">
                        <p className="text-sm text-gray-600">Stock Actual</p>
                        <p className="text-4xl font-bold text-gray-900">{product.quantity}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Mínimo: {product.min_stock}
                        </p>
                        {product.recommended_reorder && (
                          <p className="text-xs text-gray-500">
                            Reorden: {product.recommended_reorder} uds.
                          </p>
                        )}
                      </div>

                      {/* Barra de progreso */}
                      <div className="w-48">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Stock</span>
                          <span>{product.stock_percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              product.stock_percentage <= 0 ? 'bg-red-600' :
                              product.stock_percentage <= 50 ? 'bg-orange-600' :
                              'bg-yellow-600'
                            }`}
                            style={{ width: `${Math.max(5, product.stock_percentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Precio (si está disponible) */}
                  {product.price && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        Precio: <span className="font-bold text-gray-900">${product.price.toLocaleString()}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAlertsPage;
