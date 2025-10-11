import React, { useState, useEffect } from 'react';
import { Plus, Search, Package } from 'lucide-react';
import { Card, Button, Input, Modal } from '../components/common';
import {
  ProductosTable,
  ProductoForm,
  CategoriasTable,
  CategoriaForm,
  BodegasTable,
  BodegaForm,
} from '../components/inventario';
import { inventarioService } from '../services/inventarioService';
import { useToast } from '../hooks/useToast';
import type {
  Product,
  ProductFormData,
  Category,
  CategoryFormData,
  Warehouse,
  WarehouseFormData,
} from '../types';

type TabType = 'productos' | 'categorias' | 'bodegas';

export const InventarioPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Productos
  const [productos, setProductos] = useState<Product[]>([]);
  const [isLoadingProductos, setIsLoadingProductos] = useState(false);
  const [selectedProducto, setSelectedProducto] = useState<Product | undefined>();
  const [isProductoModalOpen, setIsProductoModalOpen] = useState(false);
  const [isDeleteProductoModalOpen, setIsDeleteProductoModalOpen] = useState(false);
  const [productoToDelete, setProductoToDelete] = useState<Product | null>(null);
  
  // Estados para Categorías
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [isLoadingCategorias, setIsLoadingCategorias] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<Category | undefined>();
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isDeleteCategoriaModalOpen, setIsDeleteCategoriaModalOpen] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Category | null>(null);
  
  // Estados para Bodegas
  const [bodegas, setBodegas] = useState<Warehouse[]>([]);
  const [isLoadingBodegas, setIsLoadingBodegas] = useState(false);
  const [selectedBodega, setSelectedBodega] = useState<Warehouse | undefined>();
  const [isBodegaModalOpen, setIsBodegaModalOpen] = useState(false);
  const [isDeleteBodegaModalOpen, setIsDeleteBodegaModalOpen] = useState(false);
  const [bodegaToDelete, setBodegaToDelete] = useState<Warehouse | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  // Cargar datos según la tab activa
  useEffect(() => {
    if (activeTab === 'productos') {
      loadProductos();
    } else if (activeTab === 'categorias') {
      loadCategorias();
    } else if (activeTab === 'bodegas') {
      loadBodegas();
    }
  }, [activeTab]);

  // ===== PRODUCTOS =====
  const loadProductos = async () => {
    try {
      setIsLoadingProductos(true);
      const data = await inventarioService.getProducts();
      setProductos(data);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      toast.error('Error al cargar los productos');
    } finally {
      setIsLoadingProductos(false);
    }
  };

  const handleCreateProducto = () => {
    setSelectedProducto(undefined);
    setIsProductoModalOpen(true);
  };

  const handleEditProducto = (producto: Product) => {
    setSelectedProducto(producto);
    setIsProductoModalOpen(true);
  };

  const handleDeleteProducto = (producto: Product) => {
    setProductoToDelete(producto);
    setIsDeleteProductoModalOpen(true);
  };

  const handleSubmitProducto = async (data: ProductFormData) => {
    try {
      setIsSubmitting(true);
      
      if (selectedProducto) {
        await inventarioService.updateProduct(selectedProducto.id, data);
        toast.success('Producto actualizado correctamente');
      } else {
        await inventarioService.createProduct(data);
        toast.success('Producto creado correctamente');
      }
      
      setIsProductoModalOpen(false);
      setSelectedProducto(undefined);
      loadProductos();
    } catch (error: any) {
      console.error('Error al guardar producto:', error);
      toast.error('Error al guardar el producto');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteProducto = async () => {
    if (!productoToDelete) return;
    
    try {
      await inventarioService.deleteProduct(productoToDelete.id);
      toast.success('Producto eliminado correctamente');
      setIsDeleteProductoModalOpen(false);
      setProductoToDelete(null);
      loadProductos();
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      toast.error('Error al eliminar el producto');
    }
  };

  // ===== CATEGORÍAS =====
  const loadCategorias = async () => {
    try {
      setIsLoadingCategorias(true);
      const data = await inventarioService.getCategories();
      setCategorias(data);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      toast.error('Error al cargar las categorías');
    } finally {
      setIsLoadingCategorias(false);
    }
  };

  const handleCreateCategoria = () => {
    setSelectedCategoria(undefined);
    setIsCategoriaModalOpen(true);
  };

  const handleEditCategoria = (categoria: Category) => {
    setSelectedCategoria(categoria);
    setIsCategoriaModalOpen(true);
  };

  const handleDeleteCategoria = (categoria: Category) => {
    setCategoriaToDelete(categoria);
    setIsDeleteCategoriaModalOpen(true);
  };

  const handleSubmitCategoria = async (data: CategoryFormData) => {
    try {
      setIsSubmitting(true);
      
      if (selectedCategoria) {
        await inventarioService.updateCategory(selectedCategoria.id, data);
        toast.success('Categoría actualizada correctamente');
      } else {
        await inventarioService.createCategory(data);
        toast.success('Categoría creada correctamente');
      }
      
      setIsCategoriaModalOpen(false);
      setSelectedCategoria(undefined);
      loadCategorias();
    } catch (error: any) {
      console.error('Error al guardar categoría:', error);
      toast.error('Error al guardar la categoría');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteCategoria = async () => {
    if (!categoriaToDelete) return;
    
    try {
      await inventarioService.deleteCategory(categoriaToDelete.id);
      toast.success('Categoría eliminada correctamente');
      setIsDeleteCategoriaModalOpen(false);
      setCategoriaToDelete(null);
      loadCategorias();
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      toast.error('Error al eliminar la categoría');
    }
  };

  // ===== BODEGAS =====
  const loadBodegas = async () => {
    try {
      setIsLoadingBodegas(true);
      const data = await inventarioService.getWarehouses();
      setBodegas(data);
    } catch (error) {
      console.error('Error al cargar bodegas:', error);
      toast.error('Error al cargar las bodegas');
    } finally {
      setIsLoadingBodegas(false);
    }
  };

  const handleCreateBodega = () => {
    setSelectedBodega(undefined);
    setIsBodegaModalOpen(true);
  };

  const handleEditBodega = (bodega: Warehouse) => {
    setSelectedBodega(bodega);
    setIsBodegaModalOpen(true);
  };

  const handleDeleteBodega = (bodega: Warehouse) => {
    setBodegaToDelete(bodega);
    setIsDeleteBodegaModalOpen(true);
  };

  const handleSubmitBodega = async (data: WarehouseFormData) => {
    try {
      setIsSubmitting(true);
      
      if (selectedBodega) {
        await inventarioService.updateWarehouse(selectedBodega.id, data);
        toast.success('Bodega actualizada correctamente');
      } else {
        await inventarioService.createWarehouse(data);
        toast.success('Bodega creada correctamente');
      }
      
      setIsBodegaModalOpen(false);
      setSelectedBodega(undefined);
      loadBodegas();
    } catch (error: any) {
      console.error('Error al guardar bodega:', error);
      toast.error('Error al guardar la bodega');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteBodega = async () => {
    if (!bodegaToDelete) return;
    
    try {
      await inventarioService.deleteWarehouse(bodegaToDelete.id);
      toast.success('Bodega eliminada correctamente');
      setIsDeleteBodegaModalOpen(false);
      setBodegaToDelete(null);
      loadBodegas();
    } catch (error) {
      console.error('Error al eliminar bodega:', error);
      toast.error('Error al eliminar la bodega');
    }
  };

  // Filtrado
  const filteredProductos = productos.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCategorias = categorias.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBodegas = bodegas.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Package className="h-8 w-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Inventario</h1>
            <p className="text-gray-600">Administra productos, categorías y bodegas</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('productos')}
              className={`${
                activeTab === 'productos'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Productos
            </button>
            <button
              onClick={() => setActiveTab('categorias')}
              className={`${
                activeTab === 'categorias'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Categorías
            </button>
            <button
              onClick={() => setActiveTab('bodegas')}
              className={`${
                activeTab === 'bodegas'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Bodegas
            </button>
          </nav>
        </div>
      </div>

      {/* Barra de acciones */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Búsqueda */}
          <div className="flex-1 w-full">
            <Input
              placeholder={`Buscar ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-5 w-5" />}
            />
          </div>

          {/* Botón crear según tab */}
          {activeTab === 'productos' && (
            <Button
              variant="primary"
              icon={<Plus className="h-5 w-5" />}
              onClick={handleCreateProducto}
            >
              Nuevo Producto
            </Button>
          )}
          {activeTab === 'categorias' && (
            <Button
              variant="primary"
              icon={<Plus className="h-5 w-5" />}
              onClick={handleCreateCategoria}
            >
              Nueva Categoría
            </Button>
          )}
          {activeTab === 'bodegas' && (
            <Button
              variant="primary"
              icon={<Plus className="h-5 w-5" />}
              onClick={handleCreateBodega}
            >
              Nueva Bodega
            </Button>
          )}
        </div>
      </Card>

      {/* Contenido según tab activa */}
      <Card>
        {activeTab === 'productos' && (
          <>
            <ProductosTable
              productos={filteredProductos}
              isLoading={isLoadingProductos}
              onEdit={handleEditProducto}
              onDelete={handleDeleteProducto}
            />
            {!isLoadingProductos && filteredProductos.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Mostrando {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}

        {activeTab === 'categorias' && (
          <>
            <CategoriasTable
              categorias={filteredCategorias}
              isLoading={isLoadingCategorias}
              onEdit={handleEditCategoria}
              onDelete={handleDeleteCategoria}
            />
            {!isLoadingCategorias && filteredCategorias.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Mostrando {filteredCategorias.length} categoría{filteredCategorias.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}

        {activeTab === 'bodegas' && (
          <>
            <BodegasTable
              bodegas={filteredBodegas}
              isLoading={isLoadingBodegas}
              onEdit={handleEditBodega}
              onDelete={handleDeleteBodega}
            />
            {!isLoadingBodegas && filteredBodegas.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Mostrando {filteredBodegas.length} bodega{filteredBodegas.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Modales para Productos */}
      <Modal
        isOpen={isProductoModalOpen}
        onClose={() => {
          setIsProductoModalOpen(false);
          setSelectedProducto(undefined);
        }}
        title={selectedProducto ? 'Editar Producto' : 'Nuevo Producto'}
        size="lg"
      >
        <ProductoForm
          producto={selectedProducto}
          onSubmit={handleSubmitProducto}
          onCancel={() => {
            setIsProductoModalOpen(false);
            setSelectedProducto(undefined);
          }}
          isLoading={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={isDeleteProductoModalOpen}
        onClose={() => {
          setIsDeleteProductoModalOpen(false);
          setProductoToDelete(null);
        }}
        title="Confirmar Eliminación"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar el producto <strong>{productoToDelete?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteProductoModalOpen(false);
                setProductoToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDeleteProducto}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modales para Categorías */}
      <Modal
        isOpen={isCategoriaModalOpen}
        onClose={() => {
          setIsCategoriaModalOpen(false);
          setSelectedCategoria(undefined);
        }}
        title={selectedCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
        size="md"
      >
        <CategoriaForm
          categoria={selectedCategoria}
          onSubmit={handleSubmitCategoria}
          onCancel={() => {
            setIsCategoriaModalOpen(false);
            setSelectedCategoria(undefined);
          }}
          isLoading={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={isDeleteCategoriaModalOpen}
        onClose={() => {
          setIsDeleteCategoriaModalOpen(false);
          setCategoriaToDelete(null);
        }}
        title="Confirmar Eliminación"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar la categoría <strong>{categoriaToDelete?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteCategoriaModalOpen(false);
                setCategoriaToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDeleteCategoria}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modales para Bodegas */}
      <Modal
        isOpen={isBodegaModalOpen}
        onClose={() => {
          setIsBodegaModalOpen(false);
          setSelectedBodega(undefined);
        }}
        title={selectedBodega ? 'Editar Bodega' : 'Nueva Bodega'}
        size="md"
      >
        <BodegaForm
          bodega={selectedBodega}
          onSubmit={handleSubmitBodega}
          onCancel={() => {
            setIsBodegaModalOpen(false);
            setSelectedBodega(undefined);
          }}
          isLoading={isSubmitting}
        />
      </Modal>

      <Modal
        isOpen={isDeleteBodegaModalOpen}
        onClose={() => {
          setIsDeleteBodegaModalOpen(false);
          setBodegaToDelete(null);
        }}
        title="Confirmar Eliminación"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar la bodega <strong>{bodegaToDelete?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteBodegaModalOpen(false);
                setBodegaToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDeleteBodega}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
