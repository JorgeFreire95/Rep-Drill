/**
 * Componente para Monitorear Stream de Eventos
 * En tiempo real con filtros y búsqueda
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useEventStream, type EventStreamData } from '../../hooks/useEventStream';
import './EventMonitor.css';

type SortField = 'timestamp' | 'event_type' | 'source_service';
type SortOrder = 'asc' | 'desc';

interface EventFilter {
  eventType?: string;
  sourceService?: string;
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const EventMonitor: React.FC = () => {
  const { connect, disconnect, getEvents, isConnected, error } = useEventStream();
  const [events, setEvents] = useState<EventStreamData[]>([]);
  const [filters, setFilters] = useState<EventFilter>({});
  const [sortBy, setSortBy] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedEvent, setSelectedEvent] = useState<EventStreamData | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [pauseUpdates, setPauseUpdates] = useState(false);

  // Conectar/desconectar
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Obtener eventos
  useEffect(() => {
    if (pauseUpdates) return;

    const interval = setInterval(() => {
      const allEvents = getEvents();
      setEvents(allEvents);
    }, 1000);

    return () => clearInterval(interval);
  }, [getEvents, pauseUpdates]);

  // Extraer opciones únicas
  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    events.forEach((e) => {
      const baseType = e.event_type.split('.')[0];
      types.add(baseType);
    });
    return Array.from(types).sort();
  }, [events]);

  const sourceServices = useMemo(() => {
    const services = new Set(events.map((e) => e.source_service));
    return Array.from(services).sort();
  }, [events]);

  // Filtrar y ordenar eventos
  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => {
        // Filtro por tipo
        if (filters.eventType && !event.event_type.startsWith(filters.eventType)) {
          return false;
        }
        // Filtro por servicio
        if (filters.sourceService && event.source_service !== filters.sourceService) {
          return false;
        }
        // Filtro por búsqueda
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const dataStr = JSON.stringify(event.data).toLowerCase();
          const match =
            event.event_id.toLowerCase().includes(query) ||
            event.event_type.toLowerCase().includes(query) ||
            event.correlation_id?.toLowerCase().includes(query) ||
            dataStr.includes(query);
          if (!match) return false;
        }
        // Filtro por fecha
        if (filters.dateFrom) {
          const eventDate = new Date(event.timestamp).getTime();
          if (eventDate < new Date(filters.dateFrom).getTime()) return false;
        }
        if (filters.dateTo) {
          const eventDate = new Date(event.timestamp).getTime();
          if (eventDate > new Date(filters.dateTo).getTime()) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'timestamp':
            comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            break;
          case 'event_type':
            comparison = a.event_type.localeCompare(b.event_type);
            break;
          case 'source_service':
            comparison = a.source_service.localeCompare(b.source_service);
            break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [events, filters, sortBy, sortOrder]);

  const handleFilterChange = (key: keyof EventFilter, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getEventColor = (eventType: string): string => {
    const baseType = eventType.split('.')[0];
    const colors: Record<string, string> = {
      order: '#3b82f6',
      payment: '#10b981',
      inventory: '#f59e0b',
      customer: '#8b5cf6',
      shipment: '#ec4899',
      analytics: '#06b6d4',
    };
    return colors[baseType] || '#6b7280';
  };

  return (
    <div className="event-monitor">
      <div className="monitor-header">
        <div className="header-top">
          <h2>📡 Monitor de Eventos en Tiempo Real</h2>
          <div className="header-controls">
            <div className="connection-status">
              <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
              <span>{isConnected ? 'Conectado' : 'Desconectado'}</span>
            </div>
            <div className="header-buttons">
              <button
                onClick={() => setPauseUpdates(!pauseUpdates)}
                className={`btn-control ${pauseUpdates ? 'paused' : ''}`}
              >
                {pauseUpdates ? '▶️ Reanudar' : '⏸️ Pausar'}
              </button>
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`btn-control ${autoScroll ? 'active' : ''}`}
              >
                {autoScroll ? '📌 Auto-scroll' : '📍 Manual'}
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Tipo de Evento</label>
            <select
              value={filters.eventType || ''}
              onChange={(e) => handleFilterChange('eventType', e.target.value)}
            >
              <option value="">-- Todos --</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type} ({events.filter((e) => e.event_type.startsWith(type)).length})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Servicio</label>
            <select
              value={filters.sourceService || ''}
              onChange={(e) => handleFilterChange('sourceService', e.target.value)}
            >
              <option value="">-- Todos --</option>
              {sourceServices.map((service) => (
                <option key={service} value={service}>
                  {service} ({events.filter((e) => e.source_service === service).length})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Búsqueda</label>
            <input
              type="text"
              placeholder="ID, tipo, correlación, datos..."
              value={filters.searchQuery || ''}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Desde</label>
            <input
              type="datetime-local"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Hasta</label>
            <input
              type="datetime-local"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          <button
            onClick={() => setFilters({})}
            className="btn-clear-filters"
          >
            Limpiar
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="monitor-stats">
          <span className="stat">📊 Total: {events.length}</span>
          <span className="stat">🔍 Filtrados: {filteredEvents.length}</span>
          <span className="stat">
            ⏱️ Último: {events.length > 0 ? new Date(events[0].timestamp).toLocaleTimeString('es-CL') : 'N/A'}
          </span>
        </div>
      </div>

      {/* Tabla de Eventos */}
      <div className="events-table-container">
        <table className="events-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('timestamp')} className="sortable">
                Timestamp
                {sortBy === 'timestamp' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('event_type')} className="sortable">
                Tipo de Evento
                {sortBy === 'event_type' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th onClick={() => handleSort('source_service')} className="sortable">
                Servicio
                {sortBy === 'source_service' && (
                  <span className="sort-icon">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th>Correlación</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={5} className="no-events">
                  Sin eventos
                </td>
              </tr>
            ) : (
              filteredEvents.map((event) => (
                <tr key={event.event_id} className="event-row">
                  <td className="timestamp">
                    {new Date(event.timestamp).toLocaleTimeString('es-CL')}
                  </td>
                  <td className="event-type">
                    <span
                      className="event-badge"
                      style={{ backgroundColor: getEventColor(event.event_type) }}
                    >
                      {event.event_type}
                    </span>
                  </td>
                  <td className="source-service">
                    <span className="service-badge">{event.source_service}</span>
                  </td>
                  <td className="correlation-id">
                    {event.correlation_id ? (
                      <code>{event.correlation_id.substring(0, 12)}...</code>
                    ) : (
                      <span className="na">N/A</span>
                    )}
                  </td>
                  <td className="actions">
                    <button
                      onClick={() => setSelectedEvent(event)}
                      className="btn-view"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detalle de Evento */}
      {selectedEvent && (
        <div className="event-detail-modal">
          <div className="modal-overlay" onClick={() => setSelectedEvent(null)} />
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalles del Evento</h3>
              <button onClick={() => setSelectedEvent(null)} className="btn-close">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-field">
                <label>ID del Evento</label>
                <code className="detail-value">{selectedEvent.event_id}</code>
              </div>
              <div className="detail-field">
                <label>Tipo</label>
                <span
                  className="detail-badge"
                  style={{ backgroundColor: getEventColor(selectedEvent.event_type) }}
                >
                  {selectedEvent.event_type}
                </span>
              </div>
              <div className="detail-field">
                <label>Servicio</label>
                <span className="detail-value">{selectedEvent.source_service}</span>
              </div>
              <div className="detail-field">
                <label>Timestamp</label>
                <span className="detail-value">
                  {new Date(selectedEvent.timestamp).toLocaleString('es-CL')}
                </span>
              </div>
              {selectedEvent.correlation_id && (
                <div className="detail-field">
                  <label>ID de Correlación</label>
                  <code className="detail-value">{selectedEvent.correlation_id}</code>
                </div>
              )}
              <div className="detail-field">
                <label>Datos</label>
                <pre className="detail-json">
                  {JSON.stringify(selectedEvent.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventMonitor;
