import React, { useState, useEffect } from 'react';
import { Card } from '../components/common';
import { DollarSign, Users, Package, TrendingUp, ShoppingCart, AlertTriangle } from 'lucide-react';
import { ventasService } from '../services/ventasService';
import { personasService } from '../services/personasService';
import { inventarioService } from '../services/inventarioService';

interface DashboardStats {
  ventas_hoy: string;
  ventas_mes: string;
  ventas_mes_anterior: string;
  ordenes_pendientes: number;
  ordenes_completadas: number;
  pagos_mes: string;
  envios_pendientes: number;
  productos_mas_vendidos: any[];
  ventas_diarias: { date: string; total: number }[];
}

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalClients, setTotalClients] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Cargar estadísticas de ventas
      const ventasStats = await ventasService.getDashboardStats();
      setStats(ventasStats);

      // Cargar total de clientes
      try {
        const clients = await personasService.getClientes();
        setTotalClients(clients.length);
      } catch (error) {
        console.error('Error cargando clientes:', error);
        setTotalClients(0);
      }

      // Cargar productos y calcular bajo stock
      try {
        const productos = await inventarioService.getProducts();
        setTotalProducts(productos.length);
        const lowStock = productos.filter(p => p.quantity <= p.min_stock);
        setLowStockProducts(lowStock.length);
      } catch (error) {
        console.error('Error cargando productos:', error);
        setTotalProducts(0);
        setLowStockProducts(0);
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePercentageChange = (current: string, previous: string): string => {
    const currentVal = parseFloat(current);
    const previousVal = parseFloat(previous);
    
    if (previousVal === 0) return '+0%';
    
    const change = ((currentVal - previousVal) / previousVal) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const percentageChange = calculatePercentageChange(stats.ventas_mes, stats.ventas_mes_anterior);

  const dashboardStats = [
    {
      title: 'Ventas del Mes',
      value: `$${parseFloat(stats.ventas_mes).toLocaleString('es-CL')}`,
      change: percentageChange,
      icon: <DollarSign className="h-8 w-8" />,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Total Clientes',
      value: totalClients.toString(),
      subtitle: `${stats.ordenes_completadas} órdenes completadas`,
      icon: <Users className="h-8 w-8" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Total Productos',
      value: totalProducts.toString(),
      subtitle: `${lowStockProducts} con stock bajo`,
      icon: <Package className="h-8 w-8" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Órdenes Pendientes',
      value: stats.ordenes_pendientes.toString(),
      subtitle: `${stats.envios_pendientes} envíos pendientes`,
      icon: <ShoppingCart className="h-8 w-8" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Resumen general del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardStats.map((stat, index) => (
          <Card key={index}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-sm mt-2 text-gray-600">
                  {stat.change ? (
                    <span className={stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                      {stat.change} vs mes anterior
                    </span>
                  ) : (
                    stat.subtitle
                  )}
                </p>
              </div>
              <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                {stat.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ventas de la Semana" subtitle="Últimos 7 días">
          <div className="space-y-2">
            {stats.ventas_diarias.map((day, index) => {
              const date = new Date(day.date);
              const isToday = date.toDateString() === new Date().toDateString();
              const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString();
              
              let dateLabel = date.toLocaleDateString('es-CL', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'short' 
              });
              
              // Capitalizar primera letra
              dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
              
              return (
                <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
                  isToday ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {dateLabel}
                        {isToday && <span className="ml-2 text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">Hoy</span>}
                        {isYesterday && <span className="ml-2 text-xs font-semibold text-gray-600 bg-gray-200 px-2 py-1 rounded">Ayer</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      isToday ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      ${day.total.toLocaleString('es-CL')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {day.total === 0 ? 'Sin ventas' : `${index === 0 ? 'Más antiguo' : index === stats.ventas_diarias.length - 1 ? 'Más reciente' : ''}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Productos Más Vendidos" subtitle="Top del mes">
          {stats.productos_mas_vendidos.length > 0 ? (
            <div className="space-y-4">
              {stats.productos_mas_vendidos.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {item.product_name || `Producto #${item.product_id}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.total_quantity} unidades vendidas
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-gray-900">
                      ${parseFloat(item.total_sales || 0).toLocaleString('es-CL')}
                    </p>
                    <p className="text-sm text-gray-500">Total ventas</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              <p>No hay datos de productos vendidos este mes</p>
            </div>
          )}
        </Card>
      </div>

      {/* Alerts Section */}
      <div className="mt-6">
        <Card title="Alertas y Notificaciones" subtitle="Requieren atención">
          <div className="space-y-3">
            {lowStockProducts > 0 && (
              <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{lowStockProducts} productos con stock bajo</p>
                  <p className="text-sm text-gray-600">Revisa el inventario para evitar desabastecimiento</p>
                </div>
              </div>
            )}
            
            {stats.ordenes_pendientes > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{stats.ordenes_pendientes} órdenes pendientes</p>
                  <p className="text-sm text-gray-600">Hay órdenes esperando confirmación o pago</p>
                </div>
              </div>
            )}
            
            {stats.envios_pendientes > 0 && (
              <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{stats.envios_pendientes} envíos pendientes</p>
                  <p className="text-sm text-gray-600">Envíos que requieren procesamiento o están en tránsito</p>
                </div>
              </div>
            )}
            
            {lowStockProducts === 0 && stats.ordenes_pendientes === 0 && stats.envios_pendientes === 0 && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">¡Todo en orden!</p>
                  <p className="text-sm text-gray-600">No hay alertas pendientes en este momento</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
