import React, { useState } from 'react';
import type { Persona, PersonaFormData } from '../../types';
import { Input, Button } from '../common';
import { logger } from '../../utils/logger';

interface PersonaFormProps {
  persona?: Persona;
  onSubmit: (data: PersonaFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const TIPOS_DOCUMENTO = [
  { value: 'DNI', label: 'DNI' },
  { value: 'RUC', label: 'RUC' },
  { value: 'CE', label: 'Carnet de Extranjería' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
];

export const PersonaForm: React.FC<PersonaFormProps> = ({
  persona,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<PersonaFormData>({
    nombre: persona?.nombre || '',
    tipo_documento: persona?.tipo_documento || 'DNI',
    numero_documento: persona?.numero_documento || '',
    email: persona?.email || '',
    telefono: persona?.telefono || '',
    direccion: persona?.direccion || '',
    es_cliente: persona?.es_cliente || false,
    es_proveedor: persona?.es_proveedor || false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PersonaFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PersonaFormData, string>> = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.numero_documento.trim()) {
      newErrors.numero_documento = 'El número de documento es requerido';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.es_cliente && !formData.es_proveedor) {
      newErrors.es_cliente = 'Debe seleccionar al menos un tipo (Cliente o Proveedor)';
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
      await onSubmit(formData);
    } catch (error) {
      logger.error('Error al guardar persona:', error);
    }
  };

  const handleChange = (field: keyof PersonaFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Nombre completo *"
            value={formData.nombre}
            onChange={(e) => handleChange('nombre', e.target.value)}
            error={errors.nombre}
            placeholder="Ej: Juan Pérez"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="label">Tipo de documento *</label>
          <select
            className="input"
            value={formData.tipo_documento}
            onChange={(e) => handleChange('tipo_documento', e.target.value)}
            disabled={isLoading}
          >
            {TIPOS_DOCUMENTO.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Input
            label="Número de documento *"
            value={formData.numero_documento}
            onChange={(e) => handleChange('numero_documento', e.target.value)}
            error={errors.numero_documento}
            placeholder="Ej: 12345678"
            disabled={isLoading}
          />
        </div>

        <div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
            placeholder="correo@ejemplo.com"
            disabled={isLoading}
          />
        </div>

        <div>
          <Input
            label="Teléfono"
            value={formData.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
            placeholder="+51 999 999 999"
            disabled={isLoading}
          />
        </div>

        <div className="md:col-span-2">
          <Input
            label="Dirección"
            value={formData.direccion}
            onChange={(e) => handleChange('direccion', e.target.value)}
            placeholder="Av. Principal 123, Distrito, Ciudad"
            disabled={isLoading}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Tipo de persona *</label>
          <div className="flex gap-4 mt-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.es_cliente}
                onChange={(e) => handleChange('es_cliente', e.target.checked)}
                className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-700">Cliente</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.es_proveedor}
                onChange={(e) => handleChange('es_proveedor', e.target.checked)}
                className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-700">Proveedor</span>
            </label>
          </div>
          {errors.es_cliente && (
            <p className="error-message">{errors.es_cliente}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
        >
          {persona ? 'Actualizar' : 'Crear'} Persona
        </Button>
      </div>
    </form>
  );
};
