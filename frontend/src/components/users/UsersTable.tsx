import React from 'react';
import { Edit, Trash2, UserX, UserCheck, Shield, Eye } from 'lucide-react';
import type { UserListResponse } from '../../services/userManagementService';
import { Button } from '../common';

interface UsersTableProps {
  users: UserListResponse[];
  loading?: boolean;
  onEdit: (user: UserListResponse) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (id: number, currentStatus: boolean) => void;
  onViewDetails: (user: UserListResponse) => void;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  employee: 'bg-green-100 text-green-800',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Empleado',
};

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  loading,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay usuarios</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza creando un nuevo usuario del sistema.
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Usuario
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rol
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Último acceso
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {user.avatar ? (
                    <img
                      className="h-10 w-10 rounded-full"
                      src={user.avatar}
                      alt={user.full_name}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-700 font-medium text-sm">
                        {user.first_name.charAt(0)}
                        {user.last_name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name}
                    </div>
                    <div className="text-sm text-gray-500">{user.phone || 'Sin teléfono'}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{user.email}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  {user.is_verified ? (
                    <>
                      <span className="text-green-600">✓</span>
                      Verificado
                    </>
                  ) : (
                    <>
                      <span className="text-yellow-600">⚠</span>
                      No verificado
                    </>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {user.role ? (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      ROLE_COLORS[user.role.name] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {user.is_staff && <Shield className="w-3 h-3 mr-1" />}
                    {ROLE_LABELS[user.role.name] || user.role.name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Sin rol</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {user.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{formatDate(user.last_login)}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(user)}
                    icon={<Eye className="h-4 w-4" />}
                    title="Ver detalles"
                  >
                    {''}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(user)}
                    icon={<Edit className="h-4 w-4" />}
                    title="Editar"
                  >
                    {''}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleStatus(user.id, user.is_active)}
                    className={
                      user.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'
                    }
                    icon={
                      user.is_active ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )
                    }
                    title={user.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {''}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(user.id)}
                    className="text-red-600 hover:text-red-700"
                    icon={<Trash2 className="h-4 w-4" />}
                    title="Eliminar"
                  >
                    {''}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
