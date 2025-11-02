import React from 'react';
import type { UserListResponse } from '../../services/userManagementService';
import { Mail, Phone, Shield, Calendar, CheckCircle, XCircle, User as UserIcon } from 'lucide-react';

interface UserDetailsProps {
  user: UserListResponse;
}

export const UserDetails: React.FC<UserDetailsProps> = ({ user }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No disponible';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Avatar y Nombre */}
      <div className="flex items-center space-x-4 pb-6 border-b">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={user.full_name}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-primary-100 flex items-center justify-center">
            <UserIcon className="h-10 w-10 text-primary-700" />
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{user.full_name}</h2>
          <p className="text-sm text-gray-500">ID: {user.id}</p>
        </div>
      </div>

      {/* Información de Contacto */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Información de Contacto
        </h3>
        <div className="space-y-3">
          <div className="flex items-center text-gray-700">
            <Mail className="h-5 w-5 mr-3 text-gray-400" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center text-gray-700">
            <Phone className="h-5 w-5 mr-3 text-gray-400" />
            <div>
              <p className="text-sm font-medium">Teléfono</p>
              <p className="text-sm">{user.phone || 'No especificado'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rol y Permisos */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Rol y Permisos</h3>
        <div className="space-y-3">
          <div className="flex items-center text-gray-700">
            <Shield className="h-5 w-5 mr-3 text-gray-400" />
            <div>
              <p className="text-sm font-medium">Rol Asignado</p>
              <p className="text-sm">
                {user.role ? user.role.description : 'Sin rol asignado'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="flex items-center">
              {user.is_staff ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              <span className="text-sm text-gray-700">Acceso Admin</span>
            </div>
            <div className="flex items-center">
              {user.is_verified ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              <span className="text-sm text-gray-700">Email Verificado</span>
            </div>
            <div className="flex items-center">
              {user.is_active ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              <span className="text-sm text-gray-700">Cuenta Activa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actividad */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Actividad</h3>
        <div className="space-y-3">
          <div className="flex items-start text-gray-700">
            <Calendar className="h-5 w-5 mr-3 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Fecha de Registro</p>
              <p className="text-sm">{formatDate(user.created_at)}</p>
            </div>
          </div>
          <div className="flex items-start text-gray-700">
            <Calendar className="h-5 w-5 mr-3 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Último Acceso</p>
              <p className="text-sm">{formatDate(user.last_login)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estado General */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Estado General</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Estado de la Cuenta</p>
            <p className={`text-sm font-medium ${user.is_active ? 'text-green-700' : 'text-red-700'}`}>
              {user.is_active ? 'Activa' : 'Inactiva'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Verificación</p>
            <p className={`text-sm font-medium ${user.is_verified ? 'text-green-700' : 'text-yellow-700'}`}>
              {user.is_verified ? 'Verificado' : 'Pendiente'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
