import React from 'react';
import { Star } from 'lucide-react';

export type StarRatingProps = {
  value: number | null;
  onChange?: (value: number) => void;
  max?: number;
  size?: number; // px
  readOnly?: boolean;
  className?: string;
};

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  max = 5,
  size = 18,
  readOnly = false,
  className = '',
}) => {
  const v = typeof value === 'number' ? Math.max(0, Math.min(max, value)) : 0;

  return (
    <div className={`inline-flex items-center gap-1 ${className}`} role={readOnly ? 'img' : 'slider'} aria-valuemin={0} aria-valuemax={max} aria-valuenow={v}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i + 1 <= v;
        return (
          <button
            key={i}
            type="button"
            className={`p-0.5 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            onClick={() => !readOnly && onChange && onChange(i + 1)}
            title={`${i + 1} de ${max}`}
            aria-label={`Calificar ${i + 1} estrella${i === 0 ? '' : 's'}`}
            disabled={readOnly}
          >
            <Star
              style={{ width: size, height: size }}
              className={filled ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
            />
          </button>
        );
      })}
      {!readOnly && (
        <button
          type="button"
          className="ml-1 text-xs text-gray-500 hover:text-gray-700"
          onClick={() => onChange && onChange(0)}
          title="Quitar calificación"
        >
          Limpiar
        </button>
      )}
    </div>
  );
};
