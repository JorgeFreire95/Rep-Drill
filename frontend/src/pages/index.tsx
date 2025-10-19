import React from 'react';
import { Card } from '../components/common';

// Placeholder pages - serán implementadas completamente más adelante


export const PrediccionesPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Predicciones con Prophet</h1>
      <Card>
        <p>Módulo de Predicciones en construcción...</p>
        <p className="mt-2 text-sm text-gray-600">
          Este módulo se activará cuando se implemente el backend con Prophet para análisis predictivo.
        </p>
      </Card>
    </div>
  );
};

// Export all pages
export { DashboardPage } from './DashboardPage';
export { LoginPage } from './LoginPage';
export { PersonasPage } from './PersonasPage';
export { InventarioPage } from './InventarioPage';
export { VentasPage } from './VentasPage';
