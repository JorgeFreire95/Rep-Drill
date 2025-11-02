"""
Utilidades para manejo de fechas con zona horaria América/Santiago
"""

from django.utils import timezone
from datetime import datetime, date, timedelta


def get_local_now():
    """
    Retorna la fecha/hora actual en zona horaria local (America/Santiago)
    
    Returns:
        datetime: datetime con timezone de Santiago
    """
    return timezone.now()


def get_local_today():
    """
    Retorna la fecha actual (sin hora) en zona horaria local
    
    Returns:
        date: fecha local
    """
    return timezone.localdate()


def get_start_of_day(date_obj: date = None):
    """
    Retorna el inicio del día (00:00:00) en zona horaria local
    
    Args:
        date_obj: date object, si no se proporciona usa hoy
        
    Returns:
        datetime: datetime al inicio del día
    """
    if date_obj is None:
        date_obj = get_local_today()
    
    local_tz = timezone.get_current_timezone()
    dt = datetime.combine(date_obj, datetime.min.time())
    return local_tz.localize(dt)


def get_end_of_day(date_obj: date = None):
    """
    Retorna el final del día (23:59:59) en zona horaria local
    
    Args:
        date_obj: date object, si no se proporciona usa hoy
        
    Returns:
        datetime: datetime al final del día
    """
    if date_obj is None:
        date_obj = get_local_today()
    
    local_tz = timezone.get_current_timezone()
    dt = datetime.combine(date_obj, datetime.max.time())
    return local_tz.localize(dt)


def get_start_of_month(year: int = None, month: int = None):
    """
    Retorna el inicio del mes en zona horaria local
    
    Args:
        year: año, si no se proporciona usa el actual
        month: mes, si no se proporciona usa el actual
        
    Returns:
        datetime: datetime al inicio del mes
    """
    now = get_local_now()
    if year is None:
        year = now.year
    if month is None:
        month = now.month
    
    return get_start_of_day(date(year, month, 1))


def get_end_of_month(year: int = None, month: int = None):
    """
    Retorna el final del mes en zona horaria local
    
    Args:
        year: año, si no se proporciona usa el actual
        month: mes, si no se proporciona usa el actual
        
    Returns:
        datetime: datetime al final del mes
    """
    now = get_local_now()
    if year is None:
        year = now.year
    if month is None:
        month = now.month
    
    # Calcular el primer día del próximo mes
    if month == 12:
        next_month_first = date(year + 1, 1, 1)
    else:
        next_month_first = date(year, month + 1, 1)
    
    # Restar un día
    last_day = next_month_first - timedelta(days=1)
    
    return get_end_of_day(last_day)


def format_local_datetime(dt, format_string='%d/%m/%Y %H:%M:%S'):
    """
    Formatea un datetime a string usando zona horaria local
    
    Args:
        dt: datetime object
        format_string: formato a usar
        
    Returns:
        str: datetime formateado
    """
    if dt is None:
        return ''
    
    # Si no tiene zona horaria, asumimos que es UTC
    if dt.tzinfo is None:
        dt = timezone.make_aware(dt, timezone.utc)
    
    # Convertir a zona horaria local
    local_dt = dt.astimezone(timezone.get_current_timezone())
    
    return local_dt.strftime(format_string)


def format_local_date(date_obj, format_string='%d/%m/%Y'):
    """
    Formatea una date a string
    
    Args:
        date_obj: date object
        format_string: formato a usar
        
    Returns:
        str: date formateado
    """
    if date_obj is None:
        return ''
    
    return date_obj.strftime(format_string)
