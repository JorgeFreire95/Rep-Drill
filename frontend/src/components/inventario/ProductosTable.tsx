import React from 'react';
import { Edit, Trash2, Package, AlertCircle } from 'lucide-react';
import type { Product } from '../../types';
import { Button } from '../common';
import { formatCLP } from '../../utils/currencyUtils';
import { suppliersService, type Supplier } from '../../services/suppliersService';

interface ProductosTableProps {
  productos: Product[];
  isLoading: boolean;
  onEdit: (producto: Product) => void;
  onDelete: (producto: Product) => void;
  lastUpdated?: Date;
}

export const ProductosTable: React.FC<ProductosTableProps> = ({
  productos,
  isLoading,
  onEdit,
  onDelete,
  lastUpdated,
}) => {
  // Cache de proveedores para resolver nombre por ID cuando el backend no incluye supplier_name
  const [suppliersMap, setSuppliersMap] = React.useState<Record<number, string>>({});
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    // Si ya hay al menos un producto con supplier (id numérico) y no tenemos el nombre, cargamos proveedores
    const needsSuppliers = productos.some(p => !!p.supplier && !p.supplier_name);
    if (!needsSuppliers) return;
    (async () => {
      try {
        setLoadingSuppliers(true);
        const data: Supplier[] = await suppliersService.list();
        if (!mounted) return;
        const map: Record<number, string> = {};
        for (const s of data) map[s.id] = s.name;
        setSuppliersMap(map);
      } catch {
        // silencioso: la tabla seguirá mostrando '-'
      } finally {
        if (mounted) setLoadingSuppliers(false);
      }
    })();
    return () => { mounted = false; };
  }, [productos]);
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay productos</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza agregando un producto al inventario.
        </p>
      </div>
    );
  }

  const getStockBadge = (quantity: number, minStock: number) => {
    if (quantity === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Sin Stock
        </span>
      );
    }
    if (quantity <= minStock) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Stock Bajo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Stock OK
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      {lastUpdated && (
        <div className="mb-3 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800 font-medium">
              Inventario actualizado automáticamente
            </span>
          </div>
          <span className="text-xs text-green-600">
            {lastUpdated.toLocaleTimeString('es-CL')}
          </span>
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Producto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              SKU
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Categoría
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Proveedor
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Costo
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stock
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado Stock
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {productos.map((producto) => {
            const profitMargin = producto.cost_price > 0 
              ? (((producto.price - producto.cost_price) / producto.cost_price) * 100).toFixed(1)
              : '0';
            
            return (
              <tr key={producto.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{producto.name}</div>
                      {producto.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {producto.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 font-mono">{producto.sku}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {producto.category_name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {producto.supplier_name 
                      || (typeof producto.supplier === 'number' ? suppliersMap[producto.supplier] : undefined)
                      || (loadingSuppliers ? 'Cargando…' : '-')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm text-gray-700">
                    {formatCLP(producto.cost_price)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCLP(producto.price)}
                  </div>
                  {producto.cost_price > 0 && (
                    <div className="text-xs text-green-600">
                      +{profitMargin}%
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="text-sm text-gray-900">
                    {producto.quantity} {producto.unit_of_measure}
                  </div>
                  <div className="text-xs text-gray-500">
                    Mín: {producto.min_stock} · Reord: {producto.reorder_quantity}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {getStockBadge(producto.quantity, producto.min_stock)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {producto.status === 'ACTIVE' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Activo
                    </span>
                  )}
                  {producto.status === 'INACTIVE' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Inactivo
                    </span>
                  )}
                  {producto.status === 'DISCONTINUED' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Descontinuado
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(producto)}
                      icon={<Edit className="h-4 w-4" />}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(producto)}
                      icon={<Trash2 className="h-4 w-4" />}
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
