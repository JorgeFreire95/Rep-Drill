import React, { useMemo, useState, useEffect } from 'react';
import { reportsService, type GroupBy } from '../services/reportsService';
import { inventarioService } from '../services/inventarioService';
import { FileDown, FileSpreadsheet, Filter, BarChart3, PackageSearch } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Product {
  id: number;
  name: string;
  sku: string;
}

interface Warehouse {
  id: number;
  name: string;
}

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'kardex'|'sales'|'profit'>('kardex');
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Filters
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultStart = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10), []);
  const [productId, setProductId] = useState<number | ''>('');
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [start, setStart] = useState<string>(defaultStart);
  const [end, setEnd] = useState<string>(today);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  // Data
  type KardexResponse = Awaited<ReturnType<typeof reportsService.getKardex>>;
  type SalesResponse = Awaited<ReturnType<typeof reportsService.getSalesReport>>;
  type ProfitResponse = Awaited<ReturnType<typeof reportsService.getProfitabilityReport>>;
  const [kardex, setKardex] = useState<KardexResponse | null>(null);
  const [sales, setSales] = useState<SalesResponse | null>(null);
  const [profit, setProfit] = useState<ProfitResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Cargar productos y bodegas al montar
  useEffect(() => {
    const loadData = async () => {
      try {
        // Cargar productos
        const productsData = await inventarioService.getProducts();
        const productList = Array.isArray(productsData) ? productsData : (productsData as { results?: Product[] }).results || [];
        setProducts(productList.map((p) => ({ id: p.id, name: p.name, sku: p.sku || '' })));

        // Cargar bodegas
        const warehousesData = await inventarioService.getWarehouses();
        const warehouseList = Array.isArray(warehousesData) ? warehousesData : (warehousesData as { results?: Warehouse[] }).results || [];
        setWarehouses(warehouseList.map((w) => ({ id: w.id, name: w.name })));
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      if (activeTab === 'kardex') {
        if (!productId) {
          alert('Por favor, seleccione un producto');
          return;
        }
        console.log('Loading kardex for product:', productId);
        const data = await reportsService.getKardex({ product_id: Number(productId), warehouse_id: warehouseId ? Number(warehouseId) : undefined, start_date: start, end_date: end });
        console.log('Kardex data:', data);
        setKardex(data);
      } else if (activeTab === 'sales') {
        console.log('Loading sales report:', { start, end, group_by: groupBy });
        const data = await reportsService.getSalesReport({ start, end, group_by: groupBy });
        console.log('Sales data:', data);
        setSales(data);
      } else {
        console.log('Loading profitability report:', { start, end });
        const data = await reportsService.getProfitabilityReport({ start, end });
        console.log('Profit data:', data);
        setProfit(data);
      }
    } catch (error) {
      console.error('Error loading report:', error);
      alert(`Error al cargar el reporte: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    if (activeTab === 'kardex' && kardex) {
      const ws = XLSX.utils.json_to_sheet(kardex.rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Kardex');
    } else if (activeTab === 'sales' && sales) {
      const ws = XLSX.utils.json_to_sheet(sales.rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
    } else if (activeTab === 'profit' && profit) {
      const ws = XLSX.utils.json_to_sheet(profit.rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Rentabilidad');
    }
    XLSX.writeFile(wb, `reporte_${activeTab}_${start}_${end}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let rows: Array<Array<string | number>> = [];
    let columns: string[] = [];

    const toCell = (v: unknown): string | number =>
      typeof v === 'number' || typeof v === 'string' ? v : '';

    if (activeTab === 'kardex' && kardex) {
      type KardexRow = KardexResponse['rows'][number];
      const kColumns: Array<keyof KardexRow> = ['date', 'warehouse_name', 'type', 'quantity', 'delta', 'balance', 'notes'];
      columns = kColumns as string[];
      rows = kardex.rows.map((r) => kColumns.map((c) => toCell(r[c])));
      doc.text(`Kardex Producto ${kardex.product?.name || kardex.product?.id}`, 14, 16);
    } else if (activeTab === 'sales' && sales) {
      type SalesRow = SalesResponse['rows'][number];
      const sColumns: Array<keyof SalesRow> = ['period', 'total_sales', 'total_orders', 'products_sold', 'average_order_value'];
      columns = sColumns as string[];
      rows = sales.rows.map((r) => sColumns.map((c) => toCell(r[c])));
      doc.text('Reporte de Ventas', 14, 16);
    } else if (activeTab === 'profit' && profit) {
      type ProfitRow = ProfitResponse['rows'][number];
      const pColumns: Array<keyof ProfitRow> = ['product_name', 'product_sku', 'quantity_sold', 'revenue', 'unit_cost', 'cost', 'profit', 'margin_pct'];
      columns = pColumns as string[];
      rows = profit.rows.map((r) => pColumns.map((c) => toCell(r[c])));
      doc.text('Reporte de Rentabilidad', 14, 16);
    }

    autoTable(doc, { head: [columns], body: rows, startY: 20 });
    doc.save(`reporte_${activeTab}_${start}_${end}.pdf`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Reportes</h1>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded"><FileSpreadsheet className="w-4 h-4"/> Excel</button>
          <button onClick={exportPDF} className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded"><FileDown className="w-4 h-4"/> PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b flex gap-2">
        <button className={`px-4 py-2 ${activeTab==='kardex'?'border-b-2 border-primary-600 text-primary-700':'text-gray-600'}`} onClick={()=>setActiveTab('kardex')}><PackageSearch className="inline w-4 h-4 mr-1"/> Kardex</button>
        <button className={`px-4 py-2 ${activeTab==='sales'?'border-b-2 border-primary-600 text-primary-700':'text-gray-600'}`} onClick={()=>setActiveTab('sales')}><BarChart3 className="inline w-4 h-4 mr-1"/> Ventas</button>
        <button className={`px-4 py-2 ${activeTab==='profit'?'border-b-2 border-primary-600 text-primary-700':'text-gray-600'}`} onClick={()=>setActiveTab('profit')}><BarChart3 className="inline w-4 h-4 mr-1"/> Rentabilidad</button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Inicio</label>
            <input type="date" value={start} onChange={e=>setStart(e.target.value)} className="input"/>
          </div>
          <div>
            <label className="label">Fin</label>
            <input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="input"/>
          </div>
          {activeTab==='kardex' && (
            <>
              <div>
                <label className="label">Producto</label>
                <select 
                  value={productId} 
                  onChange={e=>setProductId(e.target.value ? Number(e.target.value) : '')} 
                  className="input"
                >
                  <option value="">Seleccione un producto</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Bodega (opcional)</label>
                <select 
                  value={warehouseId} 
                  onChange={e=>setWarehouseId(e.target.value ? Number(e.target.value) : '')} 
                  className="input"
                >
                  <option value="">Todas las bodegas</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {activeTab==='sales' && (
            <div>
              <label className="label">Agrupar por</label>
              <select value={groupBy} onChange={e=>setGroupBy(e.target.value as GroupBy)} className="input">
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
            </div>
          )}

          <button onClick={load} className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded"><Filter className="w-4 h-4"/> Aplicar</button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : (
          <>
            {activeTab==='kardex' && !productId && (
              <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded text-blue-700">
                <PackageSearch className="w-5 h-5"/>
                <span>Por favor, ingrese un <b>Producto ID</b> y haga clic en <b>Aplicar</b> para ver el Kardex.</span>
              </div>
            )}
            {activeTab==='kardex' && productId && !kardex && (
              <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded text-gray-600">
                <PackageSearch className="w-5 h-5"/>
                <span>Haga clic en <b>Aplicar</b> para cargar el Kardex del producto {productId}.</span>
              </div>
            )}
            {activeTab==='kardex' && kardex && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Producto: <b>{kardex.product?.name || kardex.product?.id}</b> · Desde {kardex.start_date} hasta {kardex.end_date}</p>
                {kardex.rows.length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 mb-4">
                    No se encontraron movimientos de inventario para este producto en el rango de fechas seleccionado.
                  </div>
                )}
                {kardex.rows.length > 0 && (
                  <div className="max-h-96 overflow-auto border rounded">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">Fecha</th>
                          <th className="p-2 text-left">Bodega</th>
                          <th className="p-2 text-left">Tipo</th>
                          <th className="p-2 text-right">Cantidad</th>
                          <th className="p-2 text-right">Δ</th>
                          <th className="p-2 text-right">Balance</th>
                          <th className="p-2 text-left">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kardex.rows.map((r, idx)=> (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{r.date}</td>
                            <td className="p-2">{r.warehouse_name || r.warehouse_id}</td>
                            <td className="p-2">{r.type}</td>
                            <td className="p-2 text-right">{r.quantity}</td>
                            <td className="p-2 text-right">{r.delta}</td>
                            <td className="p-2 text-right">{r.balance}</td>
                            <td className="p-2">{r.notes || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab==='sales' && !sales && (
              <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded text-gray-600">
                <BarChart3 className="w-5 h-5"/>
                <span>Haga clic en <b>Aplicar</b> para cargar el reporte de ventas.</span>
              </div>
            )}
            {activeTab==='sales' && sales && (
              <div>
                {sales.rows.length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 mb-4">
                    No se encontraron ventas en el rango de fechas seleccionado.
                  </div>
                )}
                {sales.rows.length > 0 && (
                  <>
                    <div className="h-72 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sales.rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} angle={0} height={40} />
                          <YAxis tickFormatter={(v)=> v.toLocaleString('es-CL')} width={80} />
                          <Tooltip formatter={(value: unknown) =>
                            typeof value === 'number'
                              ? value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })
                              : String(value)
                          }/>
                          <Line type="monotone" dataKey="total_sales" stroke="#2563eb" strokeWidth={2} dot={false} name="Ventas" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="max-h-96 overflow-auto border rounded">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="p-2 text-left">Período</th>
                            <th className="p-2 text-right">Ventas</th>
                            <th className="p-2 text-right">Órdenes</th>
                            <th className="p-2 text-right">Productos</th>
                            <th className="p-2 text-right">Ticket prom.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sales.rows.map((r, idx)=> (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{r.period}</td>
                              <td className="p-2 text-right">{r.total_sales.toLocaleString('es-CL',{style:'currency',currency:'CLP'})}</td>
                              <td className="p-2 text-right">{r.total_orders}</td>
                              <td className="p-2 text-right">{r.products_sold}</td>
                              <td className="p-2 text-right">{r.average_order_value.toLocaleString('es-CL',{style:'currency',currency:'CLP'})}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab==='profit' && !profit && (
              <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded text-gray-600">
                <BarChart3 className="w-5 h-5"/>
                <span>Haga clic en <b>Aplicar</b> para cargar el reporte de rentabilidad.</span>
              </div>
            )}
            {activeTab==='profit' && profit && (
              <div>
                {profit.rows.length === 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 mb-4">
                    No se encontraron datos de rentabilidad en el rango de fechas seleccionado.
                  </div>
                )}
                {profit.rows.length > 0 && (
                  <div className="max-h-96 overflow-auto border rounded">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">Producto</th>
                          <th className="p-2 text-left">SKU</th>
                          <th className="p-2 text-right">Unidades</th>
                          <th className="p-2 text-right">Ingresos</th>
                          <th className="p-2 text-right">Costo</th>
                          <th className="p-2 text-right">Utilidad</th>
                          <th className="p-2 text-right">Margen %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profit.rows.map((r, idx)=> (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{r.product_name}</td>
                            <td className="p-2">{r.product_sku}</td>
                            <td className="p-2 text-right">{r.quantity_sold}</td>
                            <td className="p-2 text-right">{r.revenue.toLocaleString('es-CL',{style:'currency',currency:'CLP'})}</td>
                            <td className="p-2 text-right">{r.cost.toLocaleString('es-CL',{style:'currency',currency:'CLP'})}</td>
                            <td className="p-2 text-right">{r.profit.toLocaleString('es-CL',{style:'currency',currency:'CLP'})}</td>
                            <td className="p-2 text-right">{r.margin_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
