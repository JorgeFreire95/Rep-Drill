/**
 * Servicio mejorado para órdenes con soporte a eventos
 * Integración con EventPublisher backend
 */

import apiClient, { API_URLS } from './api';
import type {
  Order,
  OrderFormData,
  OrderDetail,
  OrderDetailFormData,
  Payment,
  PaymentFormData,
  Shipment,
  ShipmentFormData,
} from '../types';

export interface OrderEvent {
  event_type: 'order.created' | 'order.updated' | 'order.completed' | 'order.cancelled' | 'payment.received';
  order_id: number;
  customer_id: number;
  status?: string;
  timestamp: string;
  total?: number;
  details?: Record<string, string | number | boolean>;
}

export interface OrderWithMetadata extends Order {
  event_published: boolean;
  event_timestamp?: string;
  data_quality_score?: number;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
}

type EventCallback = (data: OrderEvent) => void;

class VentasServiceEnhanced {
  private apiClient = apiClient;
  private eventListeners: Map<string, Array<(data: OrderEvent) => void>> = new Map();

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================

  async getAllOrders(): Promise<Order[]> {
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/`);
    return response.data;
  }

  async getOrders(params?: { status?: string; customer_id?: number }): Promise<Order[]> {
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/`, { params });
    return response.data;
  }

  async getOrder(id: number): Promise<Order> {
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/${id}/`);
    return response.data;
  }

  /**
   * Crear orden y esperar confirmación de evento
   */
  async createOrder(data: OrderFormData): Promise<OrderWithMetadata> {
    try {
      const response = await this.apiClient.post(`${API_URLS.VENTAS}/api/ventas/orders/`, data);
      const order = response.data;

      // Emitir evento de creación
      this.emit('order:created', {
        event_type: 'order.created' as const,
        order_id: order.id,
        customer_id: order.customer_id,
        total: order.total,
        timestamp: new Date().toISOString(),
        details: { items_count: order.details?.length || 0 },
      } as OrderEvent);

      return {
        ...order,
        event_published: true,
        event_timestamp: new Date().toISOString(),
        processing_status: 'pending',
      };
    } catch (error) {
      console.error('Error creando orden:', error);
      throw error;
    }
  }

  async updateOrder(id: number, data: Partial<OrderFormData>): Promise<OrderWithMetadata> {
    try {
      const oldOrder = await this.getOrder(id);
      const response = await this.apiClient.patch(`${API_URLS.VENTAS}/api/ventas/orders/${id}/`, data);
      const newOrder = response.data;

      // Si cambió el status, emitir evento correspondiente
      if (oldOrder.status !== newOrder.status) {
        const eventType =
          newOrder.status === 'COMPLETED'
            ? 'order.completed'
            : newOrder.status === 'CANCELLED'
              ? 'order.cancelled'
              : 'order.updated';

        this.emit('order:updated', {
          event_type: eventType as any,
          order_id: newOrder.id,
          customer_id: newOrder.customer_id,
          status: newOrder.status,
          timestamp: new Date().toISOString(),
        } as OrderEvent);
      }

      return {
        ...newOrder,
        event_published: oldOrder.status !== newOrder.status,
        event_timestamp: new Date().toISOString(),
        processing_status: 'completed',
      };
    } catch (error) {
      console.error('Error actualizando orden:', error);
      throw error;
    }
  }

  async cancelOrder(id: number): Promise<OrderWithMetadata> {
    return this.updateOrder(id, { status: 'CANCELLED' });
  }

  async completeOrder(id: number): Promise<OrderWithMetadata> {
    return this.updateOrder(id, { status: 'COMPLETED' });
  }

  async deleteOrder(id: number): Promise<void> {
    await this.apiClient.delete(`${API_URLS.VENTAS}/api/ventas/orders/${id}/`);
  }

  // ============================================================================
  // ORDER DETAILS
  // ============================================================================

  async getOrderDetails(orderId: number): Promise<OrderDetail[]> {
    const response = await this.apiClient.get(
      `${API_URLS.VENTAS}/api/ventas/order-details/?order=${orderId}`
    );
    return response.data;
  }

  async createOrderDetail(
    data: OrderDetailFormData & { order: number }
  ): Promise<OrderDetail> {
    const response = await this.apiClient.post(
      `${API_URLS.VENTAS}/api/ventas/order-details/`,
      data
    );
    return response.data;
  }

  async updateOrderDetail(
    id: number,
    data: Partial<OrderDetailFormData>
  ): Promise<OrderDetail> {
    const response = await this.apiClient.patch(
      `${API_URLS.VENTAS}/api/ventas/order-details/${id}/`,
      data
    );
    return response.data;
  }

  async deleteOrderDetail(id: number): Promise<void> {
    await this.apiClient.delete(`${API_URLS.VENTAS}/api/ventas/order-details/${id}/`);
  }

  // ============================================================================
  // PAYMENTS
  // ============================================================================

  async getAllPayments(): Promise<Payment[]> {
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/payments/`);
    return response.data;
  }

  async getPayments(orderId?: number): Promise<Payment[]> {
    const params = orderId ? { order: orderId } : {};
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/payments/`, { params });
    return response.data;
  }

  async getPayment(id: number): Promise<Payment> {
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/payments/${id}/`);
    return response.data;
  }

  /**
   * Crear pago y emitir evento
   */
  async createPayment(data: PaymentFormData): Promise<Payment> {
    try {
      const response = await this.apiClient.post(`${API_URLS.VENTAS}/api/ventas/payments/`, data);
      const payment = response.data;

      // Emitir evento de pago
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.emit('payment:received', {
        event_type: 'payment.received',
        order_id: data.order,
        customer_id: 0, // Se obtendría del order
        total: Number(data.amount),
        timestamp: new Date().toISOString(),
        details: { payment_method: String(data.payment_method) },
      } as any);

      return payment;
    } catch (error) {
      console.error('Error creando pago:', error);
      throw error;
    }
  }

  async updatePayment(id: number, data: Partial<PaymentFormData>): Promise<Payment> {
    const response = await this.apiClient.patch(
      `${API_URLS.VENTAS}/api/ventas/payments/${id}/`,
      data
    );
    return response.data;
  }

  async deletePayment(id: number): Promise<void> {
    await this.apiClient.delete(`${API_URLS.VENTAS}/api/ventas/payments/${id}/`);
  }

  // ============================================================================
  // SHIPMENTS
  // ============================================================================

  async getAllShipments(): Promise<Shipment[]> {
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/shipments/`);
    return response.data;
  }

  async getShipments(orderId?: number): Promise<Shipment[]> {
    const params = orderId ? { order: orderId } : {};
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/shipments/`, {
      params,
    });
    return response.data;
  }

  async getShipment(id: number): Promise<Shipment> {
    const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/shipments/${id}/`);
    return response.data;
  }

  async createShipment(data: ShipmentFormData): Promise<Shipment> {
    const response = await this.apiClient.post(`${API_URLS.VENTAS}/api/ventas/shipments/`, data);
    return response.data;
  }

  async updateShipment(id: number, data: Partial<ShipmentFormData>): Promise<Shipment> {
    const response = await this.apiClient.patch(
      `${API_URLS.VENTAS}/api/ventas/shipments/${id}/`,
      data
    );
    return response.data;
  }

  async deleteShipment(id: number): Promise<void> {
    await this.apiClient.delete(`${API_URLS.VENTAS}/api/ventas/shipments/${id}/`);
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Escuchar eventos de órdenes
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(eventType: string, callback: EventCallback | any): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.push(callback);
    }
  }

  /**
   * Dejar de escuchar eventos
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(eventType: string, callback: EventCallback | any): void {
    if (!this.eventListeners.has(eventType)) return;
    const callbacks = this.eventListeners.get(eventType);
    if (!callbacks) return;
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emitir evento
   */
  private emit(eventType: string, data: OrderEvent): void {
    if (!this.eventListeners.has(eventType)) return;
    this.eventListeners.get(eventType)!.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error en listener de ${eventType}:`, error);
      }
    });
  }

  // ============================================================================
  // ANALYTICS & MONITORING
  // ============================================================================

  /**
   * Obtener estadísticas de órdenes
   */
  async getOrderStats(period: 'day' | 'week' | 'month' = 'month'): Promise<{
    total_orders: number;
    total_revenue: number;
    average_order_value: number;
    orders_by_status: Record<string, number>;
    period: string;
  }> {
    try {
      const response = await this.apiClient.get(`${API_URLS.VENTAS}/api/ventas/stats/`, {
        params: { period },
      });
      return response.data;
    } catch (error) {
      console.warn('Error obteniendo estadísticas de órdenes:', error);
      return {
        total_orders: 0,
        total_revenue: 0,
        average_order_value: 0,
        orders_by_status: {},
        period,
      };
    }
  }

  /**
   * Obtener datos de quality score de órdenes
   */
  async getOrderQualityMetrics(): Promise<{
    average_quality_score: number;
    orders_high_quality: number;
    orders_degraded: number;
    issues_count: number;
  }> {
    try {
      const response = await this.apiClient.get(
        `${API_URLS.VENTAS}/api/ventas/quality-metrics/`
      );
      return response.data;
    } catch (error) {
      console.warn('Error obteniendo métricas de calidad:', error);
      return {
        average_quality_score: 0,
        orders_high_quality: 0,
        orders_degraded: 0,
        issues_count: 0,
      };
    }
  }
}

export const ventasServiceEnhanced = new VentasServiceEnhanced();
