/**
 * Utilidades para formatear moneda CLP (Pesos Chilenos)
 * Formato: $X.XXX.XXX (sin decimales, separadores de miles con puntos)
 */

/**
 * Formatea un monto a CLP sin decimales
 * @param amount - Número, string o valor decimal
 * @returns String formateado como: $1.234.567
 */
export const formatCLP = (amount: number | string | undefined): string => {
  if (amount === undefined || amount === null) {
    return '$0';
  }

  try {
    // Convertir a número
    const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    
    // Si es NaN, retornar $0
    if (isNaN(num)) {
      return '$0';
    }

    // Redondear al entero más cercano (sin decimales)
    const roundedNum = Math.round(num);

    // Aplicar formato local chileno
    return roundedNum.toLocaleString('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } catch {
    return '$0';
  }
};

/**
 * Parsea un string de CLP a número
 * @param value - String como "$1.234.567"
 * @returns Número sin formato
 */
export const parseCLP = (value: string): number => {
  if (!value) {
    return 0;
  }

  try {
    // Remover símbolo $ y separadores de miles (puntos)
    const cleaned = value.replace(/\$/g, '').replace(/\./g, '');
    return parseInt(cleaned, 10);
  } catch {
    return 0;
  }
};

/**
 * Valida si un string es un número entero válido para CLP
 * @param value - String del número
 * @returns true si es válido
 */
export const isValidCLPAmount = (value: string): boolean => {
  if (!value) return false;
  
  try {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  } catch {
    return false;
  }
};
