import React, { useState, useEffect } from 'react';
import { Card, Table, Space, Tag, Statistic, Row, Col, Button, message, Progress, Tooltip, Modal } from 'antd';
import { 
  ClockCircleOutlined, 
  ReloadOutlined, 
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';
import { inventarioService } from '../services/inventarioService';
import type { StockReservation, ReservationSummary } from '../types';

/**
 * Dashboard de Reservas Activas de Stock
 * Muestra todas las reservas activas con countdown timer de TTL
 */
export const ActiveReservationsDashboard: React.FC = () => {
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [summary, setSummary] = useState<ReservationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadReservations();
    
    // Update current time every second for countdown
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Auto-refresh every 30 seconds
    const refreshTimer = setInterval(() => {
      loadReservations();
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(refreshTimer);
    };
  }, []);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const data = await inventarioService.getActiveReservations();
      setSummary(data);
      setReservations(data.reservations || []);
    } catch (error) {
      console.error('Error loading reservations:', error);
      message.error('Error al cargar las reservas activas');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async (id: number) => {
    try {
      await inventarioService.releaseReservation(id);
      message.success('Reserva liberada exitosamente');
      loadReservations();
    } catch (error) {
      console.error('Error releasing reservation:', error);
      message.error('Error al liberar la reserva');
    }
  };

  const calculateTimeRemaining = (expiresAt: string | null): {
    minutes: number;
    seconds: number;
    percentage: number;
    isExpiring: boolean;
  } => {
    if (!expiresAt) {
      return { minutes: 0, seconds: 0, percentage: 0, isExpiring: false };
    }

    const expiryTime = new Date(expiresAt);
    const diffMs = expiryTime.getTime() - currentTime.getTime();
    
    if (diffMs <= 0) {
      return { minutes: 0, seconds: 0, percentage: 0, isExpiring: true };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    // Assume 30 minutes TTL for percentage calculation
    const totalTTLSeconds = 30 * 60;
    const percentage = (totalSeconds / totalTTLSeconds) * 100;
    const isExpiring = percentage < 20; // Less than 20% time remaining

    return { minutes, seconds, percentage, isExpiring };
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: 'orange',
      confirmed: 'green',
      released: 'blue',
      expired: 'red',
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
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
      width: 100,
      render: (quantity: number) => (
        <Tag color="blue">{quantity} unidades</Tag>
      ),
    },
    {
      title: 'Orden',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 120,
      render: (orderId: string | null) => orderId || <Tag>Sin asignar</Tag>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Tiempo Restante',
      key: 'timeRemaining',
      width: 200,
      render: (_: any, record: StockReservation) => {
        if (record.status !== 'pending') {
          return <Tag color="default">N/A</Tag>;
        }

        const { minutes, seconds, percentage, isExpiring } = calculateTimeRemaining(record.expires_at);
        
        if (minutes === 0 && seconds === 0) {
          return (
            <Tag icon={<WarningOutlined />} color="error">
              EXPIRADA
            </Tag>
          );
        }

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ 
              color: isExpiring ? '#ff4d4f' : '#52c41a',
              fontWeight: 500 
            }}>
              {minutes}m {seconds}s
            </div>
            <Progress 
              percent={percentage} 
              showInfo={false} 
              size="small"
              strokeColor={isExpiring ? '#ff4d4f' : '#52c41a'}
            />
          </Space>
        );
      },
    },
    {
      title: 'Reservado',
      dataIndex: 'reserved_at',
      key: 'reserved_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      render: (_: any, record: StockReservation) => {
        if (record.status !== 'pending') {
          return null;
        }

        return (
          <Button 
            size="small" 
            danger
            onClick={() => {
              Modal.confirm({
                title: 'Liberar Reserva',
                content: `¿Está seguro que desea liberar esta reserva de ${record.quantity} unidades?`,
                okText: 'Sí, Liberar',
                cancelText: 'Cancelar',
                onOk: () => handleRelease(record.id),
              });
            }}
          >
            Liberar
          </Button>
        );
      },
    },
  ];

  const expiringCount = reservations.filter(r => {
    if (r.status !== 'pending' || !r.expires_at) return false;
    const { isExpiring } = calculateTimeRemaining(r.expires_at);
    return isExpiring;
  }).length;

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Dashboard de Reservas Activas</h1>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadReservations}
            loading={loading}
          >
            Actualizar
          </Button>
        </div>

        {/* Summary Cards */}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Reservas Activas"
                value={summary?.active_count || 0}
                prefix={<InfoCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Unidades Reservadas"
                value={summary?.total_reserved_quantity || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Por Expirar"
                value={expiringCount}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
                suffix={
                  <Tooltip title="Menos del 20% de tiempo restante">
                    <WarningOutlined style={{ fontSize: '16px', marginLeft: '8px' }} />
                  </Tooltip>
                }
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Próximas a Expirar"
                value={summary?.expiring_soon || 0}
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Info Alert */}
        <Card 
          type="inner" 
          title="ℹ️ Información sobre Reservas"
          style={{ backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}
        >
          <Space direction="vertical">
            <div>
              • Las reservas tienen un TTL (Time To Live) de <strong>30 minutos</strong>
            </div>
            <div>
              • Después de expirar, el stock se libera automáticamente
            </div>
            <div>
              • Puedes liberar manualmente una reserva antes de que expire
            </div>
            <div>
              • Las reservas confirmadas ya no pueden ser liberadas (stock descontado)
            </div>
          </Space>
        </Card>

        {/* Reservations Table */}
        <Card title="Listado de Reservas">
          <Table
            columns={columns}
            dataSource={reservations}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} reservas`,
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default ActiveReservationsDashboard;
