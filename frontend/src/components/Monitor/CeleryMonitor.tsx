/**
 * Componente para Monitorear Tareas Celery
 * Con estadísticas y detalles de tareas
 */

import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../../utils/logger';
import { useCeleryMonitor, type CeleryStats, type CeleryTask } from '../../hooks/useCeleryMonitor';
import './CeleryMonitor.css';

type SortField = 'task_id' | 'task_name' | 'state' | 'progress' | 'created_at';
type SortOrder = 'asc' | 'desc';

interface TaskFilter {
  state?: string;
  taskName?: string;
  searchQuery?: string;
}

export const CeleryMonitor: React.FC = () => {
  const { getCeleryStats, cancelTask, retryTask } = useCeleryMonitor();

  const [stats, setStats] = useState<CeleryStats | null>(null);
  const [tasks, setTasks] = useState<CeleryTask[]>([]);
  const [filters, setFilters] = useState<TaskFilter>({});
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedTask, setSelectedTask] = useState<CeleryTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Cargar estadísticas y tareas
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const celeryStats = await getCeleryStats();
        if (celeryStats) {
          setStats(celeryStats);
          setTasks(celeryStats.tasks || []);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error cargando estadísticas';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    if (autoRefresh) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [getCeleryStats, autoRefresh]);

  // Extraer opciones únicas
  const taskStates = useMemo(() => {
    const states = new Set<string>();
    tasks.forEach((t) => {
      states.add(t.state);
    });
    return Array.from(states).sort();
  }, [tasks]);

  const taskNames = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((t) => {
      names.add(t.task_name);
    });
    return Array.from(names).sort();
  }, [tasks]);

  // Filtrar y ordenar tareas
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Filtro por estado
        if (filters.state && task.state !== filters.state) {
          return false;
        }
        // Filtro por nombre
        if (filters.taskName && task.task_name !== filters.taskName) {
          return false;
        }
        // Filtro por búsqueda
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const taskId = task.task_id.toLowerCase();
          const taskName = task.task_name.toLowerCase();
          if (!taskId.includes(query) && !taskName.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'task_id':
            comparison = a.task_id.localeCompare(b.task_id);
            break;
          case 'task_name':
            comparison = a.task_name.localeCompare(b.task_name);
            break;
          case 'state':
            comparison = a.state.localeCompare(b.state);
            break;
          case 'progress':
            comparison = (a.progress || 0) - (b.progress || 0);
            break;
          case 'created_at':
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [tasks, filters, sortBy, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      const success = await cancelTask(taskId);
      if (success) {
        setTasks((prev) =>
          prev.map((t) =>
            t.task_id === taskId
              ? { ...t, state: 'FAILURE' as const }
              : t
          )
        );
      }
    } catch (err) {
      logger.error('Error cancelando tarea:', err);
    }
  };

  const handleRetry = async (taskId: string) => {
    try {
      await retryTask(taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.task_id === taskId
            ? { ...t, state: 'PENDING' as const }
            : t
        )
      );
    } catch (err) {
      logger.error('Error reintentando tarea:', err);
    }
  };

  const getStateIcon = (state: string): string => {
    switch (state) {
      case 'PENDING':
        return '⏳';
      case 'STARTED':
        return '▶️';
      case 'SUCCESS':
        return '✅';
      case 'FAILURE':
        return '❌';
      case 'RETRY':
        return '🔄';
      default:
        return '❓';
    }
  };

  const getStateBgColor = (state: string): string => {
    const colors: Record<string, string> = {
      PENDING: '#fef3c7',
      STARTED: '#dbeafe',
      SUCCESS: '#dcfce7',
      FAILURE: '#fee2e2',
      RETRY: '#fde2e4',
    };
    return colors[state] || '#f3f4f6';
  };

  const getStateBorderColor = (state: string): string => {
    const colors: Record<string, string> = {
      PENDING: '#fcd34d',
      STARTED: '#60a5fa',
      SUCCESS: '#86efac',
      FAILURE: '#fca5a5',
      RETRY: '#fb7185',
    };
    return colors[state] || '#e5e7eb';
  };

  return (
    <div className="celery-monitor">
      <div className="monitor-header">
        <div className="header-top">
          <h2>⚙️ Monitor de Tareas Celery</h2>
          <div className="header-buttons">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`btn-control ${autoRefresh ? 'active' : ''}`}
            >
              {autoRefresh ? '🔄 Auto-refresh' : '⏸️ Manual'}
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.active_tasks}</div>
              <div className="stat-label">Activas</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.completed_tasks}</div>
              <div className="stat-label">Completadas</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.failed_tasks}</div>
              <div className="stat-label">Fallos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.pending_tasks}</div>
              <div className="stat-label">Pendientes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.worker_count}</div>
              <div className="stat-label">Workers</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Estado</label>
            <select
              value={filters.state || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, state: e.target.value || undefined }))
              }
            >
              <option value="">-- Todos --</option>
              {taskStates.map((state) => (
                <option key={state} value={state}>
                  {state} ({tasks.filter((t) => t.state === state).length})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Tarea</label>
            <select
              value={filters.taskName || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, taskName: e.target.value || undefined }))
              }
            >
              <option value="">-- Todas --</option>
              {taskNames.map((name) => (
                <option key={name} value={name}>
                  {name} ({tasks.filter((t) => t.task_name === name).length})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Búsqueda</label>
            <input
              type="text"
              placeholder="ID o nombre de tarea..."
              value={filters.searchQuery || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value || undefined }))
              }
            />
          </div>

          <button
            onClick={() => setFilters({})}
            className="btn-clear"
          >
            Limpiar
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="monitor-info">
          {loading && <span className="info-item">🔄 Cargando...</span>}
          <span className="info-item">📊 Total: {tasks.length}</span>
          <span className="info-item">🔍 Filtradas: {filteredTasks.length}</span>
        </div>
      </div>

      {/* Tabla de Tareas */}
      <div className="tasks-table-container">
        <table className="tasks-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('task_id')} className="sortable">
                ID de Tarea
                {sortBy === 'task_id' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('task_name')} className="sortable">
                Nombre
                {sortBy === 'task_name' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('state')} className="sortable">
                Estado
                {sortBy === 'state' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('progress')} className="sortable">
                Progreso
                {sortBy === 'progress' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th>Resultado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-tasks">
                  Sin tareas
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr key={task.task_id} className="task-row">
                  <td className="task-id">
                    <code>{task.task_id.substring(0, 12)}...</code>
                  </td>
                  <td className="task-name">
                    <span className="name-badge">{task.task_name}</span>
                  </td>
                  <td className="task-state">
                    <div
                      className="state-badge"
                      style={{
                        backgroundColor: getStateBgColor(task.state),
                        borderColor: getStateBorderColor(task.state),
                      }}
                    >
                      <span className="state-icon">{getStateIcon(task.state)}</span>
                      <span>{task.state}</span>
                    </div>
                  </td>
                  <td className="task-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${task.progress || 0}%` }}
                      />
                    </div>
                    <span className="progress-text">{task.progress || 0}%</span>
                  </td>
                  <td className="task-result">
                    {task.result ? (
                      <code className="result-text">
                        {JSON.stringify(task.result).substring(0, 20)}...
                      </code>
                    ) : (
                      <span className="na">N/A</span>
                    )}
                  </td>
                  <td className="task-actions">
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="btn-action btn-view"
                      title="Ver detalles"
                    >
                      👁️
                    </button>
                    {task.state === 'FAILURE' && (
                      <button
                        onClick={() => handleRetry(task.task_id)}
                        className="btn-action btn-retry"
                        title="Reintentar"
                      >
                        🔄
                      </button>
                    )}
                    {(task.state === 'PENDING' || task.state === 'STARTED') && (
                      <button
                        onClick={() => handleCancel(task.task_id)}
                        className="btn-action btn-cancel"
                        title="Cancelar"
                      >
                        ⏹️
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalles */}
      {selectedTask && (
        <div className="task-detail-modal">
          <div className="modal-overlay" onClick={() => setSelectedTask(null)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalles de la Tarea</h3>
              <button onClick={() => setSelectedTask(null)} className="btn-close">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-field">
                <label>ID</label>
                <code className="detail-value">{selectedTask.task_id}</code>
              </div>
              <div className="detail-field">
                <label>Nombre</label>
                <span className="detail-value">{selectedTask.task_name}</span>
              </div>
              <div className="detail-field">
                <label>Estado</label>
                <div
                  className="detail-state-badge"
                  style={{
                    backgroundColor: getStateBgColor(selectedTask.state),
                    borderColor: getStateBorderColor(selectedTask.state),
                  }}
                >
                  <span>{getStateIcon(selectedTask.state)}</span>
                  <span>{selectedTask.state}</span>
                </div>
              </div>
              <div className="detail-field">
                <label>Progreso</label>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${selectedTask.progress || 0}%` }}
                  />
                </div>
                <span className="progress-text">{selectedTask.progress || 0}%</span>
              </div>
              <div className="detail-field">
                <label>Creada</label>
                <span className="detail-value">
                  {new Date(selectedTask.created_at).toLocaleString('es-CL')}
                </span>
              </div>
              {selectedTask.completed_at && (
                <div className="detail-field">
                  <label>Completada</label>
                  <span className="detail-value">
                    {new Date(selectedTask.completed_at).toLocaleString('es-CL')}
                  </span>
                </div>
              )}
              {selectedTask.eta_seconds && (
                <div className="detail-field">
                  <label>ETA</label>
                  <span className="detail-value">{selectedTask.eta_seconds}s</span>
                </div>
              )}
              {selectedTask.result ? (
                <div className="detail-field">
                  <label>Resultado</label>
                  <pre className="detail-result">
                    {String(JSON.stringify(selectedTask.result as Record<string, unknown>, null, 2))}
                  </pre>
                </div>
              ) : null}
              {selectedTask.error && (
                <div className="detail-field">
                  <label>Error</label>
                  <pre className="detail-error">
                    {selectedTask.error}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CeleryMonitor;
