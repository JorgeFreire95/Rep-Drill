import React, { useEffect, useRef, useState } from 'react';
import { suppliersService, type Supplier, type ProductSummary, type Reorder } from '../services/suppliersService';
import { inventarioService } from '../services/inventarioService';
import { Plus, Package, ShoppingBag, RefreshCcw, Edit2, Trash2, Link2, Unlink, Filter, MoreVertical } from 'lucide-react';
import { StarRating } from '../components/common/StarRating';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [purchases, setPurchases] = useState<Reorder[]>([]);
  const [purchasesStats, setPurchasesStats] = useState<{count:number; total_quantity:number; estimated_total_value:number; average_lead_time_days:number|null}>({count:0,total_quantity:0,estimated_total_value:0,average_lead_time_days:null});
  const [perf, setPerf] = useState<{evaluated_orders:number; on_time_orders:number; on_time_rate:number|null; average_lead_time_days:number|null; expected_days:number; window_days:number} | null>(null);

  // Attach UI state
  const [productQuery, setProductQuery] = useState('');
  type SearchProduct = { id:number; name:string; sku:string; cost_price?: number; quantity:number; min_stock:number };
  const [productResults, setProductResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [daysFilter, setDaysFilter] = useState(180);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{ id:number|null; name:string; email?:string; phone?:string; rating?:number|null }>({ id: null, name: '', email: '', phone: '', rating: null });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await suppliersService.list();
      setSuppliers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Cerrar menú al hacer clic fuera o presionar Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuId && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openMenuId) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  const selectSupplier = async (s: Supplier) => {
    setSelected(s);
    const [prods, purch] = await Promise.all([
      suppliersService.getProducts(s.id),
      suppliersService.getPurchases(s.id, 365)
    ]);
    setProducts(prods.results);
    setPurchases(purch.results);
    setPurchasesStats({
      count: purch.count,
      total_quantity: purch.total_quantity,
      estimated_total_value: purch.estimated_total_value,
      average_lead_time_days: purch.average_lead_time_days,
    });
    const performance = await suppliersService.getPerformance(s.id, { days: 365, expected_days: 7 });
    setPerf(performance);
  };

  const addSupplier = async () => {
    const name = window.prompt('Nombre del proveedor');
    if (!name) return;
    const email = window.prompt('Email (opcional)') || undefined;
    const created = await suppliersService.create({ name, email });
    setSuppliers(prev => [created, ...prev]);
  };

  const openEdit = (s: Supplier) => {
    setEditForm({ id: s.id, name: s.name, email: s.email, phone: s.phone, rating: s.rating ?? null });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    if (!editForm.id) return;
    const payload: Partial<Supplier> = {
      name: editForm.name,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      rating: typeof editForm.rating === 'number' ? Math.max(0, Math.min(5, editForm.rating)) : null,
    };
    const updated = await suppliersService.update(editForm.id, payload);
    setSuppliers(prev => prev.map(x => x.id === updated.id ? updated : x));
    if (selected && selected.id === updated.id) setSelected(updated);
    setShowEditModal(false);
  };

  const deleteSupplier = async (s: Supplier) => {
    if (!window.confirm(`Eliminar proveedor "${s.name}"?`)) return;
    await suppliersService.remove(s.id);
    setSuppliers(prev => prev.filter(x => x.id !== s.id));
    if (selected?.id === s.id) {
      setSelected(null);
      setProducts([]);
      setPurchases([]);
      setPerf(null);
    }
  };

  const searchProducts = async () => {
    if (!selected) return;
    const q = productQuery.trim();
    if (q.length < 2) { setProductResults([]); return; }
    setSearching(true);
    try {
  const results = await inventarioService.getProducts({ search: q });
      // Filter out products already attached
      const attachedIds = new Set(products.map(p => p.id));
  const pruned = results.filter((p) => !attachedIds.has(p.id));
  setProductResults(pruned.slice(0, 10) as SearchProduct[]);
    } finally {
      setSearching(false);
    }
  };

  const attachProduct = async (productId: number) => {
    if (!selected) return;
    await suppliersService.attachProduct(selected.id, productId);
    // refresh lists for selected supplier
    const prods = await suppliersService.getProducts(selected.id);
    setProducts(prods.results);
    setProductResults([]);
    setProductQuery('');
  };

  const detachProduct = async (productId: number) => {
    if (!selected) return;
    await suppliersService.detachProduct(selected.id, productId);
    const prods = await suppliersService.getProducts(selected.id);
    setProducts(prods.results);
  };

  const refreshPerformance = async () => {
    if (!selected) return;
    const performance = await suppliersService.getPerformance(selected.id, { days: 365, expected_days: 7, update: true });
    setPerf(performance);
  };

  const reloadPurchases = async () => {
    if (!selected) return;
    const purch = await suppliersService.getPurchases(selected.id, daysFilter, statusFilter);
    setPurchases(purch.results);
    setPurchasesStats({
      count: purch.count,
      total_quantity: purch.total_quantity,
      estimated_total_value: purch.estimated_total_value,
      average_lead_time_days: purch.average_lead_time_days,
    });
  };

  return (
    <>
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Proveedores</h1>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">
            <RefreshCcw className="w-4 h-4" /> Recargar
          </button>
          <button onClick={addSupplier} className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-medium text-gray-900 mb-3">Listado</h2>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : suppliers.length === 0 ? (
            <p className="text-gray-500">Sin proveedores</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {suppliers.map(s => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-sm text-gray-500">{s.email || '—'} · {s.phone || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 relative" ref={openMenuId === s.id ? menuRef : null}>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">{s.products_count ?? 0} productos</span>
                    {typeof s.rating === 'number' && (
                      <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded inline-flex items-center gap-1">
                        <StarRating value={s.rating} readOnly size={14} /> {s.rating.toFixed(1)}
                      </span>
                    )}
                    <button onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)} className="p-2 rounded hover:bg-gray-100">
                      <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                    {openMenuId === s.id && (
                      <div className="absolute right-0 top-8 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <button onClick={() => { setOpenMenuId(null); selectSupplier(s); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50">Ver detalle</button>
                        <button onClick={() => { setOpenMenuId(null); openEdit(s); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"><Edit2 className="w-4 h-4"/> Editar</button>
                        <button onClick={() => { setOpenMenuId(null); deleteSupplier(s); }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4"/> Eliminar</button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-medium text-gray-900 mb-3">Detalle</h2>
          {!selected ? (
            <p className="text-gray-500">Selecciona un proveedor para ver sus productos y compras.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{selected.name}</p>
                  <p className="text-sm text-gray-500">{selected.email || '—'} · {selected.phone || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 text-xs bg-gray-100 rounded">Compras: {purchasesStats.count}</span>
                  <span className="px-2 py-1 text-xs bg-gray-100 rounded">Unidades: {purchasesStats.total_quantity}</span>
                  <span className="px-2 py-1 text-xs bg-gray-100 rounded">Lead time prom.: {purchasesStats.average_lead_time_days ?? '—'} d</span>
                  <div className="inline-flex items-center gap-2" title="Calificación">
                    <StarRating
                      value={typeof selected.rating === 'number' ? selected.rating : 0}
                      onChange={async (val) => {
                        const updated = await suppliersService.update(selected.id, { rating: val });
                        setSelected(updated);
                        setSuppliers(prev => prev.map(x => x.id === updated.id ? updated : x));
                      }}
                    />
                  </div>
                  {perf && (
                    <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded" title="Entregas a tiempo (SLA)">
                      On-time: {typeof perf.on_time_rate === 'number' ? `${(perf.on_time_rate*100).toFixed(0)}%` : '—'}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700 inline-flex items-center gap-1"><Package className="w-4 h-4"/> Productos ({products.length})</h3>
                  <div className="flex items-center gap-2">
                    <input
                      value={productQuery}
                      onChange={e => setProductQuery(e.target.value)}
                      onKeyUp={(e) => { if (e.key === 'Enter') searchProducts(); }}
                      placeholder="Buscar productos para asociar..."
                      className="border rounded px-2 py-1 text-sm w-64"
                    />
                    <button onClick={searchProducts} className="text-sm inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded" disabled={searching}>
                      <Link2 className="w-4 h-4"/>
                      {searching ? 'Buscando...' : 'Buscar' }
                    </button>
                  </div>
                </div>
                {productResults.length > 0 && (
                  <div className="border rounded mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-2">Nombre</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2 text-right">Costo</th>
                          <th className="p-2 text-right">Stock</th>
                          <th className="p-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productResults.map(p => (
                          <tr key={p.id} className="border-t">
                            <td className="p-2">{p.name}</td>
                            <td className="p-2">{p.sku}</td>
                            <td className="p-2 text-right">${Number(p.cost_price||0).toLocaleString('es-CL')}</td>
                            <td className="p-2 text-right">{p.quantity} / {p.min_stock}</td>
                            <td className="p-2 text-right">
                              <button onClick={() => attachProduct(p.id)} className="text-sm inline-flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded">Asociar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {products.length === 0 ? (
                  <p className="text-gray-500 text-sm">Sin productos asociados</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-2">Nombre</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2 text-right">Costo</th>
                          <th className="p-2 text-right">Stock</th>
                          <th className="p-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id} className="border-t">
                            <td className="p-2">{p.name}</td>
                            <td className="p-2">{p.sku}</td>
                            <td className="p-2 text-right">${Number(p.cost_price||0).toLocaleString('es-CL')}</td>
                            <td className="p-2 text-right">{p.quantity} / {p.min_stock}</td>
                            <td className="p-2 text-right">
                              <button onClick={() => detachProduct(p.id)} className="text-sm inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">
                                <Unlink className="w-4 h-4"/> Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700 inline-flex items-center gap-1"><ShoppingBag className="w-4 h-4"/> Compras recientes ({purchases.length})</h3>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500"/>
                    <select value={daysFilter} onChange={e => setDaysFilter(parseInt(e.target.value))} className="border rounded px-2 py-1 text-sm">
                      <option value={30}>30d</option>
                      <option value={90}>90d</option>
                      <option value={180}>180d</option>
                      <option value={365}>365d</option>
                    </select>
                    <select value={statusFilter || ''} onChange={e => setStatusFilter(e.target.value || undefined)} className="border rounded px-2 py-1 text-sm">
                      <option value="">Todos</option>
                      <option value="requested">Solicitada</option>
                      <option value="ordered">Ordenada</option>
                      <option value="received">Recibida</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                    <button onClick={reloadPurchases} className="text-sm inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Aplicar</button>
                    <button onClick={refreshPerformance} className="text-sm inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded">Actualizar desempeño</button>
                  </div>
                </div>
                {purchases.length === 0 ? (
                  <p className="text-gray-500 text-sm">Sin reordenes registradas</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="p-2">Producto</th>
                          <th className="p-2 text-right">Cantidad</th>
                          <th className="p-2">Estado</th>
                          <th className="p-2">Creado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map(r => (
                          <tr key={r.id} className="border-t">
                            <td className="p-2">{r.product_name}</td>
                            <td className="p-2 text-right">{r.quantity}</td>
                            <td className="p-2 uppercase text-xs">{r.status}</td>
                            <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
  </div>
  {/* Edit Supplier Modal */}
    <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar proveedor">
      <div className="space-y-4">
        <Input label="Nombre" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del proveedor" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Email" type="email" value={editForm.email || ''} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
          <Input label="Teléfono" value={editForm.phone || ''} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+56 9 ..." />
        </div>
        <div>
          <label className="label">Calificación</label>
          <StarRating value={editForm.rating ?? 0} onChange={(val) => setEditForm(f => ({ ...f, rating: val }))} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancelar</Button>
          <Button onClick={submitEdit}>Guardar</Button>
        </div>
      </div>
    </Modal>
    </>
  );
};
