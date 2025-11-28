import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  UserCog,
  X,
  BarChart3,
  ClipboardList,
  Truck,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import { inventarioService } from '../../services/inventarioService';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    name: 'Proveedores',
    path: '/proveedores',
    icon: <Truck className="h-5 w-5" />,
  },
  {
    name: 'Personas',
    path: '/personas',
    icon: <Users className="h-5 w-5" />,
  },
  {
    name: 'Inventario',
    path: '/inventario',
    icon: <Package className="h-5 w-5" />,
  },
  // {
  //   name: 'Reservas Activas',
  //   path: '/reservations',
  //   icon: <Clock className="h-5 w-5" />,
  // },
  {
    name: 'Reposición',
    path: '/reordenes',
    icon: <ClipboardList className="h-5 w-5" />,
  },
  {
    name: 'Ventas',
    path: '/ventas',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    name: 'Crear Orden',
    path: '/crear-orden',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    name: 'Predicciones',
    path: '/forecasting',
    icon: <BarChart3 className="h-5 w-5" />,
  },
  // {
  //   name: 'Precisión Pronósticos',
  //   path: '/forecast-accuracy',
  //   icon: <TrendingUp className="h-5 w-5" />,
  // },
  {
    name: 'Reportes',
    path: '/reportes',
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    name: 'Auditoría',
    path: '/auditoria',
    icon: <History className="h-5 w-5" />,
  },
  {
    name: 'Usuarios',
    path: '/usuarios',
    icon: <UserCog className="h-5 w-5" />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [hasCritical, setHasCritical] = useState<boolean>(false);
  const [requestedReordersCount, setRequestedReordersCount] = useState<number>(0);

  // Cargar contador de stock bajo
  useEffect(() => {
    const loadLowStockCount = async () => {
      try {
        const response = await inventarioService.getLowStockCount();
        setLowStockCount(response.count);
        setCriticalCount(response.critical);
        setHasCritical(response.has_critical);
      } catch (error) {
        logger.error('Error cargando contador de stock bajo:', error);
      }
    };

    // Cargar inmediatamente
    loadLowStockCount();

    // Actualizar cada 30 segundos
    const interval = setInterval(loadLowStockCount, 30000);

    return () => clearInterval(interval);
  }, []);

  // Cargar contador de reordenes solicitadas
  useEffect(() => {
    const loadRequestedReorders = async () => {
      try {
        const count = await inventarioService.countRequestedReorders();
        setRequestedReordersCount(count);
      } catch (error) {
        logger.error('Error cargando contador de reordenes solicitadas:', error);
      }
    };

    loadRequestedReorders();
    const interval = setInterval(loadRequestedReorders, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Backdrop móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header del sidebar (solo móvil) */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">RD</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Rep Drill</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Navegación */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              {item.icon}
              <span>{item.name}</span>
                {/* Badge de alertas de stock solo en Inventario */}
                {item.path === '/inventario' && lowStockCount > 0 && (
                  <span 
                    className={`ml-auto text-white text-xs font-bold px-2 py-1 rounded-full ${
                      hasCritical 
                        ? 'bg-red-600 animate-pulse' 
                        : 'bg-yellow-500'
                    }`}
                    title={hasCritical ? `${criticalCount} crítico(s), ${lowStockCount} total` : `${lowStockCount} alerta(s)`}
                  >
                    {lowStockCount}
                  </span>
                )}
                {/* Badge de reordenes solicitadas */}
                {item.path === '/reordenes' && requestedReordersCount > 0 && (
                  <span 
                    className="ml-auto text-white text-xs font-bold px-2 py-1 rounded-full bg-blue-600"
                    title={`${requestedReordersCount} solicitud(es) pendiente(s)`}
                  >
                    {requestedReordersCount}
                  </span>
                )}
            </NavLink>
          ))}
        </nav>

        {/* Footer del sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            <p>Rep Drill v1.0.0</p>
            <p className="mt-1">© 2025 Todos los derechos reservados</p>
          </div>
        </div>
      </aside>
    </>
  );
};
