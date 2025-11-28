import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, RefreshCw, Download, FileText, FileSpreadsheet, FileDown } from 'lucide-react';
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
import { useInventoryUpdates } from '../hooks/useInventoryUpdates';
import {
  exportProductsToCSV,
  exportProductsToExcel,
  exportProductsToPDF,
  exportCategoriesToCSV,
  exportCategoriesToExcel,
  exportCategoriesToPDF,
  exportWarehousesToCSV,
  exportWarehousesToExcel,
  exportWarehousesToPDF,
} from '../utils/inventoryExportUtils';
import type {
  Product,
  ProductFormData,
  Category,
  CategoryFormData,
  Warehouse,
  WarehouseFormData,
} from '../types';
import { logger } from '../utils/logger';

type TabType = 'productos' | 'categorias' | 'bodegas';

export const InventarioPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('productos');
  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  
  // Estados de paginación
  const [currentProductPage, setCurrentProductPage] = useState(1);
  const [productPageSize] = useState(20);
  const [currentCategoryPage, setCurrentCategoryPage] = useState(1);
  const [categoryPageSize] = useState(20);
  const [currentWarehousePage, setCurrentWarehousePage] = useState(1);
  const [warehousePageSize] = useState(20);
  
  // Estados para menús de exportación
  const [showProductsExportMenu, setShowProductsExportMenu] = useState(false);
  const [showCategoriesExportMenu, setShowCategoriesExportMenu] = useState(false);
  const [showWarehousesExportMenu, setShowWarehousesExportMenu] = useState(false);
  
  // Estados para Productos
  const [productos, setProductos] = useState<Product[]>([]);
  const [isLoadingProductos, setIsLoadingProductos] = useState(false);
  const [lastProductsUpdate, setLastProductsUpdate] = useState<Date | undefined>();
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

  // Escuchar actualizaciones automáticas del inventario
  useInventoryUpdates(() => {
    // Solo recargar productos si está en la tab de productos
    if (activeTab === 'productos') {
      toast.info('📦 Inventario actualizado automáticamente desde ventas');
      loadProductos(true); // true = viene de actualización automática
      
      // Ocultar indicador después de 10 segundos
      setTimeout(() => {
        setLastProductsUpdate(undefined);
      }, 10000);
    }
  });

  // Cargar datos según la tab activa
  useEffect(() => {
    if (activeTab === 'productos') {
      loadProductos();
      loadBodegas(); // Cargar bodegas para el filtro
    } else if (activeTab === 'categorias') {
      loadCategorias();
      // Limpiar indicador de actualización al cambiar de tab
      setLastProductsUpdate(undefined);
    } else if (activeTab === 'bodegas') {
      loadBodegas();
      // Limpiar indicador de actualización al cambiar de tab
      setLastProductsUpdate(undefined);
    }
  }, [activeTab]);

  // Cerrar menús de exportación al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProductsExportMenu && !target.closest('.export-menu-productos')) {
        setShowProductsExportMenu(false);
      }
      if (showCategoriesExportMenu && !target.closest('.export-menu-categorias')) {
        setShowCategoriesExportMenu(false);
      }
      if (showWarehousesExportMenu && !target.closest('.export-menu-bodegas')) {
        setShowWarehousesExportMenu(false);
      }
    };

    if (showProductsExportMenu || showCategoriesExportMenu || showWarehousesExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductsExportMenu, showCategoriesExportMenu, showWarehousesExportMenu]);

  // ===== PRODUCTOS =====
  const loadProductos = async (fromAutoUpdate = false) => {
    try {
      setIsLoadingProductos(true);
      const data = await inventarioService.getProducts();
      setProductos(data);
      
      // Solo actualizar timestamp si viene de actualización automática
      if (fromAutoUpdate) {
        setLastProductsUpdate(new Date());
      }
    } catch (error) {
      logger.error('Error al cargar productos:', error);
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
      logger.error('Error al guardar producto:', error);
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
      logger.error('Error al eliminar producto:', error);
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
      logger.error('Error al cargar categorías:', error);
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
      logger.error('Error al guardar categoría:', error);
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
      logger.error('Error al eliminar categoría:', error);
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
      logger.error('Error al cargar bodegas:', error);
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
      logger.error('Error al guardar bodega:', error);
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
      logger.error('Error al eliminar bodega:', error);
      toast.error('Error al eliminar la bodega');
    }
  };

  // Función para refrescar datos manualmente
  const handleRefresh = () => {
    if (activeTab === 'productos') {
      loadProductos();
    } else if (activeTab === 'categorias') {
      loadCategorias();
    } else if (activeTab === 'bodegas') {
      loadBodegas();
    }
    toast.success('Datos actualizados');
  };

  // Filtrado
  const filteredProductos = productos.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesWarehouse = warehouseFilter === 'all' || 
                            (warehouseFilter === 'none' && !p.warehouse) ||
                            (p.warehouse && p.warehouse.toString() === warehouseFilter);
    
    return matchesSearch && matchesWarehouse;
  });

  const filteredCategorias = categorias.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBodegas = bodegas.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación para productos
  const totalProductPages = Math.ceil(filteredProductos.length / productPageSize);
  const paginatedProductos = filteredProductos.slice(
    (currentProductPage - 1) * productPageSize,
    currentProductPage * productPageSize
  );

  // Paginación para categorías
  const totalCategoryPages = Math.ceil(filteredCategorias.length / categoryPageSize);
  const paginatedCategorias = filteredCategorias.slice(
    (currentCategoryPage - 1) * categoryPageSize,
    currentCategoryPage * categoryPageSize
  );

  // Paginación para bodegas
  const totalWarehousePages = Math.ceil(filteredBodegas.length / warehousePageSize);
  const paginatedBodegas = filteredBodegas.slice(
    (currentWarehousePage - 1) * warehousePageSize,
    currentWarehousePage * warehousePageSize
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
        <div className="flex flex-col gap-4">
          {/* Primera fila: Búsqueda y filtro de bodega (solo para productos) */}
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

            {/* Filtro de bodega (solo para productos) */}
            {activeTab === 'productos' && (
              <div className="w-full md:w-64">
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">Todas las bodegas</option>
                  <option value="none">Sin bodega</option>
                  {bodegas.map((bodega) => (
                    <option key={bodega.id} value={bodega.id.toString()}>
                      {bodega.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Segunda fila: Botones de acción */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1"></div>

            {/* Botón refrescar */}
            <Button
              variant="secondary"
              icon={<RefreshCw className="h-5 w-5" />}
              onClick={handleRefresh}
              disabled={isLoadingProductos || isLoadingCategorias || isLoadingBodegas}
            >
              Refrescar
            </Button>

            {/* Botones de exportación según tab */}
          {activeTab === 'productos' && (
            <div className="relative export-menu-productos">
              <Button
                variant="secondary"
                icon={<Download className="h-5 w-5" />}
                onClick={() => setShowProductsExportMenu(!showProductsExportMenu)}
              >
                Exportar
              </Button>
              {showProductsExportMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="py-1" role="none">
                    <button
                      onClick={() => {
                        exportProductsToPDF(filteredProductos);
                        setShowProductsExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Exportar a PDF
                    </button>
                    <button
                      onClick={() => {
                        exportProductsToExcel(filteredProductos);
                        setShowProductsExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Exportar a Excel
                    </button>
                    <button
                      onClick={() => {
                        exportProductsToCSV(filteredProductos);
                        setShowProductsExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Exportar a CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'categorias' && (
            <div className="relative export-menu-categorias">
              <Button
                variant="secondary"
                icon={<Download className="h-5 w-5" />}
                onClick={() => setShowCategoriesExportMenu(!showCategoriesExportMenu)}
              >
                Exportar
              </Button>
              {showCategoriesExportMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="py-1" role="none">
                    <button
                      onClick={() => {
                        exportCategoriesToPDF(filteredCategorias);
                        setShowCategoriesExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Exportar a PDF
                    </button>
                    <button
                      onClick={() => {
                        exportCategoriesToExcel(filteredCategorias);
                        setShowCategoriesExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Exportar a Excel
                    </button>
                    <button
                      onClick={() => {
                        exportCategoriesToCSV(filteredCategorias);
                        setShowCategoriesExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Exportar a CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'bodegas' && (
            <div className="relative export-menu-bodegas">
              <Button
                variant="secondary"
                icon={<Download className="h-5 w-5" />}
                onClick={() => setShowWarehousesExportMenu(!showWarehousesExportMenu)}
              >
                Exportar
              </Button>
              {showWarehousesExportMenu && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="py-1" role="none">
                    <button
                      onClick={() => {
                        exportWarehousesToPDF(filteredBodegas);
                        setShowWarehousesExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Exportar a PDF
                    </button>
                    <button
                      onClick={() => {
                        exportWarehousesToExcel(filteredBodegas);
                        setShowWarehousesExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Exportar a Excel
                    </button>
                    <button
                      onClick={() => {
                        exportWarehousesToCSV(filteredBodegas);
                        setShowWarehousesExportMenu(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Exportar a CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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
        </div>
      </Card>

      {/* Contenido según tab activa */}
      <Card>
        {activeTab === 'productos' && (
          <>
            <ProductosTable
              productos={paginatedProductos}
              isLoading={isLoadingProductos}
              onEdit={handleEditProducto}
              onDelete={handleDeleteProducto}
              lastUpdated={lastProductsUpdate}
            />
            {!isLoadingProductos && filteredProductos.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Mostrando {((currentProductPage - 1) * productPageSize) + 1} a {Math.min(currentProductPage * productPageSize, filteredProductos.length)} de {filteredProductos.length} producto{filteredProductos.length !== 1 ? 's' : ''}
              </div>
            )}
            
            {/* Paginación para productos */}
            {filteredProductos.length > productPageSize && (
              <div className="mt-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between p-4">
                  <div className="text-sm text-gray-600">
                    Página {currentProductPage} de {totalProductPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentProductPage(Math.max(1, currentProductPage - 1))}
                      disabled={currentProductPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Anterior
                    </button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalProductPages) }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentProductPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentProductPage === pageNum
                                ? 'bg-primary-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {totalProductPages > 5 && <span className="text-gray-500">...</span>}
                    </div>
                    <button
                      onClick={() => setCurrentProductPage(Math.min(totalProductPages, currentProductPage + 1))}
                      disabled={currentProductPage === totalProductPages}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'categorias' && (
          <>
            <CategoriasTable
              categorias={paginatedCategorias}
              isLoading={isLoadingCategorias}
              onEdit={handleEditCategoria}
              onDelete={handleDeleteCategoria}
            />
            {!isLoadingCategorias && filteredCategorias.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Mostrando {((currentCategoryPage - 1) * categoryPageSize) + 1} a {Math.min(currentCategoryPage * categoryPageSize, filteredCategorias.length)} de {filteredCategorias.length} categoría{filteredCategorias.length !== 1 ? 's' : ''}
              </div>
            )}
            
            {/* Paginación para categorías */}
            {filteredCategorias.length > categoryPageSize && (
              <div className="mt-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between p-4">
                  <div className="text-sm text-gray-600">
                    Página {currentCategoryPage} de {totalCategoryPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentCategoryPage(Math.max(1, currentCategoryPage - 1))}
                      disabled={currentCategoryPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Anterior
                    </button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalCategoryPages) }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentCategoryPage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentCategoryPage === pageNum
                                ? 'bg-primary-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {totalCategoryPages > 5 && <span className="text-gray-500">...</span>}
                    </div>
                    <button
                      onClick={() => setCurrentCategoryPage(Math.min(totalCategoryPages, currentCategoryPage + 1))}
                      disabled={currentCategoryPage === totalCategoryPages}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'bodegas' && (
          <>
            <BodegasTable
              bodegas={paginatedBodegas}
              isLoading={isLoadingBodegas}
              onEdit={handleEditBodega}
              onDelete={handleDeleteBodega}
            />
            {!isLoadingBodegas && filteredBodegas.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                Mostrando {((currentWarehousePage - 1) * warehousePageSize) + 1} a {Math.min(currentWarehousePage * warehousePageSize, filteredBodegas.length)} de {filteredBodegas.length} bodega{filteredBodegas.length !== 1 ? 's' : ''}
              </div>
            )}
            
            {/* Paginación para bodegas */}
            {filteredBodegas.length > warehousePageSize && (
              <div className="mt-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between p-4">
                  <div className="text-sm text-gray-600">
                    Página {currentWarehousePage} de {totalWarehousePages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentWarehousePage(Math.max(1, currentWarehousePage - 1))}
                      disabled={currentWarehousePage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Anterior
                    </button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalWarehousePages) }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentWarehousePage(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentWarehousePage === pageNum
                                ? 'bg-primary-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {totalWarehousePages > 5 && <span className="text-gray-500">...</span>}
                    </div>
                    <button
                      onClick={() => setCurrentWarehousePage(Math.min(totalWarehousePages, currentWarehousePage + 1))}
                      disabled={currentWarehousePage === totalWarehousePages}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
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
