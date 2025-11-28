import React, { useState, useEffect } from 'react';
import { Card, Table, Space, Button, message, Spin, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { ventasService } from '../services/ventasService';
import { OrderConfirmButton, OrderCancelButton, OrderStatusBadge } from '../components/Orders';
import type { Order } from '../types';

const { Title } = Typography;

/**
 * Ejemplo de página que muestra cómo usar los nuevos componentes de confirmación y cancelación de órdenes.
 * 
 * Integración con el sistema de reservas de stock implementado en el backend.
 */
export const OrderManagementExample: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await ventasService.getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      message.error('Error al cargar las órdenes');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderConfirmed = () => {
    message.info('Recargando órdenes...');
    loadOrders();
  };

  const handleOrderCancelled = () => {
    message.info('Recargando órdenes...');
    loadOrders();
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Cliente',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Fecha',
      dataIndex: 'order_date',
      key: 'order_date',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => `$${total.toLocaleString()}`,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <OrderStatusBadge status={status} />,
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Order) => (
        <Space>
          <OrderConfirmButton
            orderId={record.id}
            orderStatus={record.status}
            orderNumber={`ORD-${record.id.toString().padStart(6, '0')}`}
            onConfirm={handleOrderConfirmed}
          />
          <OrderCancelButton
            orderId={record.id}
            orderStatus={record.status}
            orderNumber={`ORD-${record.id.toString().padStart(6, '0')}`}
            onCancel={handleOrderCancelled}
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2}>Gestión de Órdenes</Title>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadOrders}
              loading={loading}
            >
              Recargar
            </Button>
          </div>

          <Card 
            type="inner" 
            title="💡 Información sobre el Sistema de Reservas"
            style={{ backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}
          >
            <ul style={{ marginLeft: 20, marginBottom: 0 }}>
              <li>
                <strong>Órdenes PENDIENTES:</strong> Tienen reservas de stock activas. Pueden ser confirmadas o canceladas.
              </li>
              <li>
                <strong>Confirmar Orden:</strong> Descuenta el stock definitivamente y confirma las reservas. Si falla, 
                se hace rollback automático.
              </li>
              <li>
                <strong>Cancelar Orden:</strong> Libera las reservas (si está pendiente) o devuelve el stock (si está confirmada).
              </li>
              <li>
                <strong>TTL de Reservas:</strong> Las reservas expiran automáticamente después de 30 minutos si no se confirman.
              </li>
            </ul>
          </Card>

          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total: ${total} órdenes`,
              }}
              scroll={{ x: 1000 }}
            />
          </Spin>
        </Space>
      </Card>
    </div>
  );
};

export default OrderManagementExample;
