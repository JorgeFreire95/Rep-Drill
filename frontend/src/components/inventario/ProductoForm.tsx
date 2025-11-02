import React, { useState, useEffect } from 'react';
import { logger } from '../../utils/logger';
import type { Product, Category, ProductFormData, Warehouse } from '../../types';
import { Input, Button } from '../common';
import { inventarioService } from '../../services/inventarioService';
import { suppliersService, type Supplier } from '../../services/suppliersService';

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

const ESTADOS_PRODUCTO = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'DISCONTINUED', label: 'Descontinuado' },
];

export const ProductoForm: React.FC<ProductoFormProps> = ({
  producto,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [bodegas, setBodegas] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [loadingBodegas, setLoadingBodegas] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const [formData, setFormData] = useState<ProductFormData>({
    name: producto?.name || '',
    description: producto?.description || '',
    sku: producto?.sku || '',
    category: producto?.category || null,
    supplier: producto?.supplier || null,
    warehouse: producto?.warehouse || null,
    cost_price: producto?.cost_price || 0,
    price: producto?.price || 0,
    unit_of_measure: producto?.unit_of_measure || 'UND',
    quantity: producto?.quantity || 0,
    min_stock: producto?.min_stock || 0,
    reorder_quantity: producto?.reorder_quantity || 10,
    status: producto?.status || 'ACTIVE',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});

  useEffect(() => {
    loadCategorias();
    loadBodegas();
    loadSuppliers();
  }, []);

  const loadCategorias = async () => {
    setLoadingCategorias(true);
    try {
      const data = await inventarioService.getCategories();
      setCategorias(data);
    } catch (error) {
      logger.error('Error al cargar categorías:', error);
    } finally {
      setLoadingCategorias(false);
    }
  };

  const loadBodegas = async () => {
    setLoadingBodegas(true);
    try {
      const data = await inventarioService.getWarehouses();
      setBodegas(data);
    } catch (error) {
      logger.error('Error al cargar bodegas:', error);
    } finally {
      setLoadingBodegas(false);
    }
  };

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const data = await suppliersService.list();
      setSuppliers(data);
    } catch (error) {
      logger.error('Error al cargar proveedores:', error);
    } finally {
      setLoadingSuppliers(false);
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

    if (formData.cost_price < 0) {
      newErrors.cost_price = 'El precio de costo no puede ser negativo';
    }

    if (formData.price <= 0) {
      newErrors.price = 'El precio de venta debe ser mayor a 0';
    }

    if (formData.cost_price > formData.price) {
      newErrors.price = 'El precio de venta debe ser mayor al costo';
    }

    if (formData.quantity < 0) {
      newErrors.quantity = 'La cantidad no puede ser negativa';
    }

    if (formData.min_stock < 0) {
      newErrors.min_stock = 'El stock mínimo no puede ser negativo';
    }

    if (formData.reorder_quantity < 0) {
      newErrors.reorder_quantity = 'La cantidad de reorden no puede ser negativa';
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
      logger.error('Error al guardar producto:', error);
    }
  };

  const handleChange = (field: keyof ProductFormData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Calcular margen de ganancia en tiempo real
  const profitMargin = formData.cost_price > 0 
    ? (((formData.price - formData.cost_price) / formData.cost_price) * 100).toFixed(2)
    : '0.00';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Información básica */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Información Básica</h3>
        </div>
        
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
            disabled={isLoading || !!producto}
            title={producto ? 'El SKU no se puede modificar' : ''}
          />
        </div>

        <div>
          <label className="label">Estado *</label>
          <select
            className="input"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            disabled={isLoading}
          >
            {ESTADOS_PRODUCTO.map((estado) => (
              <option key={estado.value} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </select>
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
          <label className="label">Proveedor</label>
          <select
            className="input"
            value={formData.supplier || ''}
            onChange={(e) => handleChange('supplier', e.target.value ? Number(e.target.value) : null)}
            disabled={isLoading || loadingSuppliers}
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          {loadingSuppliers && (
            <p className="text-xs text-gray-500 mt-1">Cargando proveedores...</p>
          )}
        </div>

        {/* Precios */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2 mt-4">Precios (CLP)</h3>
        </div>

        <div>
          <Input
            label="Precio de Costo (CLP)"
            type="number"
            step="1"
            min="0"
            value={formData.cost_price}
            onChange={(e) => handleChange('cost_price', parseInt(e.target.value) || 0)}
            error={errors.cost_price}
            placeholder="0"
            disabled={isLoading}
          />
        </div>

        <div>
          <Input
            label="Precio de Venta (CLP) *"
            type="number"
            step="1"
            min="0"
            value={formData.price}
            onChange={(e) => handleChange('price', parseInt(e.target.value) || 0)}
            error={errors.price}
            placeholder="0"
            disabled={isLoading}
          />
        </div>

        {formData.cost_price > 0 && formData.price > 0 && (
          <div className="md:col-span-2">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Margen de ganancia:</span> {profitMargin}%
                {' '}·{' '}
                <span className="font-semibold">Utilidad por unidad:</span> ${(formData.price - formData.cost_price).toLocaleString('es-CL')}
              </p>
            </div>
          </div>
        )}

        {/* Stock */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2 mt-4">Gestión de Stock</h3>
        </div>

        <div>
          <label className="label">Bodega</label>
          <select
            className="input"
            value={formData.warehouse || ''}
            onChange={(e) => handleChange('warehouse', e.target.value ? Number(e.target.value) : null)}
            disabled={isLoading || loadingBodegas}
          >
            <option value="">Sin bodega</option>
            {bodegas.map((bodega) => (
              <option key={bodega.id} value={bodega.id}>
                {bodega.name}
              </option>
            ))}
          </select>
          {loadingBodegas && (
            <p className="text-xs text-gray-500 mt-1">Cargando bodegas...</p>
          )}
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
          <p className="text-xs text-gray-500 mt-1">Se generará alerta cuando el stock sea menor o igual a este valor</p>
        </div>

        <div>
          <Input
            label="Cantidad de reorden *"
            type="number"
            min="0"
            value={formData.reorder_quantity}
            onChange={(e) => handleChange('reorder_quantity', parseInt(e.target.value) || 0)}
            error={errors.reorder_quantity}
            placeholder="10"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">Cantidad sugerida para reordenar cuando el stock esté bajo</p>
        </div>

        {/* Descripción */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2 mt-4">Descripción</h3>
        </div>

        <div className="md:col-span-2">
          <label className="label">Descripción del producto</label>
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
