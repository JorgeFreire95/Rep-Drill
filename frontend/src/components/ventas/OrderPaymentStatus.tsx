import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { CheckCircle, Clock, AlertCircle, Package } from 'lucide-react';
import { ventasService } from '../../services/ventasService';
import { formatCLP } from '../../utils/currencyUtils';
import { useInventoryNotifier } from '../../hooks/useInventoryUpdates';

interface OrderPaymentStatusProps {
  orderId: number;
  onInventoryUpdated?: () => void;
}

export const OrderPaymentStatus: React.FC<OrderPaymentStatusProps> = ({ 
  orderId,
  onInventoryUpdated 
}) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { notifyInventoryUpdate } = useInventoryNotifier();

  useEffect(() => {
    loadPaymentStatus();
    
    // Actualizar cada 5 segundos si no está completamente pagado
    const interval = setInterval(() => {
      if (status && !status.is_fully_paid) {
        loadPaymentStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [orderId]);

  const loadPaymentStatus = async () => {
    try {
      const data = await ventasService.getOrderPaymentStatus(orderId);
      
      // Si el inventario acaba de actualizarse, notificar
      if (data.inventory_updated && status && !status.inventory_updated) {
        // Notificar al callback local si existe
        if (onInventoryUpdated) {
          onInventoryUpdated();
        }
        // Notificar globalmente a otros componentes
        notifyInventoryUpdate();
        logger.info('📦 Inventario actualizado - notificando a otros componentes');
      }
      
      setStatus(data);
    } catch (error) {
      logger.error('Error cargando estado de pago:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg p-4">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const getStatusIcon = () => {
    if (status.is_fully_paid && status.inventory_updated) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    if (status.is_fully_paid && !status.inventory_updated) {
      return <Clock className="w-5 h-5 text-yellow-600" />;
    }
    return <AlertCircle className="w-5 h-5 text-orange-600" />;
  };

  const getStatusColor = () => {
    if (status.is_fully_paid && status.inventory_updated) {
      return 'bg-green-50 border-green-200';
    }
    if (status.is_fully_paid && !status.inventory_updated) {
      return 'bg-yellow-50 border-yellow-200';
    }
    return 'bg-orange-50 border-orange-200';
  };

  const getStatusText = () => {
    if (status.is_fully_paid && status.inventory_updated) {
      return '✅ Pago completado - Inventario actualizado';
    }
    if (status.is_fully_paid && !status.inventory_updated) {
      return '⏳ Pago completado - Actualizando inventario...';
    }
    return '📋 Pago pendiente';
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${getStatusColor()}`}>
      <div className="flex items-start gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-2">
            {getStatusText()}
          </h3>
          
          {/* Barra de progreso */}
          <div className="mb-3">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progreso del pago</span>
              <span className="font-medium">{status.payment_percentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  status.is_fully_paid ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(status.payment_percentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Información de pagos */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total de la orden:</p>
              <p className="font-semibold text-gray-900">
                {formatCLP(status.total)}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Total pagado:</p>
              <p className="font-semibold text-green-700">
                {formatCLP(status.total_paid)}
              </p>
            </div>
            {parseFloat(status.remaining) > 0 && (
              <div className="col-span-2">
                <p className="text-gray-600">Monto restante:</p>
                <p className="font-semibold text-orange-700">
                  {formatCLP(status.remaining)}
                </p>
              </div>
            )}
          </div>

          {/* Estado del inventario */}
          {status.is_fully_paid && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span className="text-sm">
                  {status.inventory_updated ? (
                    <span className="text-green-700 font-medium">
                      ✅ Stock actualizado automáticamente
                    </span>
                  ) : (
                    <span className="text-yellow-700 font-medium animate-pulse">
                      ⏳ Actualizando stock...
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
