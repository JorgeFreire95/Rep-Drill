/**
 * Componente para Visualizar y Gestionar Cache
 * Con tabla de entries y TTL
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useCacheManager } from '../../hooks/useCacheManager';
import { logger } from '../../utils/logger';
import './CacheViewer.css';

type SortField = 'key' | 'size' | 'ttl' | 'created_at';
type SortOrder = 'asc' | 'desc';

interface CacheEntry {
  key: string;
  size: number;
  ttl: number;
  remaining: number;
  created_at: string;
  type: string;
}

interface CacheFilter {
  searchQuery?: string;
  typeFilter?: string;
}

export const CacheViewer: React.FC = () => {
  const { getCacheInfo, deleteCache, clearCache } = useCacheManager();

  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [filters, setFilters] = useState<CacheFilter>({});
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<CacheEntry | null>(null);

  // Cargar información del cache
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const cacheInfo = await getCacheInfo();
        setStats(cacheInfo);

        // Convertir a array de entries
        if (cacheInfo?.entries) {
          const entriesObj = (cacheInfo.entries as unknown) as Record<string, unknown>;
          const entriesArray = Object.entries(entriesObj).map(
            ([key, value]) => {
              const entryData = value as Record<string, unknown>;
              return {
                key,
                size: (entryData.size as number) || 0,
                ttl: (entryData.ttl as number) || 0,
                remaining: (entryData.remaining as number) || 0,
                created_at: (entryData.created_at as string) || new Date().toISOString(),
                type: String(entryData.type || 'unknown'),
              };
            }
          );
          setEntries(entriesArray);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error cargando cache';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    if (autoRefresh) {
      const interval = setInterval(loadData, 3000);
      return () => clearInterval(interval);
    }
  }, [getCacheInfo, autoRefresh]);

  // Extraer tipos únicos
  const entryTypes = useMemo(() => {
    const types = new Set(entries.map((e) => e.type));
    return Array.from(types).sort();
  }, [entries]);

  // Filtrar y ordenar entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        // Filtro por búsqueda
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          if (!entry.key.toLowerCase().includes(query)) {
            return false;
          }
        }
        // Filtro por tipo
        if (filters.typeFilter && entry.type !== filters.typeFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'key':
            comparison = a.key.localeCompare(b.key);
            break;
          case 'size':
            comparison = a.size - b.size;
            break;
          case 'ttl':
            comparison = a.ttl - b.ttl;
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [entries, filters, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteCache(key);
      setEntries((prev) => prev.filter((e) => e.key !== key));
    } catch (err) {
      logger.error('Error eliminando cache', { key, error: err });
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('¿Estás seguro de que deseas limpiar todo el cache?')) {
      try {
        await clearCache();
        setEntries([]);
      } catch (err) {
        logger.error('Error limpiando cache', { error: err });
      }
    }
  };

  const getTTLColor = (remaining: number): string => {
    if (remaining > 3600) return '#10b981'; // Verde
    if (remaining > 600) return '#f59e0b'; // Amarillo
    return '#ef4444'; // Rojo
  };

  const getTTLStatus = (remaining: number): string => {
    if (remaining > 3600) return 'Largo';
    if (remaining > 600) return 'Medio';
    return 'Corto';
  };

  const getTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      string: '📝',
      object: '🗂️',
      array: '📋',
      number: '🔢',
      boolean: '☑️',
      null: '⊘',
      unknown: '❓',
    };
    return icons[type.toLowerCase()] || '❓';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
  const expiredCount = entries.filter((e) => e.remaining < 300).length;

  return (
    <div className="cache-viewer">
      <div className="viewer-header">
        <div className="header-top">
          <h2>💾 Visor de Cache</h2>
          <div className="header-buttons">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`btn-control ${autoRefresh ? 'active' : ''}`}
            >
              {autoRefresh ? '🔄 Auto-refresh' : '⏸️ Manual'}
            </button>
            <button
              onClick={handleClearAll}
              className="btn-danger"
              disabled={entries.length === 0}
            >
              🗑️ Limpiar Todo
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-number">{entries.length}</div>
            <div className="stat-name">Entries</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{formatBytes(totalSize)}</div>
            <div className="stat-name">Tamaño Total</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{expiredCount}</div>
            <div className="stat-name">A Expirar</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">{(stats?.total_keys as number) || 0}</div>
            <div className="stat-name">Total en BD</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Búsqueda</label>
            <input
              type="text"
              placeholder="Buscar clave..."
              value={filters.searchQuery || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value || undefined }))
              }
            />
          </div>

          <div className="filter-group">
            <label>Tipo</label>
            <select
              value={filters.typeFilter || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, typeFilter: e.target.value || undefined }))
              }
            >
              <option value="">-- Todos --</option>
              {entryTypes.map((type) => (
                <option key={type} value={type}>
                  {type} ({entries.filter((e) => e.type === type).length})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setFilters({})}
            className="btn-clear"
          >
            Limpiar Filtros
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="viewer-info">
          {loading && <span className="info-item">🔄 Cargando...</span>}
          <span className="info-item">📊 Mostrando: {filteredEntries.length}/{entries.length}</span>
        </div>
      </div>

      {/* Tabla de Entries */}
      <div className="entries-table-container">
        <table className="entries-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('key')} className="sortable">
                Clave
                {sortBy === 'key' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th>Tipo</th>
              <th onClick={() => handleSort('size')} className="sortable">
                Tamaño
                {sortBy === 'size' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('ttl')} className="sortable">
                TTL
                {sortBy === 'ttl' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th>Estado TTL</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-entries">
                  Sin entries
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.key} className="entry-row">
                  <td className="entry-key">
                    <span className="key-badge">{entry.key}</span>
                  </td>
                  <td className="entry-type">
                    <span className="type-badge">
                      {getTypeIcon(entry.type)}
                      {entry.type}
                    </span>
                  </td>
                  <td className="entry-size">
                    {formatBytes(entry.size)}
                  </td>
                  <td className="entry-ttl">
                    {entry.ttl > 0 ? Math.floor(entry.ttl / 60) + 'm' : '∞'}
                  </td>
                  <td className="entry-status">
                    <div
                      className="ttl-indicator"
                      style={{
                        backgroundColor: getTTLColor(entry.remaining),
                      }}
                    >
                      <span className="status-text">{getTTLStatus(entry.remaining)}</span>
                      <span className="remaining">
                        {entry.remaining > 0 ? Math.floor(entry.remaining / 60) + 'm' : 'Expirado'}
                      </span>
                    </div>
                  </td>
                  <td className="entry-actions">
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="btn-view"
                      title="Ver detalles"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => handleDelete(entry.key)}
                      className="btn-delete"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalles */}
      {selectedEntry && (
        <div className="entry-detail-modal">
          <div className="modal-overlay" onClick={() => setSelectedEntry(null)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalles del Entry</h3>
              <button onClick={() => setSelectedEntry(null)} className="btn-close">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-field">
                <label>Clave</label>
                <code className="detail-value">{selectedEntry.key}</code>
              </div>
              <div className="detail-field">
                <label>Tipo</label>
                <span className="detail-value">
                  {getTypeIcon(selectedEntry.type)} {selectedEntry.type}
                </span>
              </div>
              <div className="detail-field">
                <label>Tamaño</label>
                <span className="detail-value">{formatBytes(selectedEntry.size)}</span>
              </div>
              <div className="detail-field">
                <label>TTL Original</label>
                <span className="detail-value">
                  {selectedEntry.ttl > 0 ? Math.floor(selectedEntry.ttl / 60) + ' minutos' : 'Sin expiración'}
                </span>
              </div>
              <div className="detail-field">
                <label>Tiempo Restante</label>
                <div
                  className="ttl-bar"
                  style={{
                    backgroundColor: getTTLColor(selectedEntry.remaining),
                  }}
                >
                  <span className="remaining-text">
                    {selectedEntry.remaining > 0
                      ? Math.floor(selectedEntry.remaining / 60) + ' minutos'
                      : 'Expirado'}
                  </span>
                </div>
              </div>
              <div className="detail-field">
                <label>Creado</label>
                <span className="detail-value">
                  {new Date(selectedEntry.created_at).toLocaleString('es-CL')}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  handleDelete(selectedEntry.key);
                  setSelectedEntry(null);
                }}
                className="btn-delete-modal"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CacheViewer;
