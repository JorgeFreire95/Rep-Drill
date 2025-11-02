/**
 * Logger utility para manejo centralizado de logs
 * 
 * En desarrollo: muestra logs en consola
 * En producción: envía logs críticos a servicio de monitoreo
 */

const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Envía logs a servicio de monitoreo externo (Sentry, LogRocket, etc.)
 * Solo en producción
 */
const sendToMonitoring = (_level: string, _message: string, _context?: LogContext) => {
  if (!isProduction) return;

  // TODO: Integrar con servicio de monitoreo
  // Ejemplo con Sentry:
  // if (window.Sentry) {
  //   window.Sentry.captureMessage(message, {
  //     level: level as any,
  //     extra: context,
  //   });
  // }

  // Ejemplo con fetch a endpoint de logs:
  // fetch('/api/logs', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     level,
  //     message,
  //     context,
  //     timestamp: new Date().toISOString(),
  //     userAgent: navigator.userAgent,
  //     url: window.location.href,
  //   }),
  // }).catch(() => {
  //   // Silenciar errores de logging para no romper la app
  // });
};

/**
 * Logger centralizado de la aplicación
 */
export const logger = {
  /**
   * Log de información general
   * Solo se muestra en desarrollo
   */
  log: (message: string, context?: LogContext) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, context || '');
    }
  },

  /**
   * Log de información general (alias de log)
   * Solo se muestra en desarrollo
   */
  info: (message: string, context?: LogContext) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, context || '');
    }
  },

  /**
   * Log de información de debugging
   * Solo se muestra en desarrollo
   */
  debug: (message: string, context?: LogContext) => {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context || '');
    }
  },

  /**
   * Log de advertencias
   * Se muestra en desarrollo y se envía a monitoreo en producción
   */
  warn: (message: string, context?: LogContext) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, context || '');
    }
    sendToMonitoring('warning', message, context);
  },

  /**
   * Log de errores
   * Se muestra en desarrollo y se envía a monitoreo en producción
   */
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };

    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, errorContext);
      if (error instanceof Error) {
        console.error(error);
      }
    }

    sendToMonitoring('error', message, errorContext);
  },

  /**
   * Log de errores críticos que requieren atención inmediata
   * Siempre se envía a monitoreo
   */
  critical: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorContext = {
      ...context,
      critical: true,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };

    console.error(`[CRITICAL] ${message}`, errorContext);
    if (error instanceof Error) {
      console.error(error);
    }

    sendToMonitoring('fatal', message, errorContext);
  },

  /**
   * Log de eventos de negocio importantes
   * Se registran siempre
   */
  event: (eventName: string, eventData?: LogContext) => {
    const eventContext = {
      event: eventName,
      ...eventData,
      timestamp: new Date().toISOString(),
    };

    if (isDevelopment) {
      console.log(`[EVENT] ${eventName}`, eventContext);
    }

    // Enviar a analytics/tracking
    sendToMonitoring('info', `Event: ${eventName}`, eventContext);
  },

  /**
   * Log de performance/timing
   * Útil para identificar cuellos de botella
   */
  performance: (label: string, durationMs: number, context?: LogContext) => {
    const perfContext = {
      ...context,
      duration_ms: durationMs,
      duration_seconds: (durationMs / 1000).toFixed(2),
    };

    if (isDevelopment) {
      console.log(`[PERFORMANCE] ${label}: ${durationMs}ms`, perfContext);
    }

    // Solo enviar si es una operación lenta (> 1 segundo)
    if (durationMs > 1000) {
      sendToMonitoring('warning', `Slow operation: ${label}`, perfContext);
    }
  },
};

/**
 * Helper para medir tiempo de ejecución de funciones
 * 
 * @example
 * const stopTimer = startTimer();
 * await fetchData();
 * stopTimer('Fetch data');
 */
export const startTimer = () => {
  const start = performance.now();
  return (label: string, context?: LogContext) => {
    const duration = performance.now() - start;
    logger.performance(label, duration, context);
  };
};

/**
 * Decorator para loggear automáticamente errores de funciones async
 * 
 * @example
 * const safeFetch = catchErrors(fetchData, 'Failed to fetch data');
 * await safeFetch();
 */
export const catchErrors = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorMessage: string
): T => {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(errorMessage, error, {
        function: fn.name,
        arguments: args,
      });
      throw error;
    }
  }) as T;
};

// Export default para importación más simple
export default logger;
