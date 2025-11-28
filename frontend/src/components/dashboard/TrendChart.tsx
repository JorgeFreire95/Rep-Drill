import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface TrendData {
  date: string;
  sales: number;
  orders: number;
}

interface TrendChartProps {
  data: TrendData[];
  title?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, title = 'Tendencia de Ventas' }) => {
  // Formatear fecha para mostrar (incluye día de la semana)
  const formattedData = data.map(item => {
    const d = new Date(item.date);
    const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace(',', '');
    const dayMonth = d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    return {
      ...item,
      displayDate: `${weekday} ${dayMonth}`,
    };
  });

  // Formatter para moneda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const fullCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Dominios dinámicos con padding
  const salesVals = data.map(d => d.sales);
  const ordersVals = data.map(d => d.orders);
  const salesMin = Math.min(...salesVals, 0);
  const salesMax = Math.max(...salesVals, 0);
  const salesPad = Math.max(1, Math.round((salesMax - salesMin) * 0.1));
  const ordersMin = Math.min(...ordersVals, 0);
  const ordersMax = Math.max(...ordersVals, 0);
  const ordersPad = Math.max(1, Math.round((ordersMax - ordersMin) * 0.1));

  // Detectar límites de semanas (lunes) para separadores visuales
  const weekBoundaries: string[] = [];
  for (let i = 0; i < formattedData.length; i++) {
    const d = new Date(data[i].date);
    if (d.getDay() === 1 && i > 0) {
      weekBoundaries.push(formattedData[i].displayDate);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={formattedData} margin={{ top: 10, right: 24, left: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          {weekBoundaries.map((boundary, idx) => (
            <ReferenceLine
              key={`week-${idx}`}
              x={boundary}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
            />
          ))}
          <XAxis 
            dataKey="displayDate" 
            tick={{ fontSize: 12 }}
            angle={-35}
            textAnchor="end"
            height={65}
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(Number(value))}
            domain={[salesMin - salesPad, salesMax + salesPad]}
            label={{ value: 'Ventas (CLP)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            domain={[ordersMin - ordersPad, ordersMax + ordersPad]}
            allowDecimals={false}
            label={{ value: 'Órdenes', angle: -90, position: 'insideRight', style: { fontSize: 12 } }}
          />
          <Tooltip 
            formatter={(value: number, name: string) => {
              if (name === 'Ventas') return [fullCurrency(value), name];
              return [Math.round(value as number), name];
            }}
            labelFormatter={(_label, payload) => {
              if (!payload || payload.length === 0) return '';
              const raw = (payload[0] as any).payload?.date;
              const d = raw ? new Date(raw) : null;
              return d ? d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
            }}
          />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="sales" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Ventas"
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="orders" 
            stroke="#10b981" 
            strokeWidth={2}
            name="Órdenes"
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
