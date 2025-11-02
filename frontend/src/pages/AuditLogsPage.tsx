import React, { useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, ListTree, Download } from 'lucide-react';
import { auditService, type AuditLog, type AuditAction } from '../services/auditService';
import { format } from 'date-fns';
import { logger } from '../utils/logger';

const MODELS = ['Product', 'Inventory'];
const ACTIONS: AuditAction[] = ['create', 'update', 'delete'];

export const AuditLogsPage: React.FC = () => {
  const [model, setModel] = useState<string>('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [days, setDays] = useState<number>(30);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<{create:number; update:number; delete:number}>({create:0, update:0, delete:0});
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState<number>(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);
  const [exportScope, setExportScope] = useState<'page'|'all'>('page');

  const loadData = async () => {
    setLoading(true);
    try {
      const baseParams = { days, model: model || undefined, action: action || undefined, page, page_size: pageSize } as const;
      // Resumen filtrado con paginación
      const s = await auditService.summary(baseParams);
      setSummary(s.summary);
      setLogs(s.results);
      setTotalCount(s.count);

      // Si hay búsqueda, usar el ViewSet con paginación nativa
      if (search.trim().length > 0) {
        const filtered = await auditService.list({ search, model: model || undefined, action: action || undefined, ordering: '-created_at', page, page_size: pageSize });
        setLogs(filtered.results);
        setTotalCount(filtered.count);
      }
    } catch (err) {
      logger.error('Error cargando auditoría', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, action, days, page, pageSize]);

  const total = useMemo(() => totalCount, [totalCount]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <History className="h-6 w-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Auditoría y Logs</h1>
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Modelo</label>
            <select className="mt-1 input" value={model} onChange={e=>setModel(e.target.value)}>
              <option value="">Todos</option>
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Acción</label>
            <select className="mt-1 input" value={action} onChange={e=>setAction(e.target.value as AuditAction | '')}>
              <option value="">Todas</option>
              {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Días</label>
            <select className="mt-1 input" value={days} onChange={e=>setDays(parseInt(e.target.value))}>
              {[1,7,30,90,180,365].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600">Buscar (actor u objeto)</label>
            <div className="mt-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input className="pl-9 input w-full" placeholder="usuario, nombre de producto, etc." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
          <button className="btn btn-secondary inline-flex items-center gap-2" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-800 font-medium">Creados</div>
          <div className="text-2xl font-bold text-green-900">{summary.create}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800 font-medium">Actualizados</div>
          <div className="text-2xl font-bold text-blue-900">{summary.update}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-800 font-medium">Eliminados</div>
          <div className="text-2xl font-bold text-red-900">{summary.delete}</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-700 font-medium">Total</div>
          <div className="text-2xl font-bold text-gray-900">{total}</div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2 text-gray-700">
          <ListTree className="h-4 w-4" /> Últimos eventos
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-gray-600">Exportar</label>
            <select className="input" value={exportScope} onChange={e=>setExportScope(e.target.value as 'page'|'all')}>
              <option value="page">Página actual</option>
              <option value="all">Todo el rango</option>
            </select>
            <button
              className="btn btn-primary inline-flex items-center gap-2"
              disabled={loading || totalCount === 0}
              onClick={async () => {
                try {
                  const blob = await auditService.exportCSV({
                    days,
                    model: model || undefined,
                    action: action || undefined,
                    search: search || undefined,
                    scope: exportScope,
                    page,
                    page_size: pageSize,
                  });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  const stamp = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
                  a.download = `auditoria_${stamp}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (e) {
                  logger.error('Error al exportar CSV', e);
                  alert('No se pudo exportar el CSV.');
                }
              }}
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Modelo</th>
                <th className="th">Acción</th>
                <th className="th">Objeto</th>
                <th className="th">Actor</th>
                <th className="th">IP</th>
                <th className="th">Cambios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>Cargando…</td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={7}>Sin resultados</td>
                </tr>
              )}
              {!loading && logs.map((log) => {
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="td">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm')}</td>
                    <td className="td">{log.model}</td>
                    <td className="td">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.action === 'create' ? 'bg-green-100 text-green-800' :
                        log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>{log.action}</span>
                    </td>
                    <td className="td">{log.object_repr || `ID ${log.object_id}`}</td>
                    <td className="td">{log.actor || '-'}</td>
                    <td className="td">{log.ip_address || '-'}</td>
                    <td className="td">
                      {log.changes ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-gray-600">ver</summary>
                          <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-200 max-w-xl overflow-auto">{JSON.stringify(log.changes, null, 2)}</pre>
                        </details>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Paginación */}
        <div className="px-4 py-3 border-t flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            Página {page} de {totalPages} · Mostrando {logs.length} de {total}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Por página</label>
            <select className="input" value={pageSize} onChange={e=>{ setPageSize(parseInt(e.target.value)); setPage(1); }}>
              {[10,25,50,100].map(sz => <option key={sz} value={sz}>{sz}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary" disabled={page<=1 || loading} onClick={()=> setPage(p => Math.max(1, p-1))}>Anterior</button>
              <button className="btn btn-secondary" disabled={page>=totalPages || loading} onClick={()=> setPage(p => Math.min(totalPages, p+1))}>Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
