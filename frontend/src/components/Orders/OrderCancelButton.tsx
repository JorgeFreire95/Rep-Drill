import React, { useState } from 'react';
import { Button, Modal, message, Space, Alert } from 'antd';
import { CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { ventasService } from '../../services/ventasService';

interface OrderCancelButtonProps {
  orderId: number;
  orderStatus: string;
  orderNumber?: string;
  onCancel?: () => void;
}

export const OrderCancelButton: React.FC<OrderCancelButtonProps> = ({ 
  orderId, 
  orderStatus, 
  orderNumber,
  onCancel 
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      await ventasService.cancelOrderWithReservations(orderId);
      message.success({
        content: 'Orden cancelada exitosamente. Las reservas de stock han sido liberadas.',
        duration: 5,
      });
      setIsModalVisible(false);
      if (onCancel) {
        onCancel();
      }
    } catch (error: any) {
      console.error('Error canceling order:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Error al cancelar la orden';
      message.error({
        content: errorMessage,
        duration: 7,
      });
    } finally {
      setLoading(false);
    }
  };

  const showCancelModal = () => {
    setIsModalVisible(true);
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  // Solo mostrar botón si la orden está en estado PENDING o CONFIRMED
  if (!['PENDING', 'CONFIRMED'].includes(orderStatus)) {
    return null;
  }

  return (
    <>
      <Button
        danger
        icon={<CloseCircleOutlined />}
        onClick={showCancelModal}
        size="large"
      >
        Cancelar Orden
      </Button>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Cancelar Orden {orderNumber || `#${orderId}`}</span>
          </Space>
        }
        open={isModalVisible}
        onOk={handleCancel}
        onCancel={handleModalCancel}
        confirmLoading={loading}
        okText="Sí, Cancelar Orden"
        cancelText="No, Mantener"
        width={520}
        okButtonProps={{ danger: true }}
      >
        <Alert
          message="Acción de Cancelación"
          description="Esta acción cancelará permanentemente la orden"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>¿Está seguro que desea cancelar esta orden?</strong>
          </p>
          <p style={{ marginBottom: 8 }}>Al cancelar, el sistema realizará las siguientes acciones:</p>
        </div>

        <ul style={{ marginLeft: 20, marginBottom: 16 }}>
          {orderStatus === 'CONFIRMED' && (
            <li>↩ Devolverá el stock de los productos (uncommit de reservas)</li>
          )}
          {orderStatus === 'PENDING' && (
            <li>↩ Liberará las reservas de stock pendientes</li>
          )}
          <li>✕ Actualizará el estado de la orden a "CANCELADA"</li>
          <li>✕ La orden no podrá ser reactivada posteriormente</li>
        </ul>

        <Alert
          message="Nota"
          description={
            orderStatus === 'CONFIRMED'
              ? 'Al estar confirmada, el stock será devuelto al inventario disponible.'
              : 'Las reservas pendientes serán liberadas inmediatamente.'
          }
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>
    </>
  );
};

export default OrderCancelButton;
