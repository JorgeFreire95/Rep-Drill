/**
 * Servicio para comunicación con el API del Chatbot.
 * Endpoints: /chatbot/api/chatbot/
 */
import apiClient from './api';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens_used?: number;
}

export interface ChatAskRequest {
  question: string;
  session_id?: string;
  periods?: number;
  include_context?: boolean;
}

export interface ChatAskResponse {
  answer: string;
  session_id: string;
  tokens_used: number;
  response_time_ms: number;
  model: string;
  context_summary?: {
    forecast_next_7_days: number;
    forecast_next_30_days: number;
    critical_restock_count: number;
    high_restock_count: number;
    forecast_accuracy_mape: number;
    confidence_level: string;
  };
}

export interface ChatHistoryResponse {
  session_id: string;
  started_at: string;
  ended_at?: string | null;
  message_count: number;
  messages: ChatMessage[];
}

export interface ChatHealthResponse {
  status: 'ok' | 'warning' | 'error';
  timestamp: string;
  service: string;
  ollama: {
    status: string;
    ollama_running: boolean;
    model_available: boolean;
    configured_model: string;
    available_models: string[];
    message: string;
  };
  analytics_service: {
    status: string;
    url: string;
  };
  database: {
    status: string;
  };
  redis: {
    status: string;
  };
}

export interface QuickQuestionsResponse {
  questions: string[];
}

/**
 * Servicio de Chatbot para análisis de forecasting.
 */
export const chatbotService = {
  /**
   * Envía una pregunta al chatbot.
   * 
   * @param question - Pregunta del usuario
   * @param sessionId - ID de sesión opcional (si no se provee, se crea uno nuevo)
   * @param periods - Días de forecast a analizar (default: 30)
   * @param includeContext - Incluir contexto completo en respuesta (default: false)
   * @returns Respuesta del chatbot con análisis
   */
  async ask(
    question: string,
    sessionId?: string,
    periods: number = 30,
    includeContext: boolean = false
  ): Promise<ChatAskResponse> {
    const payload: ChatAskRequest = {
      question,
      periods,
      include_context: includeContext,
    };

    if (sessionId) {
      payload.session_id = sessionId;
    }

    // El LLM puede tardar >60s en la primera respuesta o con contextos grandes.
    // Aumentamos el timeout sólo para esta llamada.
    const response = await apiClient.post<ChatAskResponse>(
      '/chatbot/api/chatbot/ask/',
      payload,
      { timeout: 120000 }
    );

    return response.data;
  },

  /**
   * Envía una pregunta al chatbot con streaming (SSE).
   * 
   * @param question - Pregunta del usuario
   * @param sessionId - ID de sesión opcional
   * @param periods - Días de forecast a analizar (default: 7)
   * @param onChunk - Callback ejecutado con cada chunk recibido
   * @param onDone - Callback ejecutado cuando termina el streaming
   * @param onError - Callback ejecutado si hay error
   * @param abortSignal - Signal para cancelar la petición
   * @returns Promise que se resuelve cuando se establece la conexión
   */
  async askStream(
    question: string,
    sessionId: string | undefined,
    periods: number = 7,
    onChunk: (chunk: string) => void,
    onDone: (tokens: number, responseTimeMs: number) => void,
    onError: (error: string) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const payload: ChatAskRequest = {
      question,
      periods,
      include_context: false,
    };

    if (sessionId) {
      payload.session_id = sessionId;
    }

    // Base URL del gateway (Nginx); usamos la de axios si está definida
    const baseURL = (apiClient.defaults.baseURL as string) || `${window.location.protocol}//${window.location.host}`;

    // Función auxiliar para realizar la petición de streaming con un token dado
    const doFetch = async (accessToken: string | null) => {
      return fetch(`${baseURL}/chatbot/api/chatbot/ask-stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        body: JSON.stringify(payload),
        signal: abortSignal,
      });
    };

    // Intento 1 con el token actual
    let response = await doFetch(localStorage.getItem('access_token'));

    // Si el token expiró, intentamos refrescar y reintentar UNA vez
    if (response.status === 401) {
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (!refresh) throw new Error('No refresh token');

        const refreshRes = await fetch(`${baseURL}/auth/api/v1/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });

        if (!refreshRes.ok) {
          throw new Error(`Refresh failed: ${refreshRes.status}`);
        }

        const data = await refreshRes.json();
        const newAccess = data?.access as string | undefined;
        if (!newAccess) throw new Error('Invalid refresh response');
        localStorage.setItem('access_token', newAccess);
        // Reintentar con el nuevo token
        response = await doFetch(newAccess);
      } catch {
        // Si falla el refresh, limpiar y redirigir a login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        onError('Sesión expirada. Inicia sesión nuevamente.');
        window.location.href = '/login';
        return;
      }
    }

    if (!response.ok) {
      // Propagamos error HTTP legible
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';

    if (!reader) {
      throw new Error('No se pudo obtener el reader del stream');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // Procesar por líneas completas; mantener el resto en buffer
        const parts = sseBuffer.split('\n');
        sseBuffer = parts.pop() ?? '';

        for (const rawLine of parts) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data: ')) continue;

          const jsonData = line.slice(6); // Remover "data: "
          try {
            const event = JSON.parse(jsonData);

            if (event.type === 'chunk') {
              onChunk(event.content);
            } else if (event.type === 'done') {
              onDone(event.tokens, event.response_time_ms);
              return;
            } else if (event.type === 'error') {
              onError(event.message);
              return;
            }
          } catch (e) {
            console.error('Error parsing SSE event:', e);
          }
        }
      }
    } catch (error) {
      const err = error as Error;
      if (err.name === 'AbortError') {
        console.log('Stream abortado por el usuario');
      } else {
        onError(err.message || 'Error desconocido en streaming');
      }
    }
  },

  /**
   * Obtiene el historial de mensajes de una sesión.
   * 
   * @param sessionId - ID de la sesión
   * @returns Historial completo de la conversación
   */
  async getHistory(sessionId: string): Promise<ChatHistoryResponse> {
    const response = await apiClient.get<ChatHistoryResponse>(
      '/chatbot/api/chatbot/history/',
      {
        params: { session_id: sessionId },
      }
    );

    return response.data;
  },

  /**
   * Finaliza una sesión de chat.
   * 
   * @param sessionId - ID de la sesión a finalizar
   */
  async clearSession(sessionId: string): Promise<void> {
    await apiClient.delete('/chatbot/api/chatbot/clear/', {
      params: { session_id: sessionId },
    });
  },

  /**
   * Verifica el estado de salud del servicio de chatbot.
   * 
   * @returns Estado del servicio (Ollama, Analytics, DB, Redis)
   */
  async checkHealth(): Promise<ChatHealthResponse> {
    const response = await apiClient.get<ChatHealthResponse>(
      '/chatbot/api/chatbot/health/'
    );

    return response.data;
  },

  /**
   * Obtiene preguntas rápidas sugeridas.
   * 
   * @returns Lista de preguntas predefinidas
   */
  async getQuickQuestions(): Promise<string[]> {
    const response = await apiClient.get<QuickQuestionsResponse>(
      '/chatbot/api/chatbot/quick-questions/'
    );

    return response.data.questions;
  },
};

export default chatbotService;
