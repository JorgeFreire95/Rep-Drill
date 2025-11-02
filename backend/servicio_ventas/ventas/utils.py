"""
Utilidades para formato de moneda CLP (Pesos Chilenos)
"""

from decimal import Decimal
import locale


def format_clp(amount):
    """
    Formatea un monto a CLP sin decimales con símbolo $
    
    Args:
        amount: Número, string o Decimal
        
    Returns:
        String formateado como: $1.234.567
    """
    if amount is None:
        return "$0"
    
    try:
        # Convertir a Decimal si no lo es
        if not isinstance(amount, Decimal):
            amount = Decimal(str(amount))
        
        # Convertir a entero (sin decimales)
        amount_int = int(amount)
        
        # Formato con separadores de miles
        formatted = f"${amount_int:,.0f}".replace(',', '.')
        return formatted
    except (ValueError, TypeError):
        return "$0"


def parse_clp(value_string):
    """
    Convierte un string formateado en CLP a Decimal
    
    Args:
        value_string: String como "$1.234.567"
        
    Returns:
        Decimal con el valor
    """
    if not value_string:
        return Decimal('0')
    
    try:
        # Remover símbolo $ y separadores de miles
        cleaned = value_string.replace('$', '').replace('.', '')
        return Decimal(cleaned)
    except (ValueError, TypeError):
        return Decimal('0')
