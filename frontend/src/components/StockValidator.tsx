import React, { useCallback, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { StockValidationResult, StockValidationItem } from '../types/stock';
import apiClient, { API_URLS } from '../services/api';

interface StockValidatorProps {
  items: Array<{ product_id: number; quantity: number }>;
  onValidationComplete?: (result: StockValidationResult) => void;
}

export const StockValidator: React.FC<StockValidatorProps> = ({ 
  items, 
  onValidationComplete 
}) => {
  const [validation, setValidation] = useState<StockValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateStock = useCallback(async () => {
    if (!items || items.length === 0) {
      setError('No hay artículos para validar');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/validate-stock/`, { items });
      if (response.status !== 200) {
        throw new Error('Error en la validación de stock');
      }

      const result: StockValidationResult = response.data;
      setValidation(result);
      onValidationComplete?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Stock validation error:', err);
    } finally {
      setLoading(false);
    }
  }, [items, onValidationComplete]);

  if (!validation) {
    return (
      <div className="space-y-4">
        <button
          onClick={validateStock}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {loading ? 'Validando stock...' : 'Validar disponibilidad'}
        </button>
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'partial':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'out_of_stock':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'bg-green-50 border-green-200';
      case 'partial':
        return 'bg-yellow-50 border-yellow-200';
      case 'out_of_stock':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'text-green-700';
      case 'partial':
        return 'text-yellow-700';
      case 'out_of_stock':
        return 'text-red-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium">Total Artículos</p>
          <p className="text-2xl font-bold text-blue-900">{validation.summary.total_items}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-xs text-green-600 font-medium">Disponibles</p>
          <p className="text-2xl font-bold text-green-900">{validation.summary.available}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-600 font-medium">Parciales</p>
          <p className="text-2xl font-bold text-yellow-900">{validation.summary.partial}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-600 font-medium">No Disponibles</p>
          <p className="text-2xl font-bold text-red-900">{validation.summary.unavailable}</p>
        </div>
      </div>

      {/* Estado general */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${validation.all_available ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        {validation.all_available ? (
          <>
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-green-900">✓ Todos los artículos están disponibles</p>
              <p className="text-sm text-green-700">Puedes proceder con la compra</p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-900">⚠ Algunos artículos no están completamente disponibles</p>
              <p className="text-sm text-yellow-700">Revisa los detalles a continuación</p>
            </div>
          </>
        )}
      </div>

      {/* Advertencias generales */}
      {validation.warnings.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="font-medium text-orange-900 mb-2">⚠ Advertencias de stock:</p>
          <ul className="space-y-1">
            {validation.warnings.map((warning: string, idx: number) => (
              <li key={idx} className="text-sm text-orange-700">• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Detalles de productos */}
      <div className="space-y-3">
        {validation.items.map((item: StockValidationItem) => (
          <div
            key={item.product_id}
            className={`border rounded-lg p-4 ${getStatusBgColor(item.status)}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(item.status)}
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                </div>
                <p className="text-xs text-gray-600 mb-3">SKU: {item.sku}</p>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <span className="text-gray-600">Solicitado:</span>
                    <p className="font-medium text-gray-900">{item.requested_quantity} unidad(es)</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Disponible:</span>
                    <p className="font-medium text-gray-900">{item.available_quantity} unidad(es)</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Precio CLP:</span>
                    <p className="font-medium text-gray-900">${item.price.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Costo CLP:</span>
                    <p className="font-medium text-gray-900">${item.cost_price.toLocaleString()}</p>
                  </div>
                  {item.profit_margin !== undefined && item.profit_margin > 0 && (
                    <div>
                      <span className="text-gray-600">Margen ganancia:</span>
                      <p className="font-medium text-green-700">{item.profit_margin.toFixed(1)}%</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Stock mínimo:</span>
                    <p className="font-medium text-gray-900">{item.min_stock}</p>
                  </div>
                </div>

                {/* Estado de stock */}
                <div className="flex gap-2 mb-3">
                  {item.is_low_stock && (
                    <span className="inline-block px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded font-medium">
                      ⚠ Bajo stock
                    </span>
                  )}
                  {item.needs_reorder && (
                    <span className="inline-block px-2 py-1 bg-red-200 text-red-800 text-xs rounded font-medium">
                      🔴 Requiere reorden
                    </span>
                  )}
                </div>

                {/* Warnings del producto */}
                {item.warnings.length > 0 && (
                  <div className="text-sm space-y-1">
                    {item.warnings.map((warning: string, idx: number) => (
                      <p key={idx} className={`${getStatusTextColor(item.status)}`}>
                        • {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Badge de estado */}
              <div className="text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  item.status === 'in_stock'
                    ? 'bg-green-200 text-green-800'
                    : item.status === 'partial'
                    ? 'bg-yellow-200 text-yellow-800'
                    : item.status === 'out_of_stock'
                    ? 'bg-red-200 text-red-800'
                    : 'bg-gray-200 text-gray-800'
                }`}>
                  {item.status === 'in_stock'
                    ? '✓ En stock'
                    : item.status === 'partial'
                    ? '⚠ Parcial'
                    : item.status === 'out_of_stock'
                    ? '✗ Agotado'
                    : '? Desconocido'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button
          onClick={validateStock}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
        >
          {loading ? 'Revalidando...' : 'Revalidar stock'}
        </button>
        {validation.all_available && (
          <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
            ✓ Proceder a compra
          </button>
        )}
      </div>
    </div>
  );
};

export default StockValidator;
