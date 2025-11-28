import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { startLowStockWatcher } from './services/notificationsService';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { ToastContainer, ErrorBoundary, SuspenseFallback } from './components/common';
import {
  DashboardPage,
  LoginPage,
  PersonasPage,
  InventarioPage,
  VentasPage,
  UsersManagementPage,
  CreateOrderPage,
  StockAlertsPage,
  ReordersPage,
  SuppliersPage,
  ReportsPage,
  AuditLogsPage,
  ActiveReservationsDashboard,
  ForecastAccuracyDashboard,
} from './pages';

// Lazy Loading para páginas pesadas con gráficos y análisis
const ForecastingPage = lazy(() => import('./pages/ForecastingPage'));

function AppContent() {
  const { toasts, removeToast, success, error, info, warning } = useToastContext();

  // Iniciar watcher global de alertas de stock bajo (dentro del provider)
  useEffect(() => {
    const stop = startLowStockWatcher({
      intervalMs: 10000, // 10s
      onUpdate: (prev, next) => {
        if (!prev) {
          if (next.count > 0) {
            info(`Hay ${next.count} alerta(s) de stock. ${next.critical > 0 ? `${next.critical} crítica(s).` : ''}`);
          }
          return;
        }

        if (next.critical > prev.critical) {
          error(`Nueva(s) alerta(s) crítica(s): +${next.critical - prev.critical}`);
        }
        if (next.critical < prev.critical) {
          success(`Se resolvieron ${prev.critical - next.critical} crítica(s) de stock`);
        }
        if (next.count > prev.count) {
          warning(`Se agregaron ${next.count - prev.count} alerta(s) de stock`);
        } else if (next.count < prev.count) {
          success(`Se resolvieron ${prev.count - next.count} alerta(s) de stock`);
        }
      },
    });
    return stop;
  }, [success, error, info, warning]);

  return (
    <ErrorBoundary>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="alertas-stock" element={<StockAlertsPage />} />
          <Route path="reordenes" element={<ReordersPage />} />
          <Route path="proveedores" element={<SuppliersPage />} />
          <Route path="reportes" element={<ReportsPage />} />
          <Route path="auditoria" element={<AuditLogsPage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="crear-orden" element={<CreateOrderPage />} />
          <Route path="usuarios" element={<UsersManagementPage />} />
          
          {/* Fase 2: Dashboard de Reservas Activas */}
          <Route path="reservations" element={<ActiveReservationsDashboard />} />
          
          {/* Fase 3: Dashboard de Precisión de Pronósticos */}
          <Route path="forecast-accuracy" element={<ForecastAccuracyDashboard />} />
          
          {/* Páginas pesadas con lazy loading */}
          <Route 
            path="forecasting" 
            element={
              <Suspense fallback={<SuspenseFallback />}>
                <ForecastingPage />
              </Suspense>
            } 
          />
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Sistema de notificaciones Toast */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
