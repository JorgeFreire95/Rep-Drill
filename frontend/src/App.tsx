import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { ToastContainer } from './components/common';
import {
  DashboardPage,
  LoginPage,
  PersonasPage,
  InventarioPage,
  VentasPage,
  PrediccionesPage,
} from './pages';

function AppContent() {
  const { toasts, removeToast } = useToastContext();

  return (
    <>
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
          <Route path="ventas" element={<VentasPage />} />
          <Route path="predicciones" element={<PrediccionesPage />} />
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Sistema de notificaciones Toast */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
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
