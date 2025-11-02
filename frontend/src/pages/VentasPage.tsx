import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, CreditCard, Truck, Plus, Search, Download, FileText, FileSpreadsheet, FileDown, Edit, Trash2 } from 'lucide-react';
import { Card, Button, Input } from '../components/common';
import { OrdersTable, OrderForm, PaymentForm, ShipmentForm, CustomerSearchBox, OrderHistory } from '../components/ventas';
import type { Order, OrderFormData, Payment, Shipment, Persona } from '../types';
import { ventasService } from '../services/ventasService';
import { exportToCSV, exportToExcel, exportToPDF, exportPaymentsToCSV, exportPaymentsToExcel, exportPaymentsToPDF } from '../utils/exportUtils';
import apiClient, { API_URLS } from '../services/api';

type TabType = 'orders' | 'payments' | 'shipments';

export const VentasPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [paymentStartDate, setPaymentStartDate] = useState<string>('');
  const [paymentEndDate, setPaymentEndDate] = useState<string>('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPaymentExportMenu, setShowPaymentExportMenu] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);  // Show 20 orders per page
  const [selectedCustomer, setSelectedCustomer] = useState<Persona | null>(null);

  // Función para formatear fechas sin conversión de zona horaria
  const formatDate = (dateString: string) => {
    const datePart = dateString.split('T')[0]; // "2025-10-19"
    const [year, month, day] = datePart.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
  };

  // Función para verificar si una orden tiene saldo pendiente
  const hasPendingBalance = (orderId: number): boolean => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return false;

    const orderPayments = payments.filter(p => p.order === orderId);
    const totalPaid = orderPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const orderTotal = parseFloat(order.total.toString());

    return totalPaid < orderTotal;
  };
  
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
  const [customersMap, setCustomersMap] = useState<Map<number, string>>(new Map());

  // Cargar órdenes
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ventasService.getAllOrders();
      console.log('📦 Datos de órdenes recibidos:', data);
      
      // Reemplazar customer_name con el nombre real del cliente desde el mapa
      const ordersWithCustomerNames = data.map(order => ({
        ...order,
        customer_name: customersMap.get(order.customer_id) || `Cliente #${order.customer_id}`
      }));
      
      setOrders(ordersWithCustomerNames);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoading(false);
    }
  }, [customersMap]);

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

  // Cargar clientes y crear mapa
  const loadCustomersMap = async () => {
    try {
      const response = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/`, { params: { limit: 1000 } });
      if (response.status === 200) {
        const data = response.data;
        const customers = Array.isArray(data) ? data : data.results || [];
        const map = new Map<number, string>();
        customers.forEach((customer: Persona) => {
          map.set(customer.id, customer.nombre);
        });
        setCustomersMap(map);
        console.log('✅ Clientes cargados:', map.size);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
    }
  };

  // Cargar datos según tab activa
  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    } else if (activeTab === 'payments') {
      // Cargar tanto pagos como órdenes para calcular saldo pendiente
      loadPayments();
      loadOrders();
    } else if (activeTab === 'shipments') {
      loadShipments();
    }
  }, [activeTab, loadOrders]);

  // Cargar clientes al montar el componente
  useEffect(() => {
    loadCustomersMap();
  }, []);

  // Cerrar menús de exportación al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.relative')) {
        setShowExportMenu(false);
      }
      if (showPaymentExportMenu && !target.closest('.relative')) {
        setShowPaymentExportMenu(false);
      }
    };

    if (showExportMenu || showPaymentExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu, showPaymentExportMenu]);

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
    const matchesSearch = (
      order.id.toString().includes(search) ||
      order.status.toLowerCase().includes(search) ||
      order.customer_id.toString().includes(search) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(search))
    );
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    // Filtro por rango de fechas
    let matchesDateRange = true;
    if (startDate || endDate) {
      // Obtener solo la fecha de la orden (sin hora) en formato YYYY-MM-DD
      const orderDateStr = order.order_date.split('T')[0];
      
      if (startDate && endDate) {
        // Comparar directamente las cadenas de fecha en formato YYYY-MM-DD
        matchesDateRange = orderDateStr >= startDate && orderDateStr <= endDate;
      } else if (startDate) {
        matchesDateRange = orderDateStr >= startDate;
      } else if (endDate) {
        matchesDateRange = orderDateStr <= endDate;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDateRange;
  });

  // Filtrado de pagos
  const filteredPayments = payments.filter(payment => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      payment.id.toString().includes(search) ||
      payment.payment_method.toLowerCase().includes(search) ||
      payment.order.toString().includes(search)
    );

    // Filtro por método de pago
    const matchesPaymentMethod = paymentMethodFilter === 'all' || payment.payment_method === paymentMethodFilter;

    let matchesDateRange = true;
    if (paymentStartDate || paymentEndDate) {
      const paymentDateStr = payment.payment_date.split('T')[0];
      
      if (paymentStartDate && paymentEndDate) {
        matchesDateRange = paymentDateStr >= paymentStartDate && paymentDateStr <= paymentEndDate;
      } else if (paymentStartDate) {
        matchesDateRange = paymentDateStr >= paymentStartDate;
      } else if (paymentEndDate) {
        matchesDateRange = paymentDateStr <= paymentEndDate;
      }
    }

    return matchesSearch && matchesPaymentMethod && matchesDateRange;
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

  // Paginación para órdenes
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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
          
          <div className="flex gap-3">
            {/* Botón de exportación (solo en órdenes) */}
            {activeTab === 'orders' && filteredOrders.length > 0 && (
              <div className="relative">
                <Button
                  variant="secondary"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  icon={<Download className="h-4 w-4" />}
                >
                  Exportar
                </Button>
                
                {/* Menú desplegable de exportación */}
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={() => {
                        exportToPDF(filteredOrders);
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg transition-colors"
                    >
                      <FileText className="h-4 w-4 text-red-600" />
                      <span>Exportar a PDF</span>
                    </button>
                    <button
                      onClick={() => {
                        exportToExcel(filteredOrders);
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      <span>Exportar a Excel</span>
                    </button>
                    <button
                      onClick={() => {
                        exportToCSV(filteredOrders);
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-blue-600" />
                      <span>Exportar a CSV</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Botón de nueva orden/pago/envío */}
            {activeTab === 'orders' && (
              <Button 
                onClick={handleCreateOrder}
                icon={<Plus className="h-4 w-4" />}
              >
                Nueva Orden
              </Button>
            )}
            {activeTab === 'payments' && (
              <div className="flex gap-2">
                {/* Botón de Exportar para Pagos */}
                <div className="relative">
                  <Button
                    variant="secondary"
                    onClick={() => setShowPaymentExportMenu(!showPaymentExportMenu)}
                    icon={<Download className="h-4 w-4" />}
                  >
                    Exportar
                  </Button>
                  
                  {showPaymentExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                      <div className="py-1" role="menu">
                        <button
                          onClick={() => {
                            exportPaymentsToPDF(filteredPayments);
                            setShowPaymentExportMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Exportar a PDF
                        </button>
                        <button
                          onClick={() => {
                            exportPaymentsToExcel(filteredPayments);
                            setShowPaymentExportMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Exportar a Excel
                        </button>
                        <button
                          onClick={() => {
                            exportPaymentsToCSV(filteredPayments);
                            setShowPaymentExportMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          role="menuitem"
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Exportar a CSV
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <Button 
                  onClick={handleCreatePayment}
                  icon={<Plus className="h-4 w-4" />}
                >
                  Nuevo Pago
                </Button>
              </div>
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

      {/* Búsqueda de Cliente - Solo para tab de órdenes */}
      {activeTab === 'orders' && (
        <Card className="mb-6 bg-blue-50 border border-blue-200">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-blue-900 mb-3">
              🔍 Buscar (Cliente Historial de compra)
            </h2>
            <CustomerSearchBox
              onSelectCustomer={(customer) => {
                setSelectedCustomer(customer);
              }}
              placeholder="Busca por teléfono, email o nombre..."
            />
            {selectedCustomer && (
              <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                <p className="text-sm text-blue-900">
                  ✅ <strong>Cliente seleccionado:</strong> {selectedCustomer.nombre}
                </p>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-blue-600 underline hover:text-blue-800 mt-2"
                >
                  Cambiar cliente
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Historial de Compras - Solo para tab de órdenes y si hay cliente seleccionado */}
      {activeTab === 'orders' && selectedCustomer && (
        <Card className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
          <OrderHistory customerId={selectedCustomer.id} limit={10} />
        </Card>
      )}

      {/* Barra de búsqueda y filtros */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4">
          {/* Primera fila: Búsqueda y filtro de estado */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Barra de búsqueda */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder={`Buscar ${activeTab === 'orders' ? 'órdenes' : activeTab === 'payments' ? 'pagos' : 'envíos'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filtro por estado (solo visible en tab de órdenes) */}
            {activeTab === 'orders' && (
              <div className="w-full sm:w-64">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="all">Todos los estados</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="CONFIRMED">Confirmada</option>
                  <option value="PROCESSING">En Proceso</option>
                  <option value="SHIPPED">Enviada</option>
                  <option value="DELIVERED">Entregada</option>
                  <option value="COMPLETED">Completada</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>
            )}

            {/* Filtro por método de pago (solo visible en tab de pagos) */}
            {activeTab === 'payments' && (
              <div className="w-full sm:w-64">
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="all">Todos los métodos</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Cheque">Cheque</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            )}
          </div>

          {/* Segunda fila: Filtro por rango de fechas (visible en órdenes y pagos) */}
          {activeTab === 'orders' && (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>
              {/* Botón para limpiar filtros de fecha */}
              {(startDate || endDate) && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Limpiar fechas
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Filtros de fecha para pagos */}
          {activeTab === 'payments' && (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={paymentStartDate}
                  onChange={(e) => setPaymentStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={paymentEndDate}
                  onChange={(e) => setPaymentEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
              </div>
              {/* Botón para limpiar filtros de fecha */}
              {(paymentStartDate || paymentEndDate) && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setPaymentStartDate('');
                      setPaymentEndDate('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Limpiar fechas
                  </button>
                </div>
              )}
            </div>
          )}
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
            <>
              <OrdersTable
                orders={paginatedOrders}
                loading={loading}
                onEdit={handleEditOrder}
                onDelete={handleDeleteOrder}
                onCancel={handleCancelOrder}
              />
              {/* Paginación */}
              {filteredOrders.length > 0 && (
                <Card className="mt-4 bg-gray-50">
                  <div className="flex items-center justify-between p-4">
                    <div className="text-sm text-gray-600">
                      Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, filteredOrders.length)} de {filteredOrders.length} órdenes
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Anterior
                      </button>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-2 text-sm font-medium rounded-md ${
                                currentPage === pageNum
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        {totalPages > 5 && <span className="text-gray-500">...</span>}
                      </div>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                </Card>
              )}
            </>
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
                            $ {Number(payment.amount).toLocaleString('es-CL')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {payment.payment_method}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(payment.payment_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => handleEditPayment(payment)}
                                disabled={!hasPendingBalance(payment.order)}
                                className={`inline-flex items-center gap-1 ${
                                  hasPendingBalance(payment.order)
                                    ? 'text-primary-600 hover:text-primary-900'
                                    : 'text-gray-400 cursor-not-allowed opacity-50'
                                }`}
                                title={hasPendingBalance(payment.order) ? "Editar" : "No hay saldo pendiente"}
                              >
                                <Edit className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="inline-flex items-center text-red-600 hover:text-red-900"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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
                            {formatDate(shipment.shipment_date)}
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
