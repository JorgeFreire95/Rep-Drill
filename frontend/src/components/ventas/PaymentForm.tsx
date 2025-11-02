import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import type { Payment, Order } from '../../types';
import { Button } from '../common';
import { ventasService } from '../../services/ventasService';
import { formatCLP } from '../../utils/currencyUtils';

interface PaymentFormProps {
  payment?: Payment;
  orderId?: number;
  onSubmit: (data: { order: number; amount: string; payment_method: string }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  payment,
  orderId,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [formData, setFormData] = useState({
    order: payment?.order || orderId || 0,
    amount: payment?.amount || '',
    payment_method: payment?.payment_method || '',
  });

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await ventasService.getAllOrders();
      // Filtrar solo órdenes que pueden recibir pagos (no completadas ni canceladas)
      const payableOrders = data.filter(
        order => order.status !== 'COMPLETED' && order.status !== 'CANCELLED'
      );
      setOrders(payableOrders);
    } catch (error) {
      logger.error('Error cargando órdenes:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const paymentMethods = [
    'Efectivo',
    'Tarjeta de Crédito',
    'Tarjeta de Débito',
    'Transferencia Bancaria',
    'Cheque',
    'PayPal',
    'Otro',
  ];

  const validate = (): boolean => {
    const newErrors: any = {};

    if (!formData.order || formData.order === 0) {
      newErrors.order = 'Debe seleccionar una orden';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'El monto debe ser mayor a 0';
    }

    if (!formData.payment_method || formData.payment_method.trim() === '') {
      newErrors.payment_method = 'Debe seleccionar un método de pago';
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
      logger.error('Error al guardar pago:', error);
    }
  };

  const selectedOrder = orders.find(o => o.id === formData.order);

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
          {orders.length === 0 && !loadingOrders ? (
            <option disabled>No hay órdenes pendientes de pago</option>
          ) : (
            orders.map(order => (
              <option key={order.id} value={order.id}>
                Orden #{order.id} - Cliente #{order.customer_id} - Total: {formatCLP(order.total)} - Estado: {order.status}
              </option>
            ))
          )}
        </select>
        {errors.order && (
          <p className="text-sm text-red-600 mt-1">{errors.order}</p>
        )}
        {selectedOrder && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 font-semibold">
              Total de la orden: {formatCLP(selectedOrder.total)}
            </p>
            <p className="text-sm text-blue-800 mt-1">
              Estado: {selectedOrder.status}
            </p>
          </div>
        )}
      </div>

      {/* Monto */}
      <div>
        <label className="label">Monto a Pagar *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className={`input pl-8 ${errors.amount ? 'border-red-500' : ''}`}
            value={formData.amount || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>
        {errors.amount && (
          <p className="text-sm text-red-600 mt-1">{errors.amount}</p>
        )}
        {selectedOrder && parseFloat(formData.amount) > 0 && (
          <p className="text-sm text-gray-600 mt-1">
            {parseFloat(formData.amount) < parseFloat(selectedOrder.total.toString())
              ? `Pago parcial: ${formatCLP(formData.amount)} de ${formatCLP(selectedOrder.total)}`
              : parseFloat(formData.amount) === parseFloat(selectedOrder.total.toString())
              ? '✅ Pago completo'
              : '⚠️ El monto excede el total de la orden'}
          </p>
        )}
      </div>

      {/* Método de Pago */}
      <div>
        <label className="label">Método de Pago *</label>
        <select
          className={`input ${errors.payment_method ? 'border-red-500' : ''}`}
          value={formData.payment_method}
          onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
          disabled={isLoading}
        >
          <option value="">Seleccione un método</option>
          {paymentMethods.map(method => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        {errors.payment_method && (
          <p className="text-sm text-red-600 mt-1">{errors.payment_method}</p>
        )}
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
          {payment ? 'Actualizar' : 'Registrar'} Pago
        </Button>
      </div>
    </form>
  );
};
