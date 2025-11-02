import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import type { Order, OrderFormData, OrderDetailFormData } from '../../types';
import { Button } from '../common';
import { personasService } from '../../services/personasService';
import { inventarioService } from '../../services/inventarioService';
import { formatCLP } from '../../utils/currencyUtils';
import type { Persona, Product } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface OrderFormProps {
  order?: Order;
  onSubmit: (data: OrderFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  order,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [clientes, setClientes] = useState<Persona[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [formData, setFormData] = useState<OrderFormData>({
    customer_id: order?.customer_id || 0,
    notes: order?.notes || '',
    details: [],
  });

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    loadData();
  }, []);

  // Cargar detalles cuando se edita una orden
  useEffect(() => {
    if (order && order.details_read && order.details_read.length > 0) {
      logger.info('🔵 Cargando detalles de orden para editar', {
        detailsCount: order.details_read.length
      });
      const mappedDetails = order.details_read.map(detail => ({
        product_id: detail.product_id,
        quantity: detail.quantity,
        unit_price: Number(detail.unit_price),
        discount: Number(detail.discount || 0)
      }));
      
      setFormData(prev => ({
        ...prev,
        customer_id: order.customer_id,
        notes: order.notes || '',
        details: mappedDetails
      }));
    }
  }, [order]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [clientesData, productosData] = await Promise.all([
        personasService.getAll({ es_cliente: true }),
        inventarioService.getProducts(),
      ]);
      setClientes(clientesData.results || clientesData);
      // Filtrar solo productos con stock disponible (quantity > 0)
      const productosConStock = productosData.filter(p => p.quantity > 0);
      setProductos(productosConStock);
      
      if (productosData.length > productosConStock.length) {
        logger.info(`⚠️ ${productosData.length - productosConStock.length} productos sin stock han sido filtrados`);
      }
    } catch (error) {
      logger.error('Error al cargar datos:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const addDetail = () => {
    setFormData(prev => ({
      ...prev,
      details: [...prev.details, { product_id: 0, quantity: 1, unit_price: 0, discount: 0 }]
    }));
  };

  const removeDetail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index)
    }));
  };

  const updateDetail = (index: number, field: keyof OrderDetailFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      details: prev.details.map((detail, i) => {
        if (i === index) {
          const updated = { ...detail, [field]: value };
          
          // Auto-actualizar precio si selecciona producto
          if (field === 'product_id') {
            const producto = productos.find(p => p.id === Number(value));
            if (producto) {
              updated.unit_price = producto.price;
            }
          }
          
          // Validar que la cantidad no exceda el stock disponible
          if (field === 'quantity' || field === 'product_id') {
            const producto = productos.find(p => p.id === (field === 'product_id' ? Number(value) : updated.product_id));
            if (producto && field === 'quantity') {
              const cantidadSolicitada = Number(value);
              if (cantidadSolicitada > producto.quantity) {
                // Limitar al stock disponible
                updated.quantity = producto.quantity;
                logger.warn(`⚠️ ${producto.name} solo tiene ${producto.quantity} unidades disponibles`);
              }
            }
          }
          
          return updated;
        }
        return detail;
      })
    }));
  };

  const calculateTotal = () => {
    return formData.details.reduce((sum, detail) => {
      const subtotal = detail.quantity * detail.unit_price * (1 - (detail.discount || 0) / 100);
      return sum + subtotal;
    }, 0);
  };

  const validate = (): boolean => {
    const newErrors: any = {};

    if (!formData.customer_id || formData.customer_id === 0) {
      newErrors.customer_id = 'Debe seleccionar un cliente';
    }

    if (formData.details.length === 0) {
      newErrors.details = 'Debe agregar al menos un producto';
    }

    formData.details.forEach((detail, index) => {
      if (!detail.product_id || detail.product_id === 0) {
        newErrors[`detail_${index}_product`] = 'Seleccione un producto';
      }
      if (detail.quantity <= 0) {
        newErrors[`detail_${index}_quantity`] = 'Cantidad debe ser mayor a 0';
      }
      
      // Validar stock disponible
      const producto = productos.find(p => p.id === detail.product_id);
      if (producto && detail.quantity > producto.quantity) {
        newErrors[`detail_${index}_quantity`] = 
          `Solo hay ${producto.quantity} unidades disponibles de ${producto.name}`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      logger.error('Error al guardar orden:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cliente */}
      <div>
        <label className="label">Cliente *</label>
        <select
          className={`input ${errors.customer_id ? 'border-red-500' : ''}`}
          value={formData.customer_id}
          onChange={(e) => setFormData(prev => ({ ...prev, customer_id: Number(e.target.value) }))}
          disabled={isLoading || loadingData}
        >
          <option value={0}>Seleccione un cliente</option>
          {clientes.map(cliente => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre} - {cliente.numero_documento}
            </option>
          ))}
        </select>
        {errors.customer_id && (
          <p className="text-sm text-red-600 mt-1">{errors.customer_id}</p>
        )}
      </div>

      {/* Detalles */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="label">Productos *</label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={addDetail}
            disabled={isLoading || productos.length === 0}
          >
            Agregar Producto
          </Button>
        </div>

        {productos.length === 0 && !loadingData && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ No hay productos con stock disponible. No se pueden agregar productos a la orden.
            </p>
          </div>
        )}

        {errors.details && (
          <p className="text-sm text-red-600 mb-2">{errors.details}</p>
        )}

        <div className="space-y-3">
          {formData.details.map((detail, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-5">
                  <label className="text-xs text-gray-600">Producto</label>
                  <select
                    className="input input-sm"
                    value={detail.product_id}
                    onChange={(e) => updateDetail(index, 'product_id', Number(e.target.value))}
                    disabled={isLoading}
                  >
                    <option value={0}>Seleccione...</option>
                    {productos.map(prod => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} - ${prod.price} (Stock: {prod.quantity})
                      </option>
                    ))}
                  </select>
                  {errors[`detail_${index}_product`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`detail_${index}_product`]}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-600">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    className={`input input-sm ${errors[`detail_${index}_quantity`] ? 'border-red-500' : ''}`}
                    value={detail.quantity}
                    onChange={(e) => updateDetail(index, 'quantity', parseInt(e.target.value) || 1)}
                    disabled={isLoading}
                  />
                  {errors[`detail_${index}_quantity`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`detail_${index}_quantity`]}</p>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-600">Precio</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input input-sm"
                    value={detail.unit_price}
                    onChange={(e) => updateDetail(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    disabled={isLoading}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-600">Desc %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input input-sm"
                    value={detail.discount || 0}
                    onChange={(e) => updateDetail(index, 'discount', parseFloat(e.target.value) || 0)}
                    disabled={isLoading}
                  />
                </div>

                <div className="col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={() => removeDetail(index)}
                    className="text-red-600 hover:text-red-800 p-2"
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 text-right text-sm font-medium text-gray-700">
                Subtotal: {formatCLP(detail.quantity * detail.unit_price * (1 - (detail.discount || 0) / 100))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="bg-primary-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900">Total:</span>
          <span className="text-2xl font-bold text-primary-600">
            {formatCLP(calculateTotal())}
          </span>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="label">Notas</label>
        <textarea
          className="input min-h-[80px]"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Notas adicionales sobre la orden..."
          disabled={isLoading}
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
        >
          {order ? 'Actualizar' : 'Crear'} Orden
        </Button>
      </div>
    </form>
  );
};
