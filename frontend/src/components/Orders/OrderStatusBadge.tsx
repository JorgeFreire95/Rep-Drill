import React from 'react';
import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  CarOutlined,
  HomeOutlined,
  CheckOutlined,
} from '@ant-design/icons';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'small' | 'default' | 'large';
}

interface StatusConfig {
  color: string;
  icon: React.ReactNode;
  text: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: {
    color: 'orange',
    icon: <ClockCircleOutlined />,
    text: 'Pendiente',
  },
  CONFIRMED: {
    color: 'green',
    icon: <CheckCircleOutlined />,
    text: 'Confirmada',
  },
  PROCESSING: {
    color: 'blue',
    icon: <SyncOutlined spin />,
    text: 'Procesando',
  },
  SHIPPED: {
    color: 'cyan',
    icon: <CarOutlined />,
    text: 'Enviada',
  },
  DELIVERED: {
    color: 'geekblue',
    icon: <HomeOutlined />,
    text: 'Entregada',
  },
  COMPLETED: {
    color: 'success',
    icon: <CheckOutlined />,
    text: 'Completada',
  },
  CANCELLED: {
    color: 'red',
    icon: <CloseCircleOutlined />,
    text: 'Cancelada',
  },
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, size = 'default' }) => {
  const config = STATUS_CONFIG[status] || {
    color: 'default',
    icon: null,
    text: status,
  };

  const fontSize = size === 'large' ? '14px' : size === 'small' ? '12px' : '13px';
  const padding = size === 'large' ? '6px 12px' : size === 'small' ? '2px 8px' : '4px 10px';

  return (
    <Tag
      color={config.color}
      icon={config.icon}
      style={{
        fontSize,
        padding,
        fontWeight: 500,
        borderRadius: '4px',
      }}
    >
      {config.text}
    </Tag>
  );
};

export default OrderStatusBadge;
