import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  className = '',
  headerAction,
}) => {
  return (
    <div className={`card ${className}`}>
      {(title || subtitle || headerAction) && (
        <div className="mb-4">
          <div className="flex items-start justify-between">
            <div>
              {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
              {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
            </div>
            {headerAction && <div>{headerAction}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
