import React, { useState, useEffect } from 'react';
import type { Shipment, Order } from '../../types';
import { Button } from '../common';
import { ventasService } from '../../services/ventasService';
import { inventarioService } from '../../services/inventarioService';

interface ShipmentFormProps {
  shipment?: Shipment;
  orderId?: number;
  onSubmit: (data: {
    order: number;
    shipment_date: string;
    warehouse_id: number;
    delivery_status: string;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ShipmentForm: React.FC<ShipmentFormProps> = ({
  shipment,
  orderId,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  const [formData, setFormData] = useState({
    order: shipment?.order || orderId || 0,
    shipment_date: shipment?.shipment_date
      ? new Date(shipment.shipment_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    warehouse_id: shipment?.warehouse_id || 0,
    delivery_status: shipment?.delivery_status || 'Pendiente',
  });

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    loadOrders();
    loadWarehouses();
  }, []);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await ventasService.getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error cargando órdenes:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const data = await inventarioService.getWarehouses();
      setWarehouses(data);
    } catch (error) {
      console.error('Error cargando bodegas:', error);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const deliveryStatuses = [
    'Pendiente',
    'En Preparación',
    'Enviado',
    'En Tránsito',
    'Entregado',
    'Cancelado',
    'Devuelto',
  ];

  const validate = (): boolean => {
    const newErrors: any = {};

    if (!formData.order || formData.order === 0) {
      newErrors.order = 'Debe seleccionar una orden';
    }

    if (!formData.shipment_date) {
      newErrors.shipment_date = 'La fecha de envío es requerida';
    }

    if (!formData.warehouse_id || formData.warehouse_id === 0) {
      newErrors.warehouse_id = 'Debe seleccionar una bodega';
    }

    if (!formData.delivery_status || formData.delivery_status.trim() === '') {
      newErrors.delivery_status = 'Debe seleccionar un estado de entrega';
    }

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
      console.error('Error al guardar envío:', error);
    }
  };

  const selectedOrder = orders.find(o => o.id === formData.order);
  const selectedWarehouse = warehouses.find(w => w.id === formData.warehouse_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Orden */}
      <div>
        <label className="label">Orden *</label>
        <select
          className={`input ${errors.order ? 'border-red-500' : ''}`}
          value={formData.order}
          onChange={(e) => setFormData(prev => ({ ...prev, order: Number(e.target.value) }))}
          disabled={isLoading || loadingOrders || !!orderId}
        >
          <option value={0}>Seleccione una orden</option>
          {orders.map(order => (
            <option key={order.id} value={order.id}>
              Orden #{order.id} - Cliente #{order.customer_id} - ${order.total}
            </option>
          ))}
        </select>
        {errors.order && (
          <p className="text-sm text-red-600 mt-1">{errors.order}</p>
        )}
        {selectedOrder && (
          <p className="text-sm text-gray-600 mt-1">
            Fecha de orden: {new Date(selectedOrder.order_date).toLocaleDateString('es-CL')}
          </p>
        )}
      </div>

      {/* Fecha de Envío */}
      <div>
        <label className="label">Fecha de Envío *</label>
        <input
          type="date"
          className={`input ${errors.shipment_date ? 'border-red-500' : ''}`}
          value={formData.shipment_date}
          onChange={(e) => setFormData(prev => ({ ...prev, shipment_date: e.target.value }))}
          disabled={isLoading}
        />
        {errors.shipment_date && (
          <p className="text-sm text-red-600 mt-1">{errors.shipment_date}</p>
        )}
      </div>

      {/* Bodega */}
      <div>
        <label className="label">Bodega *</label>
        <select
          className={`input ${errors.warehouse_id ? 'border-red-500' : ''}`}
          value={formData.warehouse_id}
          onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: Number(e.target.value) }))}
          disabled={isLoading || loadingWarehouses}
        >
          <option value={0}>Seleccione una bodega</option>
          {warehouses.map(warehouse => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name} - {warehouse.location}
            </option>
          ))}
        </select>
        {errors.warehouse_id && (
          <p className="text-sm text-red-600 mt-1">{errors.warehouse_id}</p>
        )}
        {selectedWarehouse && (
          <p className="text-sm text-gray-600 mt-1">
            Ubicación: {selectedWarehouse.location}
          </p>
        )}
      </div>

      {/* Estado de Entrega */}
      <div>
        <label className="label">Estado de Entrega *</label>
        <select
          className={`input ${errors.delivery_status ? 'border-red-500' : ''}`}
          value={formData.delivery_status}
          onChange={(e) => setFormData(prev => ({ ...prev, delivery_status: e.target.value }))}
          disabled={isLoading}
        >
          <option value="">Seleccione un estado</option>
          {deliveryStatuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {errors.delivery_status && (
          <p className="text-sm text-red-600 mt-1">{errors.delivery_status}</p>
        )}
      </div>

      {/* Información adicional */}
      {formData.order > 0 && formData.warehouse_id > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Resumen del Envío</h4>
          <div className="text-sm text-blue-800 space-y-1">
            {selectedOrder && (
              <p>• Orden #{selectedOrder.id} - Total: ${parseFloat(selectedOrder.total.toString()).toLocaleString('es-CL')}</p>
            )}
            {selectedWarehouse && (
              <p>• Bodega: {selectedWarehouse.name} ({selectedWarehouse.location})</p>
            )}
            <p>• Fecha programada: {new Date(formData.shipment_date).toLocaleDateString('es-CL')}</p>
            <p>• Estado inicial: {formData.delivery_status}</p>
          </div>
        </div>
      )}

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
          {shipment ? 'Actualizar' : 'Registrar'} Envío
        </Button>
      </div>
    </form>
  );
};
