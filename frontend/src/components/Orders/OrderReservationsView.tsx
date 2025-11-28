import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Spin, Alert, Divider } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { inventarioService } from '../../services/inventarioService';
import type { StockReservation } from '../../types';

interface OrderReservationsViewProps {
  orderId: string;
  orderNumber?: string;
}

/**
 * Vista de reservas asociadas a una orden específica
 * Para integrar en el detalle de orden
 */
export const OrderReservationsView: React.FC<OrderReservationsViewProps> = ({ 
  orderId, 
  orderNumber 
}) => {
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadReservations();

    // Update time every second for countdown
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [orderId]);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const data = await inventarioService.getReservationsByOrder(orderId);
      setReservations(data);
    } catch (error) {
      console.error('Error loading order reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeRemaining = (expiresAt: string | null): string => {
    if (!expiresAt) return 'N/A';

    const expiryTime = new Date(expiresAt);
    const diffMs = expiryTime.getTime() - currentTime.getTime();
    
    if (diffMs <= 0) return 'Expirada';

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes}m ${seconds}s`;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <ClockCircleOutlined style={{ color: '#faad14' }} />,
      confirmed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      released: <CloseCircleOutlined style={{ color: '#1890ff' }} />,
      expired: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
    };
    return icons[status] || null;
  };

  const columns = [
    {
      title: 'Producto',
      dataIndex: 'product_name',
      key: 'product_name',
      render: (name: string, record: StockReservation) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name || `Producto #${record.product}`}</div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>ID: {record.product}</div>
        </div>
      ),
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (quantity: number) => (
        <Tag color="blue">{quantity} unidades</Tag>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => (
        <Space>
          {getStatusIcon(status)}
          <span style={{ textTransform: 'capitalize' }}>{status}</span>
        </Space>
      ),
    },
    {
      title: 'Tiempo Restante',
      key: 'timeRemaining',
      width: 150,
      render: (_: any, record: StockReservation) => {
        if (record.status !== 'pending') {
          return <Tag>N/A</Tag>;
        }
        
        const timeStr = calculateTimeRemaining(record.expires_at);
        const isExpiring = timeStr.includes('Expirada') || 
                          (parseInt(timeStr) < 5 && timeStr.includes('m'));
        
        return (
          <Tag color={isExpiring ? 'error' : 'success'}>
            {timeStr}
          </Tag>
        );
      },
    },
    {
      title: 'Reservado',
      dataIndex: 'reserved_at',
      key: 'reserved_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ];

  if (loading) {
    return (
      <Card title="Reservas de Stock">
        <Spin tip="Cargando reservas..." />
      </Card>
    );
  }

  if (reservations.length === 0) {
    return (
      <Card title="Reservas de Stock">
        <Alert
          message="Sin Reservas"
          description="Esta orden no tiene reservas de stock asociadas."
          type="info"
          showIcon
        />
      </Card>
    );
  }

  const pendingCount = reservations.filter(r => r.status === 'pending').length;
  const confirmedCount = reservations.filter(r => r.status === 'confirmed').length;
  const totalQuantity = reservations.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <Card 
      title={
        <Space>
          <span>Reservas de Stock</span>
          {orderNumber && <Tag color="blue">{orderNumber}</Tag>}
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Summary */}
        <div>
          <Space size="large">
            <div>
              <strong>Total Reservas:</strong> {reservations.length}
            </div>
            <Divider type="vertical" />
            <div>
              <strong>Pendientes:</strong> <Tag color="orange">{pendingCount}</Tag>
            </div>
            <Divider type="vertical" />
            <div>
              <strong>Confirmadas:</strong> <Tag color="green">{confirmedCount}</Tag>
            </div>
            <Divider type="vertical" />
            <div>
              <strong>Total Unidades:</strong> <Tag color="blue">{totalQuantity}</Tag>
            </div>
          </Space>
        </div>

        {/* Info Alert for Pending */}
        {pendingCount > 0 && (
          <Alert
            message="Reservas Pendientes"
            description="Hay reservas pendientes. Confirme la orden para aplicar los descuentos de stock o cancele para liberar las reservas."
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
          />
        )}

        {/* Table */}
        <Table
          columns={columns}
          dataSource={reservations}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Space>
    </Card>
  );
};

export default OrderReservationsView;
