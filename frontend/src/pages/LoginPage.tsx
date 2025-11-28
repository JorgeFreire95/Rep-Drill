import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Mail, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input } from '../components/common';
import { useToast } from '../hooks/useToast';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(formData);
      toast.success('¡Bienvenido a Rep Drill!');
      navigate('/');
    } catch (error: unknown) {
      // Extraer mensaje amigable si viene desde API (sin exponer detalles técnicos)
      let message = 'Error al iniciar sesión. Verifica tus credenciales.';
      const err = error as { response?: { data?: { detail?: string } } };
      message = err?.response?.data?.detail || message;
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 bg-primary-600 rounded-2xl items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">RD</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Rep Drill</h1>
          <p className="text-gray-600 mt-2">Gestión empresarial inteligente</p>
        </div>


        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Iniciar Sesión de Empleado</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="username"
              label="Usuario"
              type="text"
              placeholder="Ingresa tu usuario"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              icon={<Mail className="h-5 w-5" />}
              required
            />

            <Input
              id="password"
              label="Contraseña"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              icon={<Lock className="h-5 w-5" />}
              required
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2 rounded" />
                <span className="text-gray-600">Recordarme</span>
              </label>
              <Link to="/recuperar-password" className="text-primary-600 hover:text-primary-700">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
              icon={<LogIn className="h-5 w-5" />}
            >
              Iniciar Sesión
            </Button>
          </form>

          {/* Mensaje de ayuda eliminado a solicitud: se puede reactivar si se requiere */}
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          © 2025 Rep Drill. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};
