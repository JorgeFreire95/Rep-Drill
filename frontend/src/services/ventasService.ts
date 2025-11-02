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

// For bulk operations, we can override timeout per-request using the same apiClient

export const ventasService = {
  // Orders
  getAllOrders: async (): Promise<Order[]> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/`, {
      timeout: 120000, // 120 seconds for bulk orders
    });
    return response.data;
  },

  getOrders: async (params?: { status?: string; customer_id?: number }): Promise<Order[]> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/`, { params });
    return response.data;
  },

  getOrder: async (id: number): Promise<Order> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/${id}/`);
    return response.data;
  },

  createOrder: async (data: OrderFormData): Promise<Order> => {
    const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/orders/`, data);
    return response.data;
  },

  updateOrder: async (id: number, data: Partial<OrderFormData>): Promise<Order> => {
    const response = await apiClient.patch(`${API_URLS.VENTAS}/api/ventas/orders/${id}/`, data);
    return response.data;
  },

  deleteOrder: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.VENTAS}/api/ventas/orders/${id}/`);
  },

  cancelOrder: async (id: number): Promise<Order> => {
    const response = await apiClient.patch(`${API_URLS.VENTAS}/api/ventas/orders/${id}/`, { status: 'CANCELLED' });
    return response.data;
  },

  getCustomerOrderHistory: async (customerId: number, limit: number = 10): Promise<{ count: number; customer_id: number; orders: Order[] }> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/customer_history/`, {
      params: {
        customer_id: customerId,
        limit: limit
      }
    });
    return response.data;
  },

  // Order Details
  getOrderDetails: async (orderId: number): Promise<OrderDetail[]> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/order-details/?order=${orderId}`);
    return response.data;
  },

  createOrderDetail: async (data: OrderDetailFormData & { order: number }): Promise<OrderDetail> => {
    const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/order-details/`, data);
    return response.data;
  },

  updateOrderDetail: async (id: number, data: Partial<OrderDetailFormData>): Promise<OrderDetail> => {
    const response = await apiClient.patch(`${API_URLS.VENTAS}/api/ventas/order-details/${id}/`, data);
    return response.data;
  },

  deleteOrderDetail: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.VENTAS}/api/ventas/order-details/${id}/`);
  },

  // Payments
  getAllPayments: async (): Promise<Payment[]> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/payments/`);
    return response.data;
  },

  getPayments: async (orderId?: number): Promise<Payment[]> => {
    const params = orderId ? { order: orderId } : {};
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/payments/`, { params });
    return response.data;
  },

  createPayment: async (data: PaymentFormData): Promise<Payment> => {
    const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/payments/`, data);
    return response.data;
  },

  updatePayment: async (id: number, data: Partial<PaymentFormData>): Promise<Payment> => {
    const response = await apiClient.patch(`${API_URLS.VENTAS}/api/ventas/payments/${id}/`, data);
    return response.data;
  },

  deletePayment: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.VENTAS}/api/ventas/payments/${id}/`);
  },

  // Shipments
  getAllShipments: async (): Promise<Shipment[]> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/shipments/`);
    return response.data;
  },

  getShipments: async (orderId?: number): Promise<Shipment[]> => {
    const params = orderId ? { order: orderId } : {};
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/shipments/`, { params });
    return response.data;
  },

  createShipment: async (data: ShipmentFormData): Promise<Shipment> => {
    const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/shipments/`, data);
    return response.data;
  },

  updateShipment: async (id: number, data: Partial<ShipmentFormData>): Promise<Shipment> => {
    const response = await apiClient.patch(`${API_URLS.VENTAS}/api/ventas/shipments/${id}/`, data);
    return response.data;
  },

  deleteShipment: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_URLS.VENTAS}/api/ventas/shipments/${id}/`);
  },

  // Dashboard Stats
  getDashboardStats: async (): Promise<any> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/dashboard/stats/`);
    return response.data;
  },

  // Nuevos endpoints para el sistema de inventario automático
  
  /**
   * Verifica la disponibilidad de productos en el inventario
   */
  checkProductAvailability: async (products: Array<{ product_id: number; quantity: number }>): Promise<{
    all_available: boolean;
    products: Array<{
      success: boolean;
      available: boolean;
      current_quantity: number;
      required_quantity: number;
      product_name: string;
    }>;
  }> => {
    const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/check-availability/`, {
      products,
    });
    return response.data;
  },

  /**
   * Obtiene el estado de pago de una orden y si el inventario fue actualizado
   */
  getOrderPaymentStatus: async (orderId: number): Promise<{
    order_id: number;
    total: string;
    total_paid: string;
    remaining: string;
    is_fully_paid: boolean;
    inventory_updated: boolean;
    status: string;
    payment_percentage: number;
  }> => {
    const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/${orderId}/payment-status/`);
    return response.data;
  },

  /**
   * Procesa manualmente el pago de una orden y actualiza el inventario
   */
  processOrderPayment: async (orderId: number): Promise<{
    success: boolean;
    message: string;
    order_id: number;
    inventory_updates?: any[];
  }> => {
    const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/orders/${orderId}/process-payment/`);
    return response.data;
  },
};

