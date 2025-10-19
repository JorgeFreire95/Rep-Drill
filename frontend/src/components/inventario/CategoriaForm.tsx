import React, { useState } from 'react';
import type { Category, CategoryFormData } from '../../types';
import { Input, Button } from '../common';

interface CategoriaFormProps {
  categoria?: Category;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CategoriaForm: React.FC<CategoriaFormProps> = ({
  categoria,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: categoria?.name || '',
    description: categoria?.description || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CategoryFormData, string>> = {};

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
      console.error('Error al guardar categoría:', error);
    }
  };

  const handleChange = (field: keyof CategoryFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          label="Nombre de la categoría *"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="Ej: Electrónica"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="label">Descripción</label>
        <textarea
          className="input min-h-[100px]"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Descripción de la categoría..."
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
          {categoria ? 'Actualizar' : 'Crear'} Categoría
        </Button>
      </div>
    </form>
  );
};
