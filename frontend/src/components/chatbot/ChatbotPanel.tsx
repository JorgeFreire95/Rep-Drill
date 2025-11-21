/**
 * Panel de Chatbot para análisis de Forecasting.
 * Componente flotante que permite interactuar con el asistente IA.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Loader, TrendingUp, Sparkles, AlertCircle } from 'lucide-react';
import { chatbotService, type ChatMessage } from '../../services/chatbotService';

interface ChatbotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quickQuestions, setQuickQuestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [estimatedTime] = useState(25);
  const [elapsedTime, setElapsedTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll al nuevo mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cargar preguntas rápidas al abrir
  useEffect(() => {
    if (isOpen && quickQuestions.length === 0) {
      loadQuickQuestions();
    }
    // Focus en input al abrir
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, quickQuestions.length]);

  const loadQuickQuestions = async () => {
    try {
      const questions = await chatbotService.getQuickQuestions();
      setQuickQuestions(questions);
    } catch (err) {
      console.error('Error cargando preguntas rápidas:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);
    setError(null);
    setStreamingContent('');
    setElapsedTime(0);

    // Crear AbortController para poder cancelar
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Iniciar contador de tiempo
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      let accumulatedContent = '';

      await chatbotService.askStream(
        currentInput,
        sessionId || undefined,
        7, // 7 días de forecast
        // onChunk
        (chunk: string) => {
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
        },
        // onDone
        (tokens: number) => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: accumulatedContent,
            timestamp: new Date().toISOString(),
            tokens_used: tokens,
          };

          setMessages((prev) => [...prev, assistantMessage]);
          setStreamingContent('');
          setLoading(false);
        },
        // onError
        (errorMsg: string) => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          console.error('Error en streaming:', errorMsg);
          setError(errorMsg || 'Error al comunicarse con el chatbot.');
          setStreamingContent('');
          setLoading(false);
        },
        abortController.signal
      );
    } catch (err) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const error = err as Error;
      if (error.name === 'AbortError') {
        console.log('Petición cancelada por el usuario');
        setError('Petición cancelada');
      } else {
        console.error('Error al comunicarse con el chatbot:', err);
        setError(
          error.message || 'Error al comunicarse con el chatbot. Por favor intenta nuevamente.'
        );
      }
      setStreamingContent('');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLoading(false);
    setStreamingContent('');
    setError('Petición cancelada por el usuario');
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const handleClearSession = async () => {
    if (sessionId) {
      try {
        await chatbotService.clearSession(sessionId);
        setMessages([]);
        setSessionId(null);
        setError(null);
      } catch (err) {
        console.error('Error al limpiar la sesión:', err);
      }
    } else {
      setMessages([]);
      setError(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[28rem] h-[40rem] bg-white rounded-xl shadow-2xl flex flex-col z-50 border border-gray-200 animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="w-7 h-7" />
            <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Asistente de Forecasting</h3>
            <p className="text-xs text-blue-100">Análisis de tendencias con IA</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-blue-700 rounded-lg transition-colors"
          aria-label="Cerrar chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
              <TrendingUp className="w-12 h-12 text-blue-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">
              ¿En qué puedo ayudarte?
            </h4>
            <p className="text-sm text-gray-600 mb-6">
              Puedo analizar forecasts, identificar tendencias y sugerir acciones
            </p>
            <div className="space-y-2 text-left">
              {quickQuestions.slice(0, 4).map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickQuestion(q)}
                  className="block w-full text-left px-4 py-3 text-sm bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all hover:shadow-sm group"
                >
                  <span className="text-gray-700 group-hover:text-blue-700">
                    {q}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] p-3 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString('es-CL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {msg.tokens_used && (
                  <span className="text-xs opacity-60">
                    • {msg.tokens_used} tokens
                  </span>
                )}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ))}

        {(loading || streamingContent) && (
          <div className="flex gap-3 justify-start">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm max-w-[75%]">
              {streamingContent ? (
                <>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {streamingContent}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Loader className="w-3 h-3 animate-spin text-blue-600" />
                    <span className="text-xs text-gray-500">
                      {elapsedTime}s transcurridos
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Loader className="w-5 h-5 animate-spin text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-700">Analizando...</p>
                    <p className="text-xs text-gray-500">
                      Tiempo estimado: ~{estimatedTime}s
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
        {messages.length > 0 && (
          <button
            onClick={handleClearSession}
            className="text-xs text-gray-500 hover:text-gray-700 mb-2 underline transition-colors"
          >
            Limpiar conversación
          </button>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu pregunta..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
            disabled={loading}
          />
          {loading ? (
            <button
              onClick={handleCancel}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm hover:shadow-md"
              aria-label="Cancelar"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
              aria-label="Enviar mensaje"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by Ollama • Datos actualizados cada 5 minutos
        </p>
      </div>
    </div>
  );
};

export default ChatbotPanel;
