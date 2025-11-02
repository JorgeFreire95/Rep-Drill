/**
 * Hook para integración de eventos en tiempo real
 * Sincronización con Redis Streams a través de Server-Sent Events
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';

export interface EventStreamData {
  event_id: string;
  event_type: string;
  source_service: string;
  timestamp: string;
  data: Record<string, unknown>;
  correlation_id?: string;
}

export interface EventSubscription {
  event_type: string;
  callback: (event: EventStreamData) => void;
  active: boolean;
}

export const useEventStream = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<EventStreamData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const subscriptionsRef = useRef<Map<string, EventSubscription>>(new Map());
  const eventsBufferRef = useRef<EventStreamData[]>([]);

  /**
   * Conectar a stream de eventos
   */
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('Ya conectado a stream de eventos');
      return;
    }

    try {
      // Usar fallback si SSE no está disponible
      eventSourceRef.current = new EventSource('/api/events/stream/', {
        withCredentials: true,
      } as EventSourceInit);

      eventSourceRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('Conectado a stream de eventos');
      };

      eventSourceRef.current.onmessage = (evt: MessageEvent) => {
        try {
          const event: EventStreamData = JSON.parse(evt.data);
          
          // Agregar a buffer
          eventsBufferRef.current.unshift(event);
          
          // Mantener último 100 eventos
          if (eventsBufferRef.current.length > 100) {
            eventsBufferRef.current = eventsBufferRef.current.slice(0, 100);
          }

          setEvents([...eventsBufferRef.current]);

          // Notificar a subscriptores
          subscriptionsRef.current.forEach((subscription) => {
            if (
              subscription.active &&
              (subscription.event_type === '*' ||
                subscription.event_type === event.event_type)
            ) {
              subscription.callback(event);
            }
          });
        } catch (parseErr) {
          console.error('Error parsing event:', parseErr);
        }
      };

      eventSourceRef.current.onerror = (err: Event) => {
        console.error('EventSource error:', err);
        setIsConnected(false);
        setError('Desconectado del stream de eventos');
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Error al conectar a stream de eventos';
      setError(errorMsg);
      console.error('Error connecting to event stream:', err);
    }
  }, []);

  /**
   * Desconectar del stream
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      console.log('Desconectado del stream de eventos');
    }
  }, []);

  /**
   * Suscribirse a eventos
   */
  const subscribe = useCallback(
    (
      eventType: string,
      callback: (event: EventStreamData) => void,
      immediate = false
    ) => {
      const id = `${eventType}_${Date.now()}`;
      subscriptionsRef.current.set(id, {
        event_type: eventType,
        callback,
        active: true,
      });

      // Procesar eventos en buffer si es inmediato
      if (immediate) {
        eventsBufferRef.current.forEach((event) => {
          if (
            eventType === '*' ||
            eventType === event.event_type
          ) {
            callback(event);
          }
        });
      }

      return id;
    },
    []
  );

  /**
   * Desuscribirse de eventos
   */
  const unsubscribe = useCallback((subscriptionId: string) => {
    subscriptionsRef.current.delete(subscriptionId);
  }, []);

  /**
   * Obtener eventos filtrados
   */
  const getEvents = useCallback(
    (eventType?: string, limit: number = 50): EventStreamData[] => {
      if (!eventType || eventType === '*') {
        return eventsBufferRef.current.slice(0, limit);
      }
      return eventsBufferRef.current
        .filter((e) => e.event_type === eventType)
        .slice(0, limit);
    },
    []
  );

  /**
   * Publicar evento (para testing)
   */
  const publishEvent = useCallback(
    async (
      eventType: string,
      data: Record<string, unknown>
    ): Promise<boolean> => {
      try {
        await api.post('/api/events/publish/', {
          event_type: eventType,
          data,
        });
        return true;
      } catch (err) {
        console.error('Error publishing event:', err);
        return false;
      }
    },
    []
  );

  /**
   * Limpiar buffer de eventos
   */
  const clearEvents = useCallback(() => {
    eventsBufferRef.current = [];
    setEvents([]);
  }, []);

  /**
   * Obtener estadísticas de eventos
   */
  const getEventStats = useCallback(async () => {
    try {
      const response = await api.get('/api/events/stats/');
      return response.data;
    } catch (err) {
      console.error('Error getting event stats:', err);
      return null;
    }
  }, []);

  /**
   * Polling fallback (si SSE no está disponible)
   */
  const startPolling = useCallback((intervalMs: number = 5000) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get<EventStreamData[]>(
          '/api/events/recent/'
        );

        // Obtener eventos nuevos
        const newEvents = response.data.filter(
          (e) =>
            !eventsBufferRef.current.some(
              (existing) => existing.event_id === e.event_id
            )
        );

        if (newEvents.length > 0) {
          newEvents.forEach((event) => {
            eventsBufferRef.current.unshift(event);
            
            // Notificar a subscriptores
            subscriptionsRef.current.forEach((subscription) => {
              if (
                subscription.active &&
                (subscription.event_type === '*' ||
                  subscription.event_type === event.event_type)
              ) {
                subscription.callback(event);
              }
            });
          });

          // Mantener máximo 100 eventos
          if (eventsBufferRef.current.length > 100) {
            eventsBufferRef.current = eventsBufferRef.current.slice(0, 100);
          }

          setEvents([...eventsBufferRef.current]);
        }
      } catch (err) {
        console.error('Error polling events:', err);
      }
    }, intervalMs);

    return () => clearInterval(pollInterval);
  }, []);

  // Auto-conectar al montar
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    events,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    getEvents,
    publishEvent,
    clearEvents,
    getEventStats,
    startPolling,
    eventCount: events.length,
  };
};

/**
 * Hook específico para eventos de órdenes
 */
export const useOrderEvents = () => {
  const eventStream = useEventStream();
  const [orderEvents, setOrderEvents] = useState<EventStreamData[]>([]);

  const subscribeToOrderEvents = useCallback(
    (callback?: (event: EventStreamData) => void) => {
      return eventStream.subscribe('order.*', (event) => {
        setOrderEvents((prev) => [event, ...prev].slice(0, 50));
        if (callback) {
          callback(event);
        }
      });
    },
    [eventStream]
  );

  return {
    ...eventStream,
    orderEvents,
    subscribeToOrderEvents,
  };
};

/**
 * Hook específico para eventos de pagos
 */
export const usePaymentEvents = () => {
  const eventStream = useEventStream();
  const [paymentEvents, setPaymentEvents] = useState<EventStreamData[]>([]);

  const subscribeToPaymentEvents = useCallback(
    (callback?: (event: EventStreamData) => void) => {
      return eventStream.subscribe('payment.*', (event) => {
        setPaymentEvents((prev) => [event, ...prev].slice(0, 50));
        if (callback) {
          callback(event);
        }
      });
    },
    [eventStream]
  );

  return {
    ...eventStream,
    paymentEvents,
    subscribeToPaymentEvents,
  };
};
