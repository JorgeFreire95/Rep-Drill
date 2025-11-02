import React from 'react';
import {
  formatDate,
  formatDateLong,
  formatDateTime,
  getTimeAgo,
  getDayName,
  isToday,
  isYesterday,
} from '../../utils/dateUtils';

interface DateExampleProps {
  date?: string;
  includeTime?: boolean;
}

/**
 * Componente de ejemplo para mostrar diferentes formatos de fecha
 * Demuestra el uso de las utilidades de fecha con zona horaria local
 */
export const DateFormatExample: React.FC<DateExampleProps> = ({
  date = new Date().toISOString().split('T')[0],
  includeTime = false,
}) => {
  if (!date) {
    return <div className="text-gray-500">No hay fecha disponible</div>;
  }

  return (
    <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
      <div>
        <span className="font-semibold">Formato corto:</span>
        <span className="ml-2">{formatDate(date, includeTime)}</span>
      </div>

      <div>
        <span className="font-semibold">Formato largo:</span>
        <span className="ml-2">{formatDateLong(date)}</span>
      </div>

      {includeTime && (
        <div>
          <span className="font-semibold">Fecha y hora:</span>
          <span className="ml-2">{formatDateTime(date)}</span>
        </div>
      )}

      <div>
        <span className="font-semibold">Día de la semana:</span>
        <span className="ml-2 capitalize">{getDayName(date)}</span>
      </div>

      {includeTime && (
        <div>
          <span className="font-semibold">Tiempo relativo:</span>
          <span className="ml-2">{getTimeAgo(date)}</span>
        </div>
      )}

      <div className="text-sm text-gray-600 space-x-2">
        {isToday(date) && <span className="bg-blue-100 px-2 py-1 rounded">Hoy</span>}
        {isYesterday(date) && <span className="bg-yellow-100 px-2 py-1 rounded">Ayer</span>}
      </div>
    </div>
  );
};

/**
 * Componente para mostrar una lista de órdenes con fechas formateadas
 */
interface OrderItemProps {
  id: number;
  orderDate: string;
  createdAt: string;
  customerName: string;
  total: number;
}

export const OrderListWithDates: React.FC<{ orders: OrderItemProps[] }> = ({ orders = [] }) => {
  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <div className="text-gray-500">No hay órdenes</div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold">Orden #{order.id}</h3>
                <p className="text-sm text-gray-600">{order.customerName}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">${order.total.toLocaleString('es-CL')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Fecha de orden:</span>
                <p>{formatDate(order.orderDate)}</p>
              </div>

              <div>
                <span className="font-medium">Creada:</span>
                <p>{formatDate(order.createdAt, true)}</p>
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500">
              {isToday(order.orderDate) && <span>📅 Orden de hoy</span>}
              {isYesterday(order.orderDate) && <span>📅 Orden de ayer</span>}
              {!isToday(order.orderDate) && !isYesterday(order.orderDate) && (
                <span>{getTimeAgo(order.createdAt)}</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
