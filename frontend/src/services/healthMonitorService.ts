/**
 * Servicio para monitorear la salud de los microservicios
 * Integración con ServiceHealthCheck backend
 */

import apiClient, { API_URLS } from './api';

export interface ServiceHealth {
  service_name: 'personas' | 'inventario' | 'analytics' | 'auth';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  response_time_ms: number;
  last_check: string;
  error_message?: string | null;
  consecutive_failures: number;
}

export interface SystemHealth {
  overall_health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  services: ServiceHealth[];
  timestamp: string;
}

// Configuración de colores por estado
export const HEALTH_COLORS = {
  healthy: '#10b981', // Green
  degraded: '#f59e0b', // Amber
  unhealthy: '#ef4444', // Red
  unknown: '#6b7280', // Gray
};

// Configuración de iconos por estado
export const HEALTH_ICONS = {
  healthy: '✅',
  degraded: '⚠️',
  unhealthy: '❌',
  unknown: '❓',
};

class HealthMonitorService {
  private client = apiClient;

  /**
   * Obtener estado de todos los servicios
   */
  async getSystemHealth(): Promise<SystemHealth | null> {
    try {
      // Endpoint que será agregado al backend
      const response = await this.client.get(
        `${API_URLS.AUTH}/api/health/services/`
      );

      if (response.status === 200 && response.data) {
        return {
          overall_health: response.data.overall_health || 'unknown',
          services: response.data.services || [],
          timestamp: new Date().toISOString(),
        };
      }
      return null;
    } catch (error) {
      console.warn('No endpoint de health disponible aún:', error);
      return null;
    }
  }

  /**
   * Obtener estado de un servicio específico
   */
  async getServiceHealth(serviceName: string): Promise<ServiceHealth | null> {
    try {
      const response = await this.client.get(
        `${API_URLS.AUTH}/api/health/services/${serviceName}/`
      );

      if (response.status === 200) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.warn(`Error obteniendo salud de ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Obtener historial de salud de un servicio
   */
  async getServiceHealthHistory(
    serviceName: string,
    days: number = 7
  ): Promise<ServiceHealth[]> {
    try {
      const response = await this.client.get(
        `${API_URLS.AUTH}/api/health/services/${serviceName}/history/`,
        {
          params: { days },
        }
      );

      return response.data || [];
    } catch (error) {
      console.warn(
        `Error obteniendo historial de salud de ${serviceName}:`,
        error
      );
      return [];
    }
  }

  /**
   * Obtener estadísticas de eventos
   */
  async getEventStats(): Promise<{
    total_events: number;
    events_by_type: Record<string, number>;
    last_event_timestamp: string;
  } | null> {
    try {
      const response = await this.client.get(
        `${API_URLS.AUTH}/api/events/stats/`
      );

      return response.data || null;
    } catch (error) {
      console.warn('Error obteniendo estadísticas de eventos:', error);
      return null;
    }
  }

  /**
   * Obtener métricas de caché
   */
  async getCacheStats(): Promise<{
    total_keys: number;
    hit_rate: number;
    miss_rate: number;
    memory_usage_mb: number;
  } | null> {
    try {
      const response = await this.client.get(
        `${API_URLS.AUTH}/api/cache/stats/`
      );

      return response.data || null;
    } catch (error) {
      console.warn('Error obteniendo estadísticas de caché:', error);
      return null;
    }
  }

  /**
   * Obtener estado de Celery
   */
  async getCeleryStats(): Promise<{
    active_tasks: number;
    scheduled_tasks: number;
    queue_length: number;
    worker_count: number;
  } | null> {
    try {
      const response = await this.client.get(
        `${API_URLS.AUTH}/api/celery/stats/`
      );

      return response.data || null;
    } catch (error) {
      console.warn('Error obteniendo estadísticas de Celery:', error);
      return null;
    }
  }

  /**
   * Helper para determinar si un servicio está saludable
   */
  isServiceHealthy(status: string): boolean {
    return status === 'healthy';
  }

  /**
   * Helper para obtener descripción de estado
   */
  getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      healthy: 'Servicio operando normalmente',
      degraded: 'Servicio operando con latencia',
      unhealthy: 'Servicio no disponible',
      unknown: 'Estado desconocido',
    };
    return descriptions[status] || 'Estado desconocido';
  }
}

export default new HealthMonitorService();
