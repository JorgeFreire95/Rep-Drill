import React from 'react';
import { AlertTriangle, AlertCircle, Package, Info, RefreshCw } from 'lucide-react';

interface StockProduct {
  id: number;
  name: string;
  sku?: string;
  quantity: number;
  min_stock: number;
  alert_level: string;
  alert_message: string;
}

interface CriticalStockAlertProps {
  critical: StockProduct[];
  warning: StockProduct[];
  medium: StockProduct[];
  criticalCount: number;
  warningCount: number;
  mediumCount: number;
  onReorder?: (product: StockProduct) => void;
}

export const CriticalStockAlert: React.FC<CriticalStockAlertProps> = ({
  critical,
  warning,
  medium,
  criticalCount,
  warningCount,
  mediumCount,
  onReorder,
}) => {
  const allAlerts = [...critical, ...warning, ...medium];
  const hasAlerts = allAlerts.length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Stock Crítico
        </h2>
        <div className="flex gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
              {criticalCount} Críticos
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
              {warningCount} Altos
            </span>
          )}
          {mediumCount > 0 && (
            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              {mediumCount} Medios
            </span>
          )}
        </div>
      </div>

      {!hasAlerts ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-gray-600 font-medium">Todo el inventario está en niveles óptimos</p>
          <p className="text-sm text-gray-500">No hay productos con stock crítico</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {allAlerts.map((product) => {
            const isCritical = product.alert_level === 'CRITICAL';
            const isHigh = product.alert_level === 'HIGH';
            const isMedium = product.alert_level === 'MEDIUM';
            
            return (
              <div
                key={product.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  isCritical
                    ? 'bg-red-50 border-red-200'
                    : isHigh
                    ? 'bg-yellow-50 border-yellow-200'
                    : isMedium
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isCritical ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : isHigh ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      {product.sku && (
                        <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${
                        isCritical ? 'text-red-700' : isHigh ? 'text-yellow-700' : 'text-blue-700'
                      }`}>
                        {product.quantity} / {product.min_stock}
                      </p>
                      <p className="text-xs text-gray-500">actual / mínimo</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {product.alert_message}
                  </p>
                  
                  {onReorder && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => onReorder(product)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reordenar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {hasAlerts && (criticalCount > 10 || warningCount > 10 || mediumCount > 10) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Mostrando los primeros 10 de cada categoría
          </p>
        </div>
      )}
    </div>
  );
};
