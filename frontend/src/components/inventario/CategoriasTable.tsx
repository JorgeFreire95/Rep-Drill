import React from 'react';
import { Edit, Trash2, Tag } from 'lucide-react';
import type { Category } from '../../types';
import { Button } from '../common';

interface CategoriasTableProps {
  categorias: Category[];
  isLoading: boolean;
  onEdit: (categoria: Category) => void;
  onDelete: (categoria: Category) => void;
}

export const CategoriasTable: React.FC<CategoriasTableProps> = ({
  categorias,
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

  if (categorias.length === 0) {
    return (
      <div className="text-center py-12">
        <Tag className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay categorías</h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza creando categorías para organizar tus productos.
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
              Descripción
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {categorias.map((categoria) => (
            <tr key={categoria.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <Tag className="h-5 w-5 text-gray-400 mr-3" />
                  <div className="text-sm font-medium text-gray-900">{categoria.name}</div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-500">
                  {categoria.description || 'Sin descripción'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(categoria)}
                    icon={<Edit className="h-4 w-4" />}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(categoria)}
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
