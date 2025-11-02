import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, Filter, Users as UsersIcon } from 'lucide-react';
import { UsersTable, UserForm, UserDetails } from '../components/users';
import { Button, Modal } from '../components/common';
import { userManagementService } from '../services/userManagementService';
import type { UserListResponse, UserData } from '../services/userManagementService';
import { useToastContext } from '../contexts/ToastContext';

export const UsersManagementPage: React.FC = () => {
  const { success, error: showError } = useToastContext();
  const [users, setUsers] = useState<UserListResponse[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserListResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filterUsers = useCallback(() => {
    let filtered = [...users];

    // Filtrar por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.phone?.toLowerCase().includes(query)
      );
    }

    // Filtrar por rol
    if (selectedRole) {
      filtered = filtered.filter((user) => user.role?.name === selectedRole);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, selectedRole]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [filterUsers]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userManagementService.getAllUsers();
      console.log('Usuarios cargados:', data); // Debug
      // Validar que data sea un array
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('La respuesta no es un array:', data);
        showError('Error: Formato de respuesta inválido');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      showError('Error al cargar usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (data: UserData) => {
    setIsSubmitting(true);
    try {
      await userManagementService.createUser(data);
      success('Usuario creado exitosamente');
      setShowCreateModal(false);
      loadUsers();
    } catch (error: any) {
      console.error('Error creando usuario:', error);
      
      // Extraer mensajes de error específicos del backend
      let errorMessage = 'Error al crear usuario';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Errores específicos por campo
        if (errorData.email) {
          errorMessage = `Email: ${errorData.email[0]}`;
        } else if (errorData.password) {
          errorMessage = `Contraseña: ${errorData.password[0]}`;
        } else if (errorData.first_name) {
          errorMessage = `Nombre: ${errorData.first_name[0]}`;
        } else if (errorData.last_name) {
          errorMessage = `Apellido: ${errorData.last_name[0]}`;
        } else if (errorData.phone) {
          errorMessage = `Teléfono: ${errorData.phone[0]}`;
        } else if (errorData.role) {
          errorMessage = `Rol: ${errorData.role[0]}`;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.non_field_errors) {
          errorMessage = errorData.non_field_errors[0];
        }
      }
      
      showError(errorMessage);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (data: UserData) => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      await userManagementService.updateUser(selectedUser.id, data);
      success('Usuario actualizado exitosamente');
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error actualizando usuario:', error);
      
      // Extraer mensajes de error específicos del backend
      let errorMessage = 'Error al actualizar usuario';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        if (errorData.password) {
          errorMessage = `Contraseña: ${errorData.password[0]}`;
        } else if (errorData.first_name) {
          errorMessage = `Nombre: ${errorData.first_name[0]}`;
        } else if (errorData.last_name) {
          errorMessage = `Apellido: ${errorData.last_name[0]}`;
        } else if (errorData.phone) {
          errorMessage = `Teléfono: ${errorData.phone[0]}`;
        } else if (errorData.role) {
          errorMessage = `Rol: ${errorData.role[0]}`;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      }
      
      showError(errorMessage);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      return;
    }

    try {
      await userManagementService.deleteUser(id);
      success('Usuario eliminado exitosamente');
      loadUsers();
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      showError('Error al eliminar usuario');
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    const action = currentStatus ? 'desactivar' : 'activar';
    if (!confirm(`¿Estás seguro de que deseas ${action} este usuario?`)) {
      return;
    }

    try {
      await userManagementService.toggleUserStatus(id, !currentStatus);
      success(`Usuario ${action}do exitosamente`);
      loadUsers();
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showError('Error al cambiar el estado del usuario');
    }
  };

  const handleEdit = (user: UserListResponse) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleViewDetails = (user: UserListResponse) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
  };

  const uniqueRoles = Array.isArray(users) 
    ? Array.from(new Set(users.map((u) => u.role?.name).filter(Boolean)))
    : [];

  // Mapeo de nombres de roles a español
  const roleLabels: Record<string, string> = {
    'admin': 'Administrador',
    'manager': 'Gerente',
    'employee': 'Empleado',
    'customer': 'Cliente',
    'supplier': 'Proveedor',
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <UsersIcon className="h-8 w-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
        </div>
        <p className="text-gray-600">
          Administra los usuarios del sistema, roles y permisos
        </p>
      </div>

      {/* Barra de acciones */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o teléfono..."
              className="input pl-10 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filtro por rol */}
          <div className="md:w-64">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <select
                className="input pl-10 w-full"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">Todos los roles</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role as string] || role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botón crear */}
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            icon={<UserPlus className="h-5 w-5" />}
          >
            Nuevo Usuario
          </Button>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-600">{users.length}</p>
            <p className="text-sm text-gray-600">Total Usuarios</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {users.filter((u) => u.is_active).length}
            </p>
            <p className="text-sm text-gray-600">Activos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {users.filter((u) => !u.is_active).length}
            </p>
            <p className="text-sm text-gray-600">Inactivos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {users.filter((u) => u.is_staff).length}
            </p>
            <p className="text-sm text-gray-600">Administradores</p>
          </div>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <UsersTable
          users={filteredUsers}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDeleteUser}
          onToggleStatus={handleToggleStatus}
          onViewDetails={handleViewDetails}
        />
      </div>

      {/* Resultados de búsqueda */}
      {(searchQuery || selectedRole) && (
        <div className="mt-4 text-sm text-gray-600">
          Mostrando {filteredUsers.length} de {users.length} usuarios
        </div>
      )}

      {/* Modal Crear Usuario */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nuevo Usuario"
        size="lg"
      >
        <UserForm
          onSubmit={handleCreateUser}
          onCancel={() => setShowCreateModal(false)}
          isLoading={isSubmitting}
        />
      </Modal>

      {/* Modal Editar Usuario */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        title="Editar Usuario"
        size="lg"
      >
        {selectedUser && (
          <UserForm
            user={selectedUser}
            onSubmit={handleUpdateUser}
            onCancel={() => {
              setShowEditModal(false);
              setSelectedUser(null);
            }}
            isLoading={isSubmitting}
          />
        )}
      </Modal>

      {/* Modal Ver Detalles */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedUser(null);
        }}
        title="Detalles del Usuario"
        size="lg"
      >
        {selectedUser && <UserDetails user={selectedUser} />}
      </Modal>
    </div>
  );
};
