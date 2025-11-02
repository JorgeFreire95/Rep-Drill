"""
Utilidades para formato de moneda CLP (Pesos Chilenos) en inventario
"""

from decimal import Decimal


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
