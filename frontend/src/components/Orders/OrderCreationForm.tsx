/**
 * Componente para Crear Órdenes
 * Con tracking de eventos y validación de datos
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { useOrderEvents } from '../../hooks/useEventStream';
import { useDataQualityValidator } from '../../hooks/useDataQualityValidator';
import { ventasServiceEnhanced } from '../../services/ventasServiceEnhanced';
import api from '../../services/api';
import type { OrderFormData } from '../../types';
import './OrderCreationForm.css';

interface ProductOption {
  id: number;
  name: string;
  price: number;
}

interface CustomerOption {
  id: number;
  nombre: string;
}

interface ProductInForm {
  product_id: number;
  quantity: number;
  unit_price: number;
}

interface FormState {
  customer_id: number | null;
  products: ProductInForm[];
  status: 'draft' | 'pending' | 'submitted';
  event_status: 'idle' | 'publishing' | 'published' | 'error';
}

interface CreatedOrder {
  order_id: string;
  timestamp: string;
  event_published: boolean;
}

export const OrderCreationForm: React.FC<{
  onSuccess?: (orderId: string) => void;
  onError?: (error: string) => void;
}> = ({ onSuccess, onError }) => {
  const [formState, setFormState] = useState<FormState>({
    customer_id: null,
    products: [],
    status: 'draft',
    event_status: 'idle',
  });

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<CreatedOrder[]>([]);

  const { subscribeToOrderEvents } = useOrderEvents();
  const { validateData, getQualityMessage } = useDataQualityValidator();

  // Cargar clientes y productos
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersRes, productsRes] = await Promise.all([
          api.get('/api/personas/personas/', {
            params: { es_cliente: true },
          }),
          api.get('/api/inventario/products/'),
        ]);

        setCustomers(customersRes.data || []);
        setProducts(
          (productsRes.data || []).map((p: Record<string, unknown>) => ({
            id: p.id as number,
            name: p.name as string,
            price: p.price as number,
          }))
        );
      } catch (err) {
        logger.error('Error loading data:', err);
      }
    };

    loadData();
  }, []);

  // Suscribirse a eventos
  useEffect(() => {
    subscribeToOrderEvents((event) => {
      if (event.event_type === 'order.created') {
        const orderId = (event.data?.order_id as string) || 'unknown';

        setFormState((prev) => ({
          ...prev,
          event_status: 'published',
        }));

        // Agregar a recientes
        setRecentOrders((prev) =>
          [
            {
              order_id: orderId,
              timestamp: event.timestamp,
              event_published: true,
            },
            ...prev,
          ].slice(0, 5)
        );

        // Limpiar formulario
        setTimeout(() => {
          setFormState({
            customer_id: null,
            products: [],
            status: 'draft',
            event_status: 'idle',
          });
          if (onSuccess) {
            onSuccess(orderId);
          }
        }, 2000);
      }
    });
  }, [subscribeToOrderEvents, onSuccess]);

  const handleAddProduct = () => {
    setFormState((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        { product_id: 0, quantity: 1, unit_price: 0 },
      ],
    }));
  };

  const handleRemoveProduct = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  };

  const handleProductChange = (
    index: number,
    field: 'product_id' | 'quantity' | 'unit_price',
    value: unknown
  ) => {
    setFormState((prev) => {
      const newProducts = [...prev.products];
      newProducts[index] = {
        ...newProducts[index],
        [field]: value,
      };
      return { ...prev, products: newProducts };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validar datos
      if (!formState.customer_id) {
        throw new Error('Selecciona un cliente');
      }
      if (formState.products.length === 0) {
        throw new Error('Agrega al menos un producto');
      }

      const quantities = formState.products.map((p) => p.quantity);
      const prices = formState.products.map((p) => p.unit_price);

      const validation = validateData([...quantities, ...prices]);
      if (!validation.isValid) {
        throw new Error(`Datos inválidos: ${getQualityMessage(validation.score)}`);
      }

      // Crear orden
      setFormState((prev) => ({ ...prev, status: 'pending', event_status: 'publishing' }));

      const orderData: OrderFormData = {
        customer_id: formState.customer_id,
        status: 'PENDING',
        details: formState.products,
      };

      await ventasServiceEnhanced.createOrder(orderData);

      setFormState((prev) => ({ ...prev, status: 'submitted' }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al crear orden';
      setError(errorMsg);
      setFormState((prev) => ({ ...prev, event_status: 'error' }));
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const total = formState.products.reduce(
    (sum, p) => sum + p.quantity * p.unit_price,
    0
  );

  return (
    <div className="order-creation-form">
      <div className="form-container">
        <h2>📋 Crear Nueva Orden</h2>

        <form onSubmit={handleSubmit}>
          {/* Cliente */}
          <div className="form-group">
            <label htmlFor="customer">Cliente *</label>
            <select
              id="customer"
              value={formState.customer_id || ''}
              onChange={(e) =>
                setFormState({
                  ...formState,
                  customer_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              disabled={loading}
              required
            >
              <option value="">-- Selecciona un cliente --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Productos */}
          <div className="form-group">
            <label>Productos *</label>
            <div className="products-list">
              {formState.products.map((product, index) => (
                <div key={index} className="product-row">
                  <select
                    value={product.product_id}
                    onChange={(e) =>
                      handleProductChange(index, 'product_id', Number(e.target.value))
                    }
                    disabled={loading}
                  >
                    <option value={0}>-- Selecciona producto --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ${p.price.toLocaleString('es-CL')}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Cantidad"
                    value={product.quantity}
                    onChange={(e) =>
                      handleProductChange(index, 'quantity', Number(e.target.value))
                    }
                    disabled={loading}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Precio Unitario"
                    value={product.unit_price}
                    onChange={(e) =>
                      handleProductChange(index, 'unit_price', Number(e.target.value))
                    }
                    disabled={loading}
                  />

                  <span className="product-subtotal">
                    ${(product.quantity * product.unit_price).toLocaleString('es-CL')}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(index)}
                    disabled={loading}
                    className="btn-remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddProduct}
              disabled={loading}
              className="btn-add-product"
            >
              + Agregar Producto
            </button>
          </div>

          {/* Total */}
          <div className="form-group total-row">
            <label>Total</label>
            <div className="total-value">
              ${total.toLocaleString('es-CL')}
            </div>
          </div>

          {/* Estado de evento */}
          {formState.event_status !== 'idle' && (
            <div className={`event-status event-status-${formState.event_status}`}>
              <span className="event-icon">
                {formState.event_status === 'publishing' && '⏳'}
                {formState.event_status === 'published' && '✅'}
                {formState.event_status === 'error' && '❌'}
              </span>
              <span>
                {formState.event_status === 'publishing' && 'Publicando evento...'}
                {formState.event_status === 'published' && '¡Evento publicado exitosamente!'}
                {formState.event_status === 'error' && 'Error al publicar evento'}
              </span>
            </div>
          )}

          {/* Error */}
          {error && <div className="error-message">{error}</div>}

          {/* Botones */}
          <div className="form-actions">
            <button
              type="submit"
              disabled={
                loading || !formState.customer_id || formState.products.length === 0
              }
              className="btn-submit"
            >
              {loading ? '⏳ Creando...' : '✅ Crear Orden'}
            </button>
          </div>
        </form>
      </div>

      {/* Órdenes Recientes */}
      {recentOrders.length > 0 && (
        <div className="recent-orders">
          <h3>Órdenes Recientes</h3>
          <div className="orders-list">
            {recentOrders.map((order) => (
              <div key={order.order_id} className="order-item">
                <div className="order-id">#{order.order_id}</div>
                <div className="order-timestamp">
                  {new Date(order.timestamp).toLocaleTimeString('es-CL')}
                </div>
                <div className="order-status">
                  {order.event_published ? '✅ Evento publicado' : '⏳ Pendiente'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCreationForm;
