import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import type { UserData, UserListResponse, RoleData } from '../../services/userManagementService';
import { userManagementService } from '../../services/userManagementService';
import { Button } from '../common';
import { Eye, EyeOff } from 'lucide-react';

interface UserFormProps {
  user?: UserListResponse;
  onSubmit: (data: UserData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const UserForm: React.FC<UserFormProps> = ({
  user,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<UserData>({
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    role: user?.role?.id?.toString() || '',
    is_active: user?.is_active ?? true,
    is_staff: user?.is_staff ?? false,
    is_verified: user?.is_verified ?? false,
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoadingRoles(true);
    try {
      const data = await userManagementService.getRoles();
      setRoles(data);
    } catch (error) {
      logger.error('Error cargando roles:', error);
    } finally {
      setLoadingRoles(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validación de email
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato de email inválido (ejemplo: usuario@dominio.com)';
    }

    // Validación de nombre
    if (!formData.first_name || formData.first_name.trim() === '') {
      newErrors.first_name = 'El nombre es obligatorio';
    } else if (formData.first_name.trim().length < 2) {
      newErrors.first_name = 'El nombre debe tener al menos 2 caracteres';
    }

    // Validación de apellido
    if (!formData.last_name || formData.last_name.trim() === '') {
      newErrors.last_name = 'El apellido es obligatorio';
    } else if (formData.last_name.trim().length < 2) {
      newErrors.last_name = 'El apellido debe tener al menos 2 caracteres';
    }

    // Validación de contraseña (solo para nuevo usuario o si se está cambiando)
    if (!user || formData.password) {
      if (!formData.password || formData.password.length === 0) {
        if (!user) {
          newErrors.password = 'La contraseña es obligatoria';
        }
      } else if (formData.password.length < 8) {
        newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
      } else if (!/[A-Z]/.test(formData.password)) {
        newErrors.password = 'La contraseña debe contener al menos una letra mayúscula';
      } else if (!/[a-z]/.test(formData.password)) {
        newErrors.password = 'La contraseña debe contener al menos una letra minúscula';
      } else if (!/[0-9]/.test(formData.password)) {
        newErrors.password = 'La contraseña debe contener al menos un número';
      } else if (/^(123|password|admin|user|12345678|qwerty)/i.test(formData.password)) {
        newErrors.password = 'La contraseña es demasiado común. Usa una más segura';
      }
    }

    // Validación de teléfono
    if (formData.phone && formData.phone.trim() !== '') {
      if (!/^\+?[\d\s-()]+$/.test(formData.phone)) {
        newErrors.phone = 'Formato de teléfono inválido (solo números, +, -, (), espacios)';
      } else if (formData.phone.replace(/\D/g, '').length < 8) {
        newErrors.phone = 'El teléfono debe tener al menos 8 dígitos';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      // Si es edición y no hay contraseña, no enviarla
      const dataToSubmit = { ...formData };
      if (user && !dataToSubmit.password) {
        delete dataToSubmit.password;
      }

      // Convertir el role de string a number si existe
      if (dataToSubmit.role) {
        dataToSubmit.role = parseInt(dataToSubmit.role as string, 10);
      }

      await onSubmit(dataToSubmit);
    } catch (error) {
      logger.error('Error al guardar usuario:', error);
    }
  };

  const handleChange = (field: keyof UserData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario escribe
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validar campo específico en tiempo real
  const validateField = (field: keyof UserData, value: any) => {
    const newErrors: Record<string, string> = {};

    if (field === 'email') {
      if (!value || value.trim() === '') {
        newErrors.email = 'El email es obligatorio';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors.email = 'Formato de email inválido (ejemplo: usuario@dominio.com)';
      }
    }

    if (field === 'first_name') {
      if (!value || value.trim() === '') {
        newErrors.first_name = 'El nombre es obligatorio';
      } else if (value.trim().length < 2) {
        newErrors.first_name = 'El nombre debe tener al menos 2 caracteres';
      }
    }

    if (field === 'last_name') {
      if (!value || value.trim() === '') {
        newErrors.last_name = 'El apellido es obligatorio';
      } else if (value.trim().length < 2) {
        newErrors.last_name = 'El apellido debe tener al menos 2 caracteres';
      }
    }

    if (field === 'phone' && value && value.trim() !== '') {
      if (!/^\+?[\d\s-()]+$/.test(value)) {
        newErrors.phone = 'Formato de teléfono inválido (solo números, +, -, (), espacios)';
      } else if (value.replace(/\D/g, '').length < 8) {
        newErrors.phone = 'El teléfono debe tener al menos 8 dígitos';
      }
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información Personal */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
          Información Personal
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nombre */}
          <div>
            <label className="label">Nombre *</label>
            <input
              type="text"
              className={`input ${errors.first_name ? 'border-red-500' : ''}`}
              value={formData.first_name}
              onChange={(e) => handleChange('first_name', e.target.value)}
              onBlur={(e) => validateField('first_name', e.target.value)}
              placeholder="Juan"
              disabled={isLoading}
            />
            {errors.first_name && (
              <p className="text-sm text-red-600 mt-1">{errors.first_name}</p>
            )}
          </div>

          {/* Apellido */}
          <div>
            <label className="label">Apellido *</label>
            <input
              type="text"
              className={`input ${errors.last_name ? 'border-red-500' : ''}`}
              value={formData.last_name}
              onChange={(e) => handleChange('last_name', e.target.value)}
              onBlur={(e) => validateField('last_name', e.target.value)}
              placeholder="Pérez"
              disabled={isLoading}
            />
            {errors.last_name && (
              <p className="text-sm text-red-600 mt-1">{errors.last_name}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="label">Email *</label>
          <input
            type="email"
            className={`input ${errors.email ? 'border-red-500' : ''}`}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={(e) => validateField('email', e.target.value)}
            placeholder="usuario@ejemplo.com"
            disabled={isLoading || !!user} // No permitir cambiar email en edición
          />
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
          {user && (
            <p className="text-sm text-gray-500 mt-1">
              El email no puede ser modificado
            </p>
          )}
        </div>

        {/* Teléfono */}
        <div>
          <label className="label">Teléfono</label>
          <input
            type="tel"
            className={`input ${errors.phone ? 'border-red-500' : ''}`}
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            onBlur={(e) => validateField('phone', e.target.value)}
            placeholder="+56 9 1234 5678"
            disabled={isLoading}
          />
          {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
        </div>
      </div>

      {/* Contraseña */}
      {(!user || formData.password) && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
            {user ? 'Cambiar Contraseña (Opcional)' : 'Contraseña *'}
          </h3>

          <div>
            <label className="label">
              {user ? 'Nueva Contraseña' : 'Contraseña *'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={`input pr-10 ${errors.password ? 'border-red-500' : ''}`}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder={user ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">{errors.password}</p>
            )}
            {!errors.password && formData.password && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Requisitos de la contraseña:
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className={formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
                      {formData.password.length >= 8 ? '✓' : '○'}
                    </span>
                    Mínimo 8 caracteres
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={/[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      {/[A-Z]/.test(formData.password) ? '✓' : '○'}
                    </span>
                    Al menos una letra mayúscula
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={/[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      {/[a-z]/.test(formData.password) ? '✓' : '○'}
                    </span>
                    Al menos una letra minúscula
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={/[0-9]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                      {/[0-9]/.test(formData.password) ? '✓' : '○'}
                    </span>
                    Al menos un número
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={!/^(123|password|admin|user|12345678|qwerty)/i.test(formData.password) && formData.password.length > 0 ? 'text-green-600' : 'text-gray-400'}>
                      {!/^(123|password|admin|user|12345678|qwerty)/i.test(formData.password) && formData.password.length > 0 ? '✓' : '○'}
                    </span>
                    No usar contraseñas comunes
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rol y Permisos */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
          Rol y Permisos
        </h3>

        {/* Rol */}
        <div>
          <label className="label">Rol</label>
          <select
            className="input"
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
            disabled={isLoading || loadingRoles}
          >
            <option value="">Sin rol asignado</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id.toString()}>
                {role.description || role.name}
              </option>
            ))}
          </select>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formData.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              disabled={isLoading}
            />
            <span className="ml-2 text-sm text-gray-700">Usuario Activo</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formData.is_staff}
              onChange={(e) => handleChange('is_staff', e.target.checked)}
              disabled={isLoading}
            />
            <span className="ml-2 text-sm text-gray-700">
              Acceso al Panel de Administración
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={formData.is_verified}
              onChange={(e) => handleChange('is_verified', e.target.checked)}
              disabled={isLoading}
            />
            <span className="ml-2 text-sm text-gray-700">Email Verificado</span>
          </label>
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" isLoading={isLoading}>
          {user ? 'Actualizar Usuario' : 'Crear Usuario'}
        </Button>
      </div>
    </form>
  );
};
