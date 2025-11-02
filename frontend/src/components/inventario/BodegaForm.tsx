import React, { useState } from 'react';
import { logger } from '../../utils/logger';
import type { Warehouse, WarehouseFormData } from '../../types';
import { Input, Button } from '../common';

interface BodegaFormProps {
  bodega?: Warehouse;
  onSubmit: (data: WarehouseFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const BodegaForm: React.FC<BodegaFormProps> = ({
  bodega,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<WarehouseFormData>({
    name: bodega?.name || '',
    location: bodega?.location || '',
    description: bodega?.description || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof WarehouseFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof WarehouseFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
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
      logger.error('Error al guardar bodega:', error);
    }
  };

  const handleChange = (field: keyof WarehouseFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          label="Nombre de la bodega *"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="Ej: Bodega Principal"
          disabled={isLoading}
        />
      </div>

      <div>
        <Input
          label="Ubicación"
          value={formData.location}
          onChange={(e) => handleChange('location', e.target.value)}
          placeholder="Ej: Av. Industrial 123, Lima"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="label">Descripción</label>
        <textarea
          className="input min-h-[100px]"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Descripción de la bodega..."
          disabled={isLoading}
        />
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
          {bodega ? 'Actualizar' : 'Crear'} Bodega
        </Button>
      </div>
    </form>
  );
};
