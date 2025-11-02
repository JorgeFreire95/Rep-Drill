/**
 * Hook para monitoreo de tareas Celery
 * Seguimiento de estado y progreso de tareas asincrónicas
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';

export interface CeleryTask {
  task_id: string;
  task_name: string;
  state: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY';
  progress: number;
  result?: unknown;
  error?: string;
  created_at: string;
  completed_at?: string;
  eta_seconds?: number;
}

export interface CeleryStats {
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  pending_tasks: number;
  worker_count: number;
  total_processed: number;
  tasks: CeleryTask[];
}

export interface TaskProgress {
  taskId: string;
  progress: number;
  eta: number;
  status: CeleryTask['state'];
}

export const useCeleryMonitor = () => {
  const [celeryStats, setCeleryStats] = useState<CeleryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskProgresses, setTaskProgresses] = useState<Map<string, TaskProgress>>(
    new Map()
  );
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Obtener estadísticas de Celery
   */
  const getCeleryStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<CeleryStats>('/api/celery/stats/');
      setCeleryStats(response.data);

      // Actualizar progreso de tareas activas
      if (response.data.tasks) {
        const newProgresses = new Map<string, TaskProgress>();
        response.data.tasks.forEach((task) => {
          newProgresses.set(task.task_id, {
            taskId: task.task_id,
            progress: task.progress,
            eta: task.eta_seconds || 0,
            status: task.state,
          });
        });
        setTaskProgresses(newProgresses);
      }

      return response.data;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Error al obtener estadísticas Celery';
      setError(errorMsg);
      console.warn('Celery stats unavailable, using fallback');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Obtener estado de tarea específica
   */
  const getTaskStatus = useCallback(
    async (taskId: string): Promise<CeleryTask | null> => {
      try {
        const response = await api.get<CeleryTask>(
          `/api/celery/tasks/${taskId}/`
        );
        return response.data;
      } catch (err) {
        console.error(`Error getting task ${taskId}:`, err);
        return null;
      }
    },
    []
  );

  /**
   * Cancelar tarea
   */
  const cancelTask = useCallback(async (taskId: string) => {
    try {
      await api.post(`/api/celery/tasks/${taskId}/cancel/`, {});
      return true;
    } catch (err) {
      console.error(`Error cancelling task ${taskId}:`, err);
      return false;
    }
  }, []);

  /**
   * Reintentar tarea fallida
   */
  const retryTask = useCallback(async (taskId: string) => {
    try {
      const response = await api.post(`/api/celery/tasks/${taskId}/retry/`, {});
      return response.data;
    } catch (err) {
      console.error(`Error retrying task ${taskId}:`, err);
      return null;
    }
  }, []);

  /**
   * Obtener historial de tareas
   */
  const getTaskHistory = useCallback(
    async (limit: number = 50, offset: number = 0) => {
      try {
        const response = await api.get<{ count: number; results: CeleryTask[] }>(
          `/api/celery/tasks/`,
          {
            params: { limit, offset },
          }
        );
        return response.data.results;
      } catch (err) {
        console.error('Error getting task history:', err);
        return [];
      }
    },
    []
  );

  /**
   * Monitorear tarea hasta completarse
   */
  const monitorTask = useCallback(
    async (
      taskId: string,
      onProgress?: (progress: TaskProgress) => void,
      maxAttempts = 300
    ): Promise<CeleryTask | null> => {
      let attempts = 0;

      return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          attempts++;

          const task = await getTaskStatus(taskId);

          if (task) {
            const progress: TaskProgress = {
              taskId,
              progress: task.progress,
              eta: task.eta_seconds || 0,
              status: task.state,
            };

            setTaskProgresses((prev) => {
              const updated = new Map(prev);
              updated.set(taskId, progress);
              return updated;
            });

            if (onProgress) {
              onProgress(progress);
            }

            // Tarea completada o falló
            if (task.state === 'SUCCESS' || task.state === 'FAILURE') {
              clearInterval(checkInterval);
              resolve(task);
              return;
            }
          }

          // Máximo de intentos alcanzado
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve(null);
          }
        }, 1000); // Cada segundo
      });
    },
    [getTaskStatus]
  );

  /**
   * Iniciar monitoreo automático
   */
  const startAutoMonitoring = useCallback(
    (intervalMs: number = 5000) => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(() => {
        getCeleryStats();
      }, intervalMs);
    },
    [getCeleryStats]
  );

  /**
   * Detener monitoreo automático
   */
  const stopAutoMonitoring = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Obtener color según estado
   */
  const getStatusColor = (status: CeleryTask['state']): string => {
    switch (status) {
      case 'SUCCESS':
        return '#10b981'; // Green
      case 'FAILURE':
        return '#ef4444'; // Red
      case 'STARTED':
      case 'RETRY':
        return '#3b82f6'; // Blue
      case 'PENDING':
        return '#f59e0b'; // Amber
      default:
        return '#6b7280'; // Gray
    }
  };

  /**
   * Obtener icono según estado
   */
  const getStatusIcon = (status: CeleryTask['state']): string => {
    switch (status) {
      case 'SUCCESS':
        return '✅';
      case 'FAILURE':
        return '❌';
      case 'STARTED':
        return '⏳';
      case 'RETRY':
        return '🔄';
      case 'PENDING':
        return '⏹️';
      default:
        return '❓';
    }
  };

  /**
   * Obtener descripción de estado
   */
  const getStatusDescription = (status: CeleryTask['state']): string => {
    switch (status) {
      case 'SUCCESS':
        return 'Completada exitosamente';
      case 'FAILURE':
        return 'Falló';
      case 'STARTED':
        return 'En progreso';
      case 'RETRY':
        return 'Reintentando';
      case 'PENDING':
        return 'Pendiente';
      default:
        return 'Estado desconocido';
    }
  };

  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    getCeleryStats,
    getTaskStatus,
    cancelTask,
    retryTask,
    getTaskHistory,
    monitorTask,
    startAutoMonitoring,
    stopAutoMonitoring,
    getStatusColor,
    getStatusIcon,
    getStatusDescription,
    celeryStats,
    taskProgresses,
    loading,
    error,
  };
};
