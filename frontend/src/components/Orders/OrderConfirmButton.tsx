import React, { useState } from 'react';
import { Button, Modal, message, Space, Alert } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { ventasService } from '../../services/ventasService';

interface OrderConfirmButtonProps {
  orderId: number;
  orderStatus: string;
  orderNumber?: string;
  onConfirm?: () => void;
}

export const OrderConfirmButton: React.FC<OrderConfirmButtonProps> = ({ 
  orderId, 
  orderStatus, 
  orderNumber,
  onConfirm 
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await ventasService.confirmOrder(orderId);
      message.success({
        content: 'Orden confirmada exitosamente. Stock actualizado y reservas confirmadas.',
        duration: 5,
      });
      setIsModalVisible(false);
      if (onConfirm) {
        onConfirm();
      }
    } catch (error: any) {
      console.error('Error confirming order:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.detail || 'Error al confirmar la orden';
      message.error({
        content: `${errorMessage}. Verifique que haya stock suficiente disponible.`,
        duration: 7,
      });
    } finally {
      setLoading(false);
    }
  };

  const showConfirmModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  // Solo mostrar botón si la orden está en estado PENDING
  if (orderStatus !== 'PENDING') {
    return null;
  }

  return (
    <>
      <Button
        type="primary"
        icon={<CheckCircleOutlined />}
        onClick={showConfirmModal}
        size="large"
      >
        Confirmar Orden
      </Button>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>Confirmar Orden {orderNumber || `#${orderId}`}</span>
          </Space>
        }
        open={isModalVisible}
        onOk={handleConfirm}
        onCancel={handleCancel}
        confirmLoading={loading}
        okText="Sí, Confirmar"
        cancelText="Cancelar"
        width={520}
        okButtonProps={{ danger: false, type: 'primary' }}
      >
        <Alert
          message="Acción Importante"
          description="Esta acción es irreversible"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>¿Está seguro que desea confirmar esta orden?</strong>
          </p>
          <p style={{ marginBottom: 8 }}>Al confirmar, el sistema realizará las siguientes acciones:</p>
        </div>

        <ul style={{ marginLeft: 20, marginBottom: 16 }}>
          <li>✓ Descontará el stock de los productos definitivamente</li>
          <li>✓ Confirmará todas las reservas de stock asociadas</li>
          <li>✓ Actualizará el estado de la orden a "CONFIRMADA"</li>
          <li>✓ Invalidará el caché de pronósticos de los productos afectados</li>
        </ul>

        <Alert
          message="Nota"
          description="Si no hay stock suficiente disponible, la confirmación fallará y se revertirán todos los cambios automáticamente (rollback)."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Modal>
    </>
  );
};

export default OrderConfirmButton;
