import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  X,
} from 'lucide-react';

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
    name: 'Personas',
    path: '/personas',
    icon: <Users className="h-5 w-5" />,
  },
  {
    name: 'Inventario',
    path: '/inventario',
    icon: <Package className="h-5 w-5" />,
  },
  {
    name: 'Ventas',
    path: '/ventas',
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    name: 'Predicciones',
    path: '/predicciones',
    icon: <TrendingUp className="h-5 w-5" />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
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
