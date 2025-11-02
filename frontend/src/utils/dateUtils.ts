/**
 * Utilidades para manejo de fechas con zona horaria América/Santiago
 * Todas las fechas se muestran en zona horaria local de Chile
 */

/**
 * Formatea una fecha string ISO a formato chileno
 * @param dateString - String de fecha ISO (ej: "2025-10-23" o "2025-10-23T14:30:00")
 * @param includeTime - Si incluir hora o solo fecha
 * @returns String formateado como "23 oct 2025" o "23 oct 2025 14:30"
 */
export const formatDate = (
  dateString: string | undefined,
  includeTime: boolean = false
): string => {
  if (!dateString) {
    return '-';
  }

  try {
    // Extraer solo la parte de fecha sin convertir a Date
    // para evitar problemas de zona horaria
    const datePart = dateString.split('T')[0]; // "2025-10-23"
    const timePart = dateString.split('T')[1]; // "14:30:00" o undefined

    const [year, month, day] = datePart.split('-');
    const months = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];

    let formatted = `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;

    if (includeTime && timePart) {
      const [hour, minute] = timePart.split(':');
      formatted += ` ${hour}:${minute}`;
    }

    return formatted;
  } catch {
    return '-';
  }
};

/**
 * Formatea una fecha a formato largo chileno
 * @param dateString - String de fecha ISO
 * @returns String formateado como "23 de octubre de 2025"
 */
export const formatDateLong = (dateString: string | undefined): string => {
  if (!dateString) {
    return '-';
  }

  try {
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');
    const monthNames = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    return `${parseInt(day)} de ${monthNames[parseInt(month) - 1]} de ${year}`;
  } catch {
    return '-';
  }
};

/**
 * Formatea una fecha y hora completa
 * @param dateTimeString - String de fecha-hora ISO
 * @returns String formateado como "23 oct 2025 - 14:30:45"
 */
export const formatDateTime = (dateTimeString: string | undefined): string => {
  if (!dateTimeString) {
    return '-';
  }

  return formatDate(dateTimeString, true);
};

/**
 * Obtiene cuánto tiempo ha pasado desde una fecha
 * @param dateString - String de fecha ISO
 * @returns String formateado como "hace 2 horas" o "hace 3 días"
 */
export const getTimeAgo = (dateString: string | undefined): string => {
  if (!dateString) {
    return '-';
  }

  try {
    // Crear date sin zona horaria UTC para evitar conversiones
    const parts = dateString.split('T');
    const dateParts = parts[0].split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);

    let hours = 0,
      minutes = 0,
      seconds = 0;

    if (parts[1]) {
      const timeParts = parts[1].split(':');
      hours = parseInt(timeParts[0]);
      minutes = parseInt(timeParts[1]);
      seconds = parseInt(timeParts[2]);
    }

    const date = new Date(year, month, day, hours, minutes, seconds);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const seconds_diff = Math.floor(diff / 1000);
    const minutes_diff = Math.floor(seconds_diff / 60);
    const hours_diff = Math.floor(minutes_diff / 60);
    const days_diff = Math.floor(hours_diff / 24);

    if (days_diff > 0) {
      return `hace ${days_diff} ${days_diff === 1 ? 'día' : 'días'}`;
    }
    if (hours_diff > 0) {
      return `hace ${hours_diff} ${hours_diff === 1 ? 'hora' : 'horas'}`;
    }
    if (minutes_diff > 0) {
      return `hace ${minutes_diff} ${minutes_diff === 1 ? 'minuto' : 'minutos'}`;
    }
    return 'hace pocos segundos';
  } catch {
    return '-';
  }
};

/**
 * Obtiene el nombre del día de la semana
 * @param dateString - String de fecha ISO
 * @returns String con el día (lunes, martes, etc.)
 */
export const getDayName = (dateString: string | undefined): string => {
  if (!dateString) {
    return '-';
  }

  try {
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-');

    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const dayNames = [
      'domingo',
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
    ];

    return dayNames[date.getDay()];
  } catch {
    return '-';
  }
};

/**
 * Verifica si una fecha es hoy
 * @param dateString - String de fecha ISO
 * @returns boolean
 */
export const isToday = (dateString: string | undefined): boolean => {
  if (!dateString) return false;

  try {
    const datePart = dateString.split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    return datePart === today;
  } catch {
    return false;
  }
};

/**
 * Verifica si una fecha es ayer
 * @param dateString - String de fecha ISO
 * @returns boolean
 */
export const isYesterday = (dateString: string | undefined): boolean => {
  if (!dateString) return false;

  try {
    const datePart = dateString.split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    return datePart === yesterdayStr;
  } catch {
    return false;
  }
};
