import React, { useState, useEffect } from 'react';
import type { Product, Category, ProductFormData } from '../../types';
import { Input, Button } from '../common';
import { inventarioService } from '../../services/inventarioService';

interface ProductoFormProps {
  producto?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const UNIDADES_MEDIDA = [
  { value: 'UND', label: 'Unidad' },
  { value: 'KG', label: 'Kilogramo' },
  { value: 'LT', label: 'Litro' },
  { value: 'MT', label: 'Metro' },
  { value: 'CJ', label: 'Caja' },
  { value: 'PQ', label: 'Paquete' },
];

export const ProductoForm: React.FC<ProductoFormProps> = ({
  producto,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    name: producto?.name || '',
    description: producto?.description || '',
    sku: producto?.sku || '',
    category: producto?.category || null,
    price: producto?.price || 0,
    unit_of_measure: producto?.unit_of_measure || 'UND',
    quantity: producto?.quantity || 0,
    min_stock: producto?.min_stock || 0,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    setLoadingCategorias(true);
    try {
      const data = await inventarioService.getCategories();
      setCategorias(data);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    } finally {
      setLoadingCategorias(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProductFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.sku.trim()) {
      newErrors.sku = 'El SKU es requerido';
    }

    if (formData.price <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }

    if (formData.quantity < 0) {
      newErrors.quantity = 'La cantidad no puede ser negativa';
    }

    if (formData.min_stock < 0) {
      newErrors.min_stock = 'El stock mínimo no puede ser negativo';
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
      console.error('Error al guardar producto:', error);
    }
  };

  const handleChange = (field: keyof ProductFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Input
            label="Nombre del producto *"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            error={errors.name}
            placeholder="Ej: Laptop Dell Inspiron 15"
            disabled={isLoading}
          />
        </div>

        <div>
          <Input
            label="SKU *"
            value={formData.sku}
            onChange={(e) => handleChange('sku', e.target.value)}
            error={errors.sku}
            placeholder="Ej: LAP-DELL-001"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="label">Categoría</label>
          <select
            className="input"
            value={formData.category || ''}
            onChange={(e) => handleChange('category', e.target.value ? Number(e.target.value) : null)}
            disabled={isLoading || loadingCategorias}
          >
            <option value="">Sin categoría</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {loadingCategorias && (
            <p className="text-xs text-gray-500 mt-1">Cargando categorías...</p>
          )}
        </div>

        <div>
          <Input
            label="Precio ($) *"
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
            error={errors.price}
            placeholder="0.00"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="label">Unidad de medida *</label>
          <select
            className="input"
            value={formData.unit_of_measure}
            onChange={(e) => handleChange('unit_of_measure', e.target.value)}
            disabled={isLoading}
          >
            {UNIDADES_MEDIDA.map((unidad) => (
              <option key={unidad.value} value={unidad.value}>
                {unidad.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Input
            label="Cantidad en stock *"
            type="number"
            min="0"
            value={formData.quantity}
            onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
            error={errors.quantity}
            placeholder="0"
            disabled={isLoading}
          />
        </div>

        <div>
          <Input
            label="Stock mínimo *"
            type="number"
            min="0"
            value={formData.min_stock}
            onChange={(e) => handleChange('min_stock', parseInt(e.target.value) || 0)}
            error={errors.min_stock}
            placeholder="0"
            disabled={isLoading}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Descripción</label>
          <textarea
            className="input min-h-[100px]"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Descripción detallada del producto..."
            disabled={isLoading}
          />
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
          {producto ? 'Actualizar' : 'Crear'} Producto
        </Button>
      </div>
    </form>
  );
};
