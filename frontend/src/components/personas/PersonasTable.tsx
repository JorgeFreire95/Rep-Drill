import React from 'react';
import { Edit, Trash2, User, UserCheck } from 'lucide-react';
import type { Persona } from '../../types';
import { Button } from '../common';

interface PersonasTableProps {
  personas: Persona[];
  isLoading: boolean;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
}

export const PersonasTable: React.FC<PersonasTableProps> = ({
  personas,
  isLoading,
  onEdit,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay personas</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza agregando un cliente o proveedor.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Documento
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Contacto
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tipo
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {personas.map((persona) => (
            <tr key={persona.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{persona.nombre}</div>
                {persona.direccion && (
                  <div className="text-sm text-gray-500">{persona.direccion}</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{persona.tipo_documento}</div>
                <div className="text-sm text-gray-500">{persona.numero_documento}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {persona.email && (
                  <div className="text-sm text-gray-900">{persona.email}</div>
                )}
                {persona.telefono && (
                  <div className="text-sm text-gray-500">{persona.telefono}</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex gap-2">
                  {persona.es_cliente && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <UserCheck className="w-3 h-3 mr-1" />
                      Cliente
                    </span>
                  )}
                  {persona.es_proveedor && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <User className="w-3 h-3 mr-1" />
                      Proveedor
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(persona)}
                    icon={<Edit className="h-4 w-4" />}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(persona)}
                    icon={<Trash2 className="h-4 w-4" />}
                  >
                    Eliminar
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
