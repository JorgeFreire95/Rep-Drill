import React, { useMemo, useState } from 'react';
import { reportsService, type GroupBy } from '../services/reportsService';
import { FileDown, FileSpreadsheet, Filter, BarChart3 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales'|'profit'>('sales');

  // Filters
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultStart = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10), []);
  const [start, setStart] = useState<string>(defaultStart);
  const [end, setEnd] = useState<string>(today);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  // Data
  type SalesResponse = Awaited<ReturnType<typeof reportsService.getSalesReport>>;
  type ProfitResponse = Awaited<ReturnType<typeof reportsService.getProfitabilityReport>>;
  const [sales, setSales] = useState<SalesResponse | null>(null);
  const [profit, setProfit] = useState<ProfitResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
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
    if (activeTab === 'sales' && sales) {
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

    if (activeTab === 'sales' && sales) {
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
