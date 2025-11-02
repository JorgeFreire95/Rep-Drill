import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShoppingCart, Plus, Trash2, CheckCircle2, AlertCircle, 
  Zap, TrendingUp, Package, Clock, User, History, Truck, CreditCard
} from 'lucide-react';
import StockValidator from '../components/StockValidator';
import type { StockValidationResult } from '../types/stock';
import apiClient, { API_URLS } from '../services/api';
import { logger } from '../utils/logger';

interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  requested_quantity: number;
  available_quantity: number;
  status: 'in_stock' | 'partial' | 'out_of_stock' | 'not_found';
  warnings: string[];
}

interface Customer {
  id: number;
  nombre: string;
  email?: string;
  telefono?: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  cost_price: number;
  quantity: number;
}

interface PreviousOrder {
  id: number;
  order_date: string;
  status: string;
  total: number;
  items_count: number;
}

export const CreateOrderPage: React.FC = () => {
  // Estados principales
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerHistory, setCustomerHistory] = useState<PreviousOrder[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para búsqueda y selección
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showValidation, setShowValidation] = useState(false);
  const [validationResult, setValidationResult] = useState<StockValidationResult | null>(null);

  // Nuevos estados para Opción B: Flujo Completo
  const [currentOrder, setCurrentOrder] = useState<{ id: number; total: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'credito'>('efectivo');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [flowStep, setFlowStep] = useState<'order' | 'payment' | 'shipment' | 'complete'>('order');

  // Cargar clientes
  const loadCustomers = useCallback(async () => {
    try {
      const response = await apiClient.get(`${API_URLS.PERSONAS}/api/personas/`, { params: { limit: 1000 } });
      if (response.status === 200) {
        const data = response.data;
        const customerList = Array.isArray(data) ? data : data.results || [];
        setCustomers(customerList);
      }
    } catch (err) {
      logger.error('Error cargando clientes:', err);
    }
  }, []);

  // Cargar productos
  const loadProducts = useCallback(async () => {
    try {
      const response = await apiClient.get(`${API_URLS.INVENTARIO}/api/products/`);
      if (response.status === 200) {
        const data = response.data;
        const productList = Array.isArray(data) ? data : data.results || [];
        setProducts(productList);
      }
    } catch (err) {
      logger.error('Error cargando productos:', err);
    }
  }, []);

  // Cargar historial del cliente
  const loadCustomerHistory = useCallback(async (customerId: number) => {
    try {
      const response = await apiClient.get(`${API_URLS.VENTAS}/api/ventas/orders/customer_history/`, { params: { customer_id: customerId, limit: 5 } });
      if (response.status === 200) {
        const data = response.data;
        setCustomerHistory(data.orders || []);
      }
    } catch (err) {
      logger.error('Error cargando historial:', err);
      setCustomerHistory([]);
    }
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    loadCustomers();
    loadProducts();
  }, [loadCustomers, loadProducts]);

  // Filtrar clientes según búsqueda (prioridad a teléfono)
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.nombre?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.telefono?.includes(search)
    ).sort((a, b) => {
      // Prioridad: teléfono que coincida primero
      const aPhoneMatch = a.telefono?.includes(search) ? 0 : 1;
      const bPhoneMatch = b.telefono?.includes(search) ? 0 : 1;
      return aPhoneMatch - bPhoneMatch;
    });
  }, [customers, customerSearch]);

  // Filtrar productos según búsqueda
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(p =>
      p.name?.toLowerCase().includes(search) ||
      p.sku?.toLowerCase().includes(search)
    );
  }, [products, productSearch]);

  // Manejar selección de cliente
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    loadCustomerHistory(customer.id);
  };

  // Agregar producto al carrito
  const addToCart = useCallback(() => {
    if (!selectedProductId || quantity <= 0) {
      setError('Selecciona un producto y una cantidad válida');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) {
      setError('Producto no encontrado');
      return;
    }

    const newItem: CartItem = {
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: product.price,
      requested_quantity: quantity,
      available_quantity: product.quantity,
      status: product.quantity >= quantity ? 'in_stock' : product.quantity > 0 ? 'partial' : 'out_of_stock',
      warnings: []
    };

    const existingItem = cart.find(item => item.product_id === selectedProductId);
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === selectedProductId
          ? { ...item, quantity: item.quantity + quantity, requested_quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, newItem]);
    }

    setSelectedProductId(null);
    setQuantity(1);
    setProductSearch('');
    setError(null);
  }, [selectedProductId, quantity, products, cart]);

  // Remover producto del carrito
  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Calcular total
  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  }, [cart]);

  // Manejar validación completada
  const handleValidationComplete = (result: StockValidationResult) => {
    setValidationResult(result);
    
    // Actualizar cart items con información de validación
    setCart(cart.map(item => {
      const validatedItem = result.items.find(v => v.product_id === item.product_id);
      if (validatedItem) {
        return {
          ...item,
          status: validatedItem.status,
          available_quantity: validatedItem.available_quantity,
          warnings: validatedItem.warnings
        };
      }
      return item;
    }));
  };

  // Crear orden y avanzar a pago
  const handleCreateOrder = async () => {
    if (!selectedCustomer) {
      setError('Selecciona un cliente');
      return;
    }

    if (cart.length === 0) {
      setError('Agrega productos al carrito');
      return;
    }

    if (!validationResult?.all_available) {
      setError('Valida el stock antes de crear la orden');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const orderData = {
        customer_id: selectedCustomer.id,
        details: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        })),
        notes
      };

      const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/orders/create_order/`, orderData);
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Error al crear la orden');
      }

      const result = response.data;
      setCurrentOrder({ id: result.order_id, total });
      setFlowStep('payment');
      setSuccess(`✅ Orden #${result.order_id} creada. Ahora registra el pago.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Registrar pago y avanzar a envío
  const handleRegisterPayment = async () => {
    if (!currentOrder) {
      setError('Error: No hay orden seleccionada');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const paymentData = {
        order: currentOrder.id,
        amount: currentOrder.total.toString(),
        payment_method: paymentMethod,
        payment_date: new Date().toISOString().split('T')[0]
      };

      const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/payments/`, paymentData);
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Error al registrar el pago');
      }

      setFlowStep('shipment');
      setSuccess(`✅ Pago registrado. Ahora registra el envío.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Registrar envío y completar
  const handleRegisterShipment = async () => {
    if (!currentOrder) {
      setError('Error: No hay orden seleccionada');
      return;
    }

    if (shippingMethod === 'delivery' && !deliveryAddress) {
      setError('Ingresa la dirección de entrega');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Datos correctos según el modelo Shipment del backend
      const shipmentData = {
        order: currentOrder.id,  // ForeignKey al order
        shipment_date: new Date().toISOString().split('T')[0],  // Fecha actual
        warehouse_id: 1,  // ID del almacén (puedes ajustar según tu lógica)
        delivered: false,  // Estado inicial
        delivery_status: 'Pendiente'  // Estado inicial
      };

      const response = await apiClient.post(`${API_URLS.VENTAS}/api/ventas/shipments/`, shipmentData);
      if (response.status !== 200 && response.status !== 201) {
        const errorData = response.data || {};
        throw new Error(errorData.detail || errorData.error || 'Error al registrar el envío');
      }

      setFlowStep('complete');
      setSuccess(`✅ ¡Orden completada! Cliente: ${selectedCustomer?.nombre}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Reiniciar flujo completo
  const handleResetFlow = () => {
    setSelectedCustomer(null);
    setCustomerHistory([]);
    setCart([]);
    setNotes('');
    setValidationResult(null);
    setShowValidation(false);
    setCurrentOrder(null);
    setPaymentMethod('efectivo');
    setDeliveryAddress('');
    setShippingMethod('pickup');
    setFlowStep('order');
    setCustomerSearch('');
    setError(null);
    setSuccess(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'bg-green-50 border-green-200';
      case 'partial':
        return 'bg-yellow-50 border-yellow-200';
      case 'out_of_stock':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'text-green-700';
      case 'partial':
        return 'text-yellow-700';
      case 'out_of_stock':
        return 'text-red-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Crear Nueva Orden</h1>
          </div>
          <p className="text-gray-600 ml-11">Fase 4: Sistema de Órdenes Mejorado con Validación de Stock</p>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 font-medium">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Izquierdo: Selección de Cliente y Productos */}
          <div className="lg:col-span-1 space-y-6">
            {/* Seleccionar Cliente */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente
              </h2>

              {selectedCustomer ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="font-medium text-gray-900">{selectedCustomer.nombre}</p>
                  <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Cambiar cliente
                  </button>
                  {customerHistory.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Últimas Compras
                      </h3>
                      <div className="space-y-1 text-xs">
                        {customerHistory.map(order => (
                          <div key={order.id} className="p-2 bg-gray-50 rounded border border-gray-200">
                            <div className="flex justify-between">
                              <span className="font-medium">Orden #{order.id}</span>
                              <span className="text-gray-600">${order.total.toLocaleString()}</span>
                            </div>
                            <div className="text-gray-500">{order.order_date}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Buscar cliente (teléfono, nombre o email)..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                  />
                  <p className="text-xs text-gray-500 mb-3">💡 Búsqueda rápida: escribe el teléfono del cliente</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-sm text-gray-500">No hay clientes</p>
                    ) : (
                      filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => handleSelectCustomer(customer)}
                          className="w-full text-left p-3 hover:bg-blue-50 border border-gray-200 rounded-lg transition"
                        >
                          <p className="font-medium text-gray-900">{customer.nombre}</p>
                          <p className="text-xs text-gray-600">{customer.telefono}</p>
                          <p className="text-xs text-gray-600">{customer.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Agregar Productos */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Agregar Productos
              </h2>

              <input
                type="text"
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
              />

              <select
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(Number(e.target.value) || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
              >
                <option value="">Seleccionar producto...</option>
                {filteredProducts.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - ${product.price.toLocaleString()} (Stock: {product.quantity})
                  </option>
                ))}
              </select>

              <div className="flex gap-2 mb-3">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Cantidad"
                />
                <button
                  onClick={addToCart}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              </div>
            </div>
          </div>

          {/* Panel Central: Carrito */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito ({cart.length} artículos)
            </h2>

            {cart.length === 0 ? (
              <p className="text-center text-gray-500 py-8">El carrito está vacío</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                {cart.map(item => (
                  <div
                    key={item.product_id}
                    className={`border rounded-lg p-3 ${getStatusColor(item.status)}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 line-clamp-2">{item.product_name}</p>
                        <p className={`text-xs font-medium ${getStatusTextColor(item.status)}`}>
                          {item.status === 'in_stock' && '✓ En stock'}
                          {item.status === 'partial' && '⚠ Parcial'}
                          {item.status === 'out_of_stock' && '✗ Agotado'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                      <div>Cantidad: <span className="font-medium text-gray-900">{item.quantity}</span></div>
                      <div>Precio: <span className="font-medium text-gray-900">${item.unit_price.toLocaleString()}</span></div>
                      <div>Stock: <span className="font-medium text-gray-900">{item.available_quantity}</span></div>
                      <div>Subtotal: <span className="font-medium text-gray-900">${(item.unit_price * item.quantity).toLocaleString()}</span></div>
                    </div>

                    {item.warnings.length > 0 && (
                      <div className="text-xs text-yellow-700 border-t pt-2">
                        {item.warnings.map((w, i) => (
                          <p key={i}>• {w}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Notas */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar notas a la orden..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Total */}
            {cart.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">Subtotal:</span>
                  <span className="font-bold text-gray-900">${total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-blue-600">${total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Panel Derecho: Validación y Confirmación */}
          <div className="lg:col-span-1 space-y-6">
            {/* Validación de Stock */}
            {cart.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Validación de Stock
                </h2>

                {!showValidation ? (
                  <button
                    onClick={() => setShowValidation(true)}
                    className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Validar Disponibilidad
                  </button>
                ) : (
                  <div>
                    <StockValidator
                      items={cart.map(item => ({
                        product_id: item.product_id,
                        quantity: item.quantity
                      }))}
                      onValidationComplete={handleValidationComplete}
                    />

                    <button
                      onClick={() => setShowValidation(false)}
                      className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm"
                    >
                      Ocultar validación
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resumen y Flujo Completo */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              {/* Indicador de Paso */}
              {currentOrder && (
                <div className="mb-6">
                  <div className="flex gap-2 mb-4">
                    <div className={`flex-1 h-2 rounded-full ${flowStep === 'complete' ? 'bg-green-600' : flowStep !== 'order' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                    <div className={`flex-1 h-2 rounded-full ${['shipment', 'complete'].includes(flowStep) ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                    <div className={`flex-1 h-2 rounded-full ${flowStep === 'complete' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                  </div>
                  <div className="text-xs text-gray-600 flex gap-2">
                    <span className={flowStep !== 'order' ? 'text-green-600 font-bold' : 'text-gray-600'}>✓ Orden</span>
                    <span> • </span>
                    <span className={flowStep === 'payment' ? 'text-blue-600 font-bold' : flowStep !== 'order' ? 'text-green-600 font-bold' : 'text-gray-600'}>
                      {flowStep === 'payment' ? '⊕ Pago' : flowStep !== 'order' ? '✓ Pago' : 'Pago'}
                    </span>
                    <span> • </span>
                    <span className={flowStep === 'shipment' ? 'text-blue-600 font-bold' : flowStep === 'complete' ? 'text-green-600 font-bold' : 'text-gray-600'}>
                      {flowStep === 'shipment' ? '⊕ Envío' : flowStep === 'complete' ? '✓ Envío' : 'Envío'}
                    </span>
                  </div>
                </div>
              )}

              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {flowStep === 'order' ? 'Resumen de Orden' : flowStep === 'payment' ? 'Registrar Pago' : flowStep === 'shipment' ? 'Registrar Envío' : '✓ ¡Orden Completada!'}
              </h2>

              {/* PASO 1: RESUMEN DE ORDEN */}
              {flowStep === 'order' && (
                <>
                  <div className="space-y-3 text-sm mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cliente:</span>
                      <span className="font-medium text-gray-900">
                        {selectedCustomer?.nombre || 'No seleccionado'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Artículos:</span>
                      <span className="font-medium text-gray-900">{cart.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-bold text-lg text-blue-600">${total.toLocaleString()}</span>
                    </div>

                    {validationResult && (
                      <>
                        <div className="border-t pt-3">
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Stock Disponible:</span>
                            <span className={`font-medium ${validationResult.all_available ? 'text-green-600' : 'text-yellow-600'}`}>
                              {validationResult.all_available ? '✓ Todo OK' : '⚠ Revisar'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {validationResult.summary.available}/{validationResult.summary.total_items} disponibles
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleCreateOrder}
                    disabled={!selectedCustomer || cart.length === 0 || !validationResult?.all_available || loading}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2 transition"
                  >
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        Creando orden...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        ✓ Crear Orden
                      </>
                    )}
                  </button>

                  {!selectedCustomer && (
                    <p className="mt-2 text-xs text-red-600">✗ Selecciona un cliente</p>
                  )}
                  {selectedCustomer && cart.length === 0 && (
                    <p className="mt-2 text-xs text-red-600">✗ Agrega productos al carrito</p>
                  )}
                  {selectedCustomer && cart.length > 0 && !validationResult?.all_available && (
                    <p className="mt-2 text-xs text-yellow-600">⚠ Valida el stock antes de crear</p>
                  )}
                </>
              )}

              {/* PASO 2: REGISTRAR PAGO */}
              {flowStep === 'payment' && currentOrder && (
                <>
                  <div className="space-y-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Orden #{currentOrder.id}</p>
                      <p className="text-xl font-bold text-blue-600">${currentOrder.total.toLocaleString()}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as 'efectivo' | 'transferencia' | 'credito')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="transferencia">🏦 Transferencia</option>
                        <option value="credito">💳 Crédito</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setFlowStep('order')}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      ← Atrás
                    </button>
                    <button
                      onClick={handleRegisterPayment}
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Registrar Pago
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* PASO 3: REGISTRAR ENVÍO */}
              {flowStep === 'shipment' && currentOrder && (
                <>
                  <div className="space-y-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Orden #{currentOrder.id}</p>
                      <p className="text-xl font-bold text-blue-600">${currentOrder.total.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Pago: {paymentMethod} ✓</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Método de Envío</label>
                      <select
                        value={shippingMethod}
                        onChange={(e) => setShippingMethod(e.target.value as 'pickup' | 'delivery')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="pickup">🏪 Retiro en Local</option>
                        <option value="delivery">🚚 Envío a Domicilio</option>
                      </select>
                    </div>

                    {shippingMethod === 'delivery' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Dirección de Entrega</label>
                        <textarea
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Calle, número, comuna, ciudad..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setFlowStep('payment')}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      ← Atrás
                    </button>
                    <button
                      onClick={handleRegisterShipment}
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Clock className="w-4 h-4 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <Truck className="w-4 h-4" />
                          Registrar Envío
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* PASO 4: COMPLETADO */}
              {flowStep === 'complete' && currentOrder && (
                <>
                  <div className="space-y-4 text-center mb-6">
                    <div className="text-5xl">✨</div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <p className="text-sm text-gray-600 mb-2">Orden completada</p>
                      <p className="text-3xl font-bold text-green-600 mb-2">#{currentOrder.id}</p>
                      <p className="text-2xl font-bold text-gray-900">${currentOrder.total.toLocaleString()}</p>
                      <div className="mt-4 space-y-1 text-sm text-gray-600">
                        <p>✓ Cliente: {selectedCustomer?.nombre}</p>
                        <p>✓ Pago: {paymentMethod}</p>
                        <p>✓ Envío: {shippingMethod === 'pickup' ? 'Retiro en Local' : 'A Domicilio'}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleResetFlow}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Crear Otra Orden
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderPage;
