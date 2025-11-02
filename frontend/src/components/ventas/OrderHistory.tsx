import React, { useEffect, useState } from 'react';
import { ventasService } from '../../services/ventasService';
import type { Order } from '../../types';
import { Calendar, Package, DollarSign, AlertCircle, Loader } from 'lucide-react';
import './OrderHistory.css';

interface OrderHistoryProps {
  customerId: number | null;
  limit?: number;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ customerId, limit = 10 }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrderHistory = async () => {
      if (!customerId) {
        setOrders([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await ventasService.getCustomerOrderHistory(customerId, limit);
        setOrders(data.orders || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Error al cargar el historial de órdenes'
        );
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderHistory();
  }, [customerId, limit]);

  if (!customerId) {
    return (
      <div className="order-history-container">
        <div className="order-history-empty">
          <AlertCircle className="icon-alert" />
          <p>Selecciona un cliente para ver su historial de compras</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="order-history-container">
        <div className="order-history-loading">
          <Loader className="icon-spinner" />
          <p>Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-history-container">
        <div className="order-history-error">
          <AlertCircle className="icon-error" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="order-history-container">
        <div className="order-history-empty">
          <Package className="icon-package" />
          <p>Este cliente no tiene historial de órdenes</p>
        </div>
      </div>
    );
  }

  // Calcular estadísticas
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => {
    const total = typeof order.total === 'string' ? parseFloat(order.total) : order.total;
    return sum + (isNaN(total) ? 0 : total);
  }, 0);
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED').length;
  const averageOrder = totalSpent / (totalOrders || 1);

  // Función para obtener el color del estado
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED':
        return '#10b981'; // Verde
      case 'DELIVERED':
        return '#3b82f6'; // Azul
      case 'SHIPPED':
        return '#f59e0b'; // Ámbar
      case 'PROCESSING':
        return '#8b5cf6'; // Púrpura
      case 'CONFIRMED':
        return '#6366f1'; // Índigo
      case 'PENDING':
        return '#6b7280'; // Gris
      case 'CANCELLED':
        return '#ef4444'; // Rojo
      default:
        return '#6b7280';
    }
  };

  // Función para traducir estado
  const getStatusLabel = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      COMPLETED: 'Completada',
      DELIVERED: 'Entregada',
      SHIPPED: 'Enviada',
      PROCESSING: 'En Proceso',
      CONFIRMED: 'Confirmada',
      PENDING: 'Pendiente',
      CANCELLED: 'Cancelada',
    };
    return statusMap[status] || status;
  };

  // Función para formatear moneda CLP
  const formatCLP = (value: number | string): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '$0';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Función para formatear fecha
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="order-history-container">
      {/* Encabezado con estadísticas */}
      <div className="order-history-header">
        <h2>📦 Historial de Compras</h2>
        
        <div className="order-statistics">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <Package size={20} color="#10b981" />
            </div>
            <div className="stat-info">
              <span className="stat-label">Total de Órdenes</span>
              <span className="stat-value">{totalOrders}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <DollarSign size={20} color="#3b82f6" />
            </div>
            <div className="stat-info">
              <span className="stat-label">Gasto Total</span>
              <span className="stat-value">{formatCLP(totalSpent)}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <Package size={20} color="#10b981" />
            </div>
            <div className="stat-info">
              <span className="stat-label">Órdenes Completadas</span>
              <span className="stat-value">{completedOrders}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}>
              <DollarSign size={20} color="#a855f7" />
            </div>
            <div className="stat-info">
              <span className="stat-label">Promedio por Orden</span>
              <span className="stat-value">{formatCLP(averageOrder)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de órdenes */}
      <div className="order-list">
        <div className="order-list-header">
          <div className="col-date">Fecha</div>
          <div className="col-items">Productos</div>
          <div className="col-total">Total</div>
          <div className="col-status">Estado</div>
        </div>

        {orders.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-card-row">
              <div className="col-date">
                <Calendar size={16} />
                <span>{formatDate(order.order_date)}</span>
              </div>
              <div className="col-items">
                <span className="badge-items">
                  {order.details?.length || 0} producto(s)
                </span>
              </div>
              <div className="col-total">
                <span className="price">{formatCLP(order.total)}</span>
              </div>
              <div className="col-status">
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(order.status) }}
                >
                  {getStatusLabel(order.status)}
                </span>
              </div>
            </div>

            {/* Detalles de productos (colapsable) */}
            {order.details && order.details.length > 0 && (
              <div className="order-items-expanded">
                <div className="items-header">
                  <span>Productos en esta orden:</span>
                </div>
                <div className="items-list">
                  {order.details.map((detail, idx) => (
                    <div key={idx} className="item-row">
                      <div className="item-product">
                        <span className="item-id">Producto #{detail.product_id}</span>
                      </div>
                      <div className="item-qty">
                        <span>×{detail.quantity}</span>
                      </div>
                      <div className="item-price">
                        <span>{formatCLP(detail.unit_price)} c/u</span>
                      </div>
                      <div className="item-subtotal">
                        <span>{formatCLP(detail.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pie de página */}
      <div className="order-history-footer">
        <p>
          Mostrando {orders.length} de {orders.length} órdenes registradas
        </p>
      </div>
    </div>
  );
};
