import React, { useEffect, useState, useCallback } from 'react';
import { inventarioService } from '../services/inventarioService';
import type { ReorderRequest, ReorderStatus, ReorderStatusHistory, ProductWithAlert } from '../types';
import { useToast } from '../hooks/useToast';
import { CheckCircle2, Clock, XCircle, Truck, Download, FileText, FileSpreadsheet, History, ChevronDown, ChevronUp, Plus, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Modal } from '../components/common';

const statusLabel: Record<ReorderStatus, string> = {
  requested: 'Solicitado',
  ordered: 'Ordenado',
  received: 'Recibido',
  cancelled: 'Cancelado',
};

const statusClass: Record<ReorderStatus, string> = {
  requested: 'bg-blue-100 text-blue-800',
  ordered: 'bg-amber-100 text-amber-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-700',
};

export const ReordersPage: React.FC = () => {
  const [items, setItems] = useState<ReorderRequest[]>([]);
  const [filteredItems, setFilteredItems] = useState<ReorderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<number, ReorderStatusHistory[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<number | null>(null);
  
  // Modal para crear nueva reorden
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<ProductWithAlert[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithAlert | null>(null);
  const [newReorderQty, setNewReorderQty] = useState<number>(0);
  const [newReorderNotes, setNewReorderNotes] = useState<string>("");
  const [creatingReorder, setCreatingReorder] = useState(false);
  
  const { success, error } = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await inventarioService.listReorders();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      error('No se pudo cargar el listado de reordenes');
    } finally {
      setLoading(false);
    }
  }, [error]);

  const loadLowStockProducts = useCallback(async () => {
    try {
      const data = await inventarioService.getLowStockProducts();
      setLowStockProducts(data.results || []);
    } catch {
      // Silent fail, esto es opcional
    }
  }, []);

  useEffect(() => {
    load();
    loadLowStockProducts();
  }, [load, loadLowStockProducts]);

  // Debounce de búsqueda para evitar re-render excesivo en listas grandes
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const handleCreateReorder = (product: ProductWithAlert) => {
    setSelectedProduct(product);
    const suggestedQty = Math.max(product.min_stock - product.quantity, 1);
    setNewReorderQty(suggestedQty);
    setNewReorderNotes("");
    setShowCreateModal(true);
  };

  const submitCreateReorder = async () => {
    if (!selectedProduct || newReorderQty < 1) return;
    try {
      setCreatingReorder(true);
      await inventarioService.createReorder(selectedProduct.id, newReorderQty, newReorderNotes);
      success('Solicitud de reorden creada');
      setShowCreateModal(false);
      await load(); // Recargar lista
    } catch {
      error('No se pudo crear la solicitud');
    } finally {
      setCreatingReorder(false);
    }
  };

  // Aplicar filtros
  useEffect(() => {
    let result = items;
    if (statusFilter !== 'all') {
      result = result.filter(it => it.status === statusFilter);
    }
    if (debouncedSearch) {
      const term = debouncedSearch;
      result = result.filter(it => 
        (it.product_name || '').toLowerCase().includes(term) ||
        it.id.toString().includes(term)
      );
    }
    setFilteredItems(result);
  }, [items, statusFilter, debouncedSearch]);

  // Cargar historial de un reorden
  const loadHistory = async (id: number) => {
    if (historyMap[id]) {
      // Ya está cargado, solo toggle
      setExpandedRow(expandedRow === id ? null : id);
      return;
    }
    try {
      setLoadingHistory(id);
      const history = await inventarioService.getReorderHistory(id);
      setHistoryMap(prev => ({ ...prev, [id]: history }));
      setExpandedRow(id);
    } catch {
      error('No se pudo cargar el historial');
    } finally {
      setLoadingHistory(null);
    }
  };

  // Exportar a CSV
  const exportToCSV = () => {
    const csvData = filteredItems.map(it => ({
      ID: it.id,
      Producto: it.product_name || `Producto #${it.product}`,
      Cantidad: it.quantity,
      Estado: statusLabel[it.status],
      Notas: it.notes || '',
      Creado: new Date(it.created_at).toLocaleString(),
      Actualizado: new Date(it.updated_at).toLocaleString()
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reordenes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    success('Exportado a CSV');
  };

  // Exportar a Excel
  const exportToExcel = () => {
    const excelData = filteredItems.map(it => ({
      ID: it.id,
      Producto: it.product_name || `Producto #${it.product}`,
      Cantidad: it.quantity,
      Estado: statusLabel[it.status],
      Notas: it.notes || '',
      Creado: new Date(it.created_at).toLocaleString(),
      Actualizado: new Date(it.updated_at).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reordenes');
    XLSX.writeFile(wb, `reordenes_${new Date().toISOString().split('T')[0]}.xlsx`);
    success('Exportado a Excel');
  };

  // Exportar a PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Solicitudes de Reorden', 14, 15);
    const tableData = filteredItems.map(it => [
      it.id.toString(),
      it.product_name || `Producto #${it.product}`,
      it.quantity.toString(),
      statusLabel[it.status],
      (it.notes || '').substring(0, 50),
      new Date(it.created_at).toLocaleDateString()
    ]);
    autoTable(doc, {
      head: [['ID', 'Producto', 'Cantidad', 'Estado', 'Notas', 'Creado']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 }
    });
    doc.save(`reordenes_${new Date().toISOString().split('T')[0]}.pdf`);
    success('Exportado a PDF');
  };

  // Calcular datos para gráfico (reordenes por mes, últimos 12 meses)
  const chartData = React.useMemo(() => {
    const now = new Date();
    const months: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      const count = items.filter(it => {
        const created = new Date(it.created_at);
        const createdKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        return createdKey === monthKey;
      }).length;
      months.push({ month: monthLabel, count });
    }
    return months;
  }, [items]);

  const doTransition = async (id: number, action: 'ordered' | 'received' | 'cancelled') => {
    try {
      setUpdatingId(id);
      let updated: ReorderRequest;
      if (action === 'ordered') updated = await inventarioService.markReorderOrdered(id);
      else if (action === 'received') updated = await inventarioService.markReorderReceived(id);
      else updated = await inventarioService.cancelReorder(id);
      setItems(prev => prev.map(i => (i.id === id ? updated : i)));
      success(`Reorden #${id} → ${statusLabel[updated.status]}`);
    } catch {
      error('No se pudo actualizar el estado');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Reorden</h1>
          <p className="text-gray-600">Listado de reordenes y sus estados</p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4" />
          Nueva Reorden
        </button>
      </div>

      {/* Gráfico de reordenes por mes */}
      <div className="mb-6 bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reordenes por Mes (Últimos 12 meses)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#3b82f6" name="Reordenes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filtros y botones de exportación */}
      <div className="mb-4 flex flex-wrap gap-4 items-end bg-white p-4 rounded-lg shadow">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
          <input
            type="text"
            placeholder="Buscar por producto o ID..."
            className="w-full border rounded px-3 py-2 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            inputMode="search"
            aria-label="Buscar reordenes"
            autoComplete="off"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="requested">Solicitado</option>
            <option value="ordered">Ordenado</option>
            <option value="received">Recibido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <button
            type="button"
            className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
          >
            Limpiar filtros
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
            onClick={exportToCSV}
            title="Exportar a CSV"
          >
            <FileText className="w-4 h-4" />
            CSV
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
            onClick={exportToExcel}
            title="Exportar a Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
            onClick={exportToPDF}
            title="Exportar a PDF"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 w-12"></th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Producto</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Cantidad</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Notas</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Creado</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Actualizado</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-500">Cargando…</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-500">
                    {items.length === 0 ? 'Sin solicitudes' : 'Sin resultados para los filtros aplicados'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((it) => (
                  <React.Fragment key={it.id}>
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-gray-600 hover:text-gray-900"
                          onClick={() => loadHistory(it.id)}
                          title="Ver historial"
                        >
                          {expandedRow === it.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">#{it.id}</td>
                      <td className="px-4 py-3 text-gray-800">{it.product_name || `Producto #${it.product}`}</td>
                      <td className="px-4 py-3 text-gray-800">{it.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${statusClass[it.status]}`}>
                          {it.status === 'requested' && <Clock className="w-4 h-4" />}
                          {it.status === 'ordered' && <Truck className="w-4 h-4" />}
                          {it.status === 'received' && <CheckCircle2 className="w-4 h-4" />}
                          {it.status === 'cancelled' && <XCircle className="w-4 h-4" />}
                          {statusLabel[it.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[280px]" title={it.notes || ''}>{it.notes || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(it.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(it.updated_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          {it.status === 'requested' && (
                            <button
                              type="button"
                              className={`px-3 py-1 text-xs rounded text-white ${updatingId===it.id? 'bg-amber-400':'bg-amber-600 hover:bg-amber-700'}`}
                              onClick={() => doTransition(it.id, 'ordered')}
                              disabled={updatingId === it.id}
                            >Marcar ordenado</button>
                          )}
                          {(it.status === 'requested' || it.status === 'ordered') && (
                            <button
                              type="button"
                              className={`px-3 py-1 text-xs rounded text-white ${updatingId===it.id? 'bg-green-400':'bg-green-600 hover:bg-green-700'}`}
                              onClick={() => doTransition(it.id, 'received')}
                              disabled={updatingId === it.id}
                            >Marcar recibido</button>
                          )}
                          {(it.status === 'requested' || it.status === 'ordered') && (
                            <button
                              type="button"
                              className={`px-3 py-1 text-xs rounded text-white ${updatingId===it.id? 'bg-gray-400':'bg-gray-600 hover:bg-gray-700'}`}
                              onClick={() => doTransition(it.id, 'cancelled')}
                              disabled={updatingId === it.id}
                            >Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRow === it.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="ml-8">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <History className="w-4 h-4" />
                              Historial de Cambios
                            </h3>
                            {loadingHistory === it.id ? (
                              <p className="text-sm text-gray-500">Cargando historial...</p>
                            ) : historyMap[it.id] && historyMap[it.id].length > 0 ? (
                              <div className="space-y-3">
                                {historyMap[it.id].map((h, idx) => (
                                  <div key={idx} className="flex items-start gap-3 text-sm border-l-2 border-blue-400 pl-4 py-1">
                                    <div className="flex-1">
                                      <div className="text-gray-900">
                                        <span className="font-medium">{h.old_status ? statusLabel[h.old_status as ReorderStatus] : 'Inicial'}</span>
                                        {' → '}
                                        <span className="font-medium">{statusLabel[h.new_status as ReorderStatus]}</span>
                                      </div>
                                      {h.notes && <div className="text-gray-600 mt-1">{h.notes}</div>}
                                      <div className="text-gray-500 text-xs mt-1">
                                        Por <span className="font-medium">{h.changed_by}</span> - {new Date(h.changed_at).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">Sin historial de cambios</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para crear nueva reorden */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nueva Reorden"
      >
        <div className="space-y-4">
          {!selectedProduct ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Selecciona un producto con stock bajo para crear una solicitud de reorden
              </p>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {lowStockProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No hay productos con stock bajo disponibles
                  </p>
                ) : (
                  lowStockProducts.map(product => (
                    <button
                      key={product.id}
                      type="button"
                      className="w-full flex items-center justify-between p-3 border rounded hover:bg-gray-50 text-left"
                      onClick={() => handleCreateReorder(product)}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">SKU: {product.sku || 'N/A'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-red-700">
                            {product.quantity} / {product.min_stock}
                          </p>
                          <p className="text-xs text-gray-500">actual / mínimo</p>
                        </div>
                        <RefreshCw className="w-4 h-4 text-blue-600" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm text-gray-600">Producto seleccionado</p>
                <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                <p className="text-xs text-gray-500">SKU: {selectedProduct.sku || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Stock actual / Mínimo</p>
                <p className="font-medium text-gray-900">
                  {selectedProduct.quantity} / {selectedProduct.min_stock}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad a reordenar *
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full border rounded px-3 py-2"
                  value={newReorderQty}
                  onChange={(e) => setNewReorderQty(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={newReorderNotes}
                  onChange={(e) => setNewReorderNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
                  onClick={() => setSelectedProduct(null)}
                  disabled={creatingReorder}
                >
                  ← Volver
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creatingReorder}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={`px-4 py-2 text-sm text-white rounded ${
                      creatingReorder ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    onClick={submitCreateReorder}
                    disabled={creatingReorder || newReorderQty < 1}
                  >
                    {creatingReorder ? 'Creando…' : 'Confirmar Reorden'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ReordersPage;
