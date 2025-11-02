import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  subtitle?: string;
  tooltip?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-100',
  subtitle,
  tooltip,
}) => {
  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1" title={tooltip}>{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
          
          {change !== undefined && (
            <div className="flex items-center gap-1">
              <span
                className={`text-sm font-medium ${
                  isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
                }`}
              >
                {isPositive && '+'}
                {change.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">vs período anterior</span>
            </div>
          )}
          
          {subtitle && !change && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        
        <div className={`${iconBgColor} rounded-full p-3`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};
