import React from 'react';
import { Edit, Trash2, ShoppingCart, Package, CheckCircle, XCircle } from 'lucide-react';
import type { Order } from '../../types';
import { Button } from '../common';

interface OrdersTableProps {
  orders: Order[];
  loading?: boolean;
  onEdit: (order: Order) => void;
  onDelete: (id: number) => void;
  onCancel: (id: number) => void;
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Package },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  PROCESSING: { label: 'En Proceso', color: 'bg-purple-100 text-purple-800', icon: Package },
  SHIPPED: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-800', icon: Package },
  DELIVERED: { label: 'Entregada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  COMPLETED: { label: 'Completada', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  loading,
  onEdit,
  onDelete,
  onCancel,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay órdenes</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza creando una nueva orden de venta.
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Orden #
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cliente
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total
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
          {orders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = statusConfig.icon;

            return (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {order.customer_name || `Cliente #${order.customer_id}`}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatDate(order.order_date)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-gray-900">
                    $ {Number(order.total).toLocaleString('es-CL')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig.label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(order)}
                      icon={<Edit className="h-4 w-4" />}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(order.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && order.status !== 'COMPLETED' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onCancel(order.id)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        Cancelar
                      </Button>
                    )}
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
