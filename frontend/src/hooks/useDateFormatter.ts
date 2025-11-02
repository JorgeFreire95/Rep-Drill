import {
  formatDate,
  formatDateLong,
  formatDateTime,
  getTimeAgo,
  getDayName,
  isToday,
  isYesterday,
} from '../utils/dateUtils';

/**
 * Hook personalizado para acceder a todas las funciones de formateo de fechas
 */
export const useDateFormatter = () => {
  return {
    formatDate,
    formatDateLong,
    formatDateTime,
    getTimeAgo,
    getDayName,
    isToday,
    isYesterday,
  };
};
