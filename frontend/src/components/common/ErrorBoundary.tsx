import React, { Component } from 'react';
import { logger } from '../../utils/logger';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Captura errores de JavaScript en cualquier parte del árbol de componentes hijo
 * y muestra una interfaz de respaldo en lugar de hacer crash toda la aplicación.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Actualizar estado para que el próximo render muestre la UI de fallback
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Registrar error en servicio de logging (ej: Sentry, LogRocket)
    logger.error('ErrorBoundary capturó un error:', error, {
      componentStack: errorInfo.componentStack,
    });
    
    // Llamar callback opcional
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Aquí podrías enviar el error a un servicio de monitoreo:
    // logErrorToService(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      // Puedes usar el prop fallback personalizado o el default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Algo salió mal
            </h2>
            
            <p className="text-gray-600 text-center mb-4">
              Lo sentimos, ha ocurrido un error inesperado.
            </p>

            {this.state.error && (
              <details className="mb-4 bg-gray-50 rounded p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                  Detalles del error
                </summary>
                <p className="text-xs text-red-600 font-mono break-all">
                  {this.state.error.toString()}
                </p>
              </details>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Reintentar
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
              >
                Ir al inicio
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Si el problema persiste, contacta al soporte técnico.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook personalizado para usar con Suspense
 */
export const SuspenseFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600">Cargando...</p>
    </div>
  </div>
);
