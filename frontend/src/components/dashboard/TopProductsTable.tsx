import React from 'react';
import { TrendingUp, Package } from 'lucide-react';

interface TopProduct {
  product_id: number;
  product_name: string;
  product_sku: string;
  total_revenue: number;
  total_quantity_sold: number;
  total_orders: number;
}

interface TopProductsTableProps {
  products: TopProduct[];
  title?: string;
}

export const TopProductsTable: React.FC<TopProductsTableProps> = ({ 
  products, 
  title = 'Top Productos Más Vendidos' 
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          {title}
        </h2>
        <p className="text-gray-500 text-center py-8">No hay datos de productos disponibles</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Revenue</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Unidades</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Órdenes</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={product.product_id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    {index + 1}
                    {index === 0 && <span className="text-yellow-500">🥇</span>}
                    {index === 1 && <span className="text-gray-400">🥈</span>}
                    {index === 2 && <span className="text-orange-600">🥉</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{product.product_name}</div>
                      {product.product_sku && (
                        <div className="text-xs text-gray-500">SKU: {product.product_sku}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-600">
                  {formatCurrency(product.total_revenue)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {product.total_quantity_sold.toLocaleString('es-CL')}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {product.total_orders}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
