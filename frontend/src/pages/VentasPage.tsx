import React, { useState, useEffect } from 'react';
import { ShoppingCart, CreditCard, Truck, Plus, Search } from 'lucide-react';
import { Card, Button, Input } from '../components/common';
import { OrdersTable, OrderForm, PaymentForm, ShipmentForm } from '../components/ventas';
import type { Order, OrderFormData, Payment, Shipment } from '../types';
import { ventasService } from '../services/ventasService';

type TabType = 'orders' | 'payments' | 'shipments';

export const VentasPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Estados para formularios de pagos y envíos
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isShipmentFormOpen, setIsShipmentFormOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Estados para datos
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar órdenes
  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await ventasService.getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar pagos
  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await ventasService.getAllPayments();
      setPayments(data);
    } catch (error) {
      console.error('Error cargando pagos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar envíos
  const loadShipments = async () => {
    try {
      setLoading(true);
      const data = await ventasService.getAllShipments();
      setShipments(data);
    } catch (error) {
      console.error('Error cargando envíos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos según tab activa
  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'payments') {
      loadPayments();
    } else if (activeTab === 'shipments') {
      loadShipments();
    }
  }, [activeTab]);

  // Handlers para órdenes
  const handleCreateOrder = () => {
    console.log('🔵 Botón "Nueva Orden" presionado');
    setSelectedOrder(null);
    setIsFormOpen(true);
    console.log('🔵 Estado isFormOpen actualizado a: true');
  };

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsFormOpen(true);
  };

  const handleDeleteOrder = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar esta orden?')) {
      try {
        await ventasService.deleteOrder(id);
        loadOrders();
      } catch (error) {
        console.error('Error eliminando orden:', error);
        alert('Error al eliminar la orden');
      }
    }
  };

  const handleCancelOrder = async (id: number) => {
    if (window.confirm('¿Estás seguro de cancelar esta orden?')) {
      try {
        await ventasService.cancelOrder(id);
        loadOrders();
      } catch (error) {
        console.error('Error cancelando orden:', error);
        alert('Error al cancelar la orden');
      }
    }
  };

  const handleFormSubmit = async (orderData: OrderFormData) => {
    try {
      if (selectedOrder) {
        await ventasService.updateOrder(selectedOrder.id, orderData);
      } else {
        await ventasService.createOrder(orderData);
      }
      setIsFormOpen(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (error) {
      console.error('Error guardando orden:', error);
      throw error;
    }
  };

  // Handlers para pagos
  const handleCreatePayment = () => {
    setSelectedPayment(null);
    setIsPaymentFormOpen(true);
  };

  const handleEditPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsPaymentFormOpen(true);
  };

  const handleDeletePayment = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este pago?')) {
      try {
        await ventasService.deletePayment(id);
        loadPayments();
      } catch (error) {
        console.error('Error eliminando pago:', error);
        alert('Error al eliminar el pago');
      }
    }
  };

  const handlePaymentFormSubmit = async (data: { order: number; amount: string; payment_method: string }) => {
    try {
      setFormLoading(true);
      if (selectedPayment) {
        await ventasService.updatePayment(selectedPayment.id, data);
      } else {
        await ventasService.createPayment(data);
      }
      setIsPaymentFormOpen(false);
      setSelectedPayment(null);
      loadPayments();
    } catch (error) {
      console.error('Error guardando pago:', error);
      alert('Error al guardar el pago');
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  // Handlers para envíos
  const handleCreateShipment = () => {
    setSelectedShipment(null);
    setIsShipmentFormOpen(true);
  };

  const handleEditShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsShipmentFormOpen(true);
  };

  const handleDeleteShipment = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este envío?')) {
      try {
        await ventasService.deleteShipment(id);
        loadShipments();
      } catch (error) {
        console.error('Error eliminando envío:', error);
        alert('Error al eliminar el envío');
      }
    }
  };

  const handleShipmentFormSubmit = async (data: {
    order: number;
    shipment_date: string;
    warehouse_id: number;
    delivery_status: string;
  }) => {
    try {
      setFormLoading(true);
      if (selectedShipment) {
        await ventasService.updateShipment(selectedShipment.id, data);
      } else {
        await ventasService.createShipment(data);
      }
      setIsShipmentFormOpen(false);
      setSelectedShipment(null);
      loadShipments();
    } catch (error) {
      console.error('Error guardando envío:', error);
      alert('Error al guardar el envío');
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  // Filtrado de órdenes
  const filteredOrders = orders.filter(order => {
    const search = searchTerm.toLowerCase();
    return (
      order.id.toString().includes(search) ||
      order.status.toLowerCase().includes(search) ||
      order.customer_id.toString().includes(search)
    );
  });

  // Filtrado de pagos
  const filteredPayments = payments.filter(payment => {
    const search = searchTerm.toLowerCase();
    return (
      payment.id.toString().includes(search) ||
      payment.payment_method.toLowerCase().includes(search) ||
      payment.order.toString().includes(search)
    );
  });

  // Filtrado de envíos
  const filteredShipments = shipments.filter(shipment => {
    const search = searchTerm.toLowerCase();
    return (
      shipment.id.toString().includes(search) ||
      shipment.order.toString().includes(search) ||
      (shipment.warehouse_id && shipment.warehouse_id.toString().includes(search))
    );
  });

  const tabs = [
    { id: 'orders' as TabType, label: 'Órdenes', icon: ShoppingCart, count: orders.length },
    { id: 'payments' as TabType, label: 'Pagos', icon: CreditCard, count: payments.length },
    { id: 'shipments' as TabType, label: 'Envíos', icon: Truck, count: shipments.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Ventas</h1>
              <p className="text-gray-600">Administra órdenes, envíos y pagos</p>
            </div>
          </div>
          {activeTab === 'orders' && (
            <Button 
              onClick={handleCreateOrder}
              icon={<Plus className="h-4 w-4" />}
            >
              Nueva Orden
            </Button>
          )}
          {activeTab === 'payments' && (
            <Button 
              onClick={handleCreatePayment}
              icon={<Plus className="h-4 w-4" />}
            >
              Nuevo Pago
            </Button>
          )}
          {activeTab === 'shipments' && (
            <Button 
              onClick={handleCreateShipment}
              icon={<Plus className="h-4 w-4" />}
            >
              Nuevo Envío
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                    ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon
                    className={`
                      -ml-0.5 mr-2 h-5 w-5
                      ${
                        activeTab === tab.id
                          ? 'text-primary-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }
                    `}
                  />
                  {tab.label}
                  <span
                    className={`
                      ml-3 py-0.5 px-2.5 rounded-full text-xs font-medium
                      ${
                        activeTab === tab.id
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-gray-100 text-gray-900'
                      }
                    `}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <Card className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder={`Buscar ${activeTab === 'orders' ? 'órdenes' : activeTab === 'payments' ? 'pagos' : 'envíos'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Contenido de tabs */}
      {activeTab === 'orders' && (
        <>
          {(() => {
            console.log('🟢 Renderizando tab de órdenes. isFormOpen:', isFormOpen);
            return null;
          })()}
          {isFormOpen ? (
            <Card>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedOrder ? 'Editar Orden' : 'Nueva Orden'}
                </h2>
              </div>
              <OrderForm
                order={selectedOrder || undefined}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                  setIsFormOpen(false);
                  setSelectedOrder(null);
                }}
              />
            </Card>
          ) : (
            <OrdersTable
              orders={filteredOrders}
              loading={loading}
              onEdit={handleEditOrder}
              onDelete={handleDeleteOrder}
              onCancel={handleCancelOrder}
            />
          )}
        </>
      )}

      {activeTab === 'payments' && (
        <>
          {isPaymentFormOpen ? (
            <Card>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedPayment ? 'Editar Pago' : 'Nuevo Pago'}
                </h2>
              </div>
              <PaymentForm
                payment={selectedPayment || undefined}
                onSubmit={handlePaymentFormSubmit}
                onCancel={() => {
                  setIsPaymentFormOpen(false);
                  setSelectedPayment(null);
                }}
                isLoading={formLoading}
              />
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orden
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Método
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          Cargando...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No se encontraron pagos
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{payment.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Orden #{payment.order}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${parseFloat(payment.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {payment.payment_method}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleEditPayment(payment)}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeletePayment(payment.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {activeTab === 'shipments' && (
        <>
          {isShipmentFormOpen ? (
            <Card>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedShipment ? 'Editar Envío' : 'Nuevo Envío'}
                </h2>
              </div>
              <ShipmentForm
                shipment={selectedShipment || undefined}
                onSubmit={handleShipmentFormSubmit}
                onCancel={() => {
                  setIsShipmentFormOpen(false);
                  setSelectedShipment(null);
                }}
                isLoading={formLoading}
              />
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orden
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bodega
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha Envío
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          Cargando...
                        </td>
                      </tr>
                    ) : filteredShipments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No se encontraron envíos
                        </td>
                      </tr>
                    ) : (
                      filteredShipments.map((shipment) => (
                        <tr key={shipment.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{shipment.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            Orden #{shipment.order}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {shipment.warehouse_id ? `Bodega #${shipment.warehouse_id}` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(shipment.shipment_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              {shipment.delivery_status || 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => handleEditShipment(shipment)}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteShipment(shipment.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
