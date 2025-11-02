"""
Utilidades para manejo de secretos y configuración segura
Compatible con Docker secrets y variables de entorno
"""
import os
from pathlib import Path
from typing import Optional


def get_secret(name: str, default: Optional[str] = None) -> str:
    """
    Obtener secreto desde Docker secrets o variables de entorno.
    
    Prioridad:
    1. Docker secrets (/run/secrets/<name>)
    2. Variables de entorno
    3. Valor por defecto
    
    Args:
        name: Nombre del secreto/variable
        default: Valor por defecto si no se encuentra
        
    Returns:
        Valor del secreto
        
    Raises:
        ValueError: Si no se encuentra el secreto y no hay default
    """
    # Intentar leer desde Docker secrets
    secret_path = Path('/run/secrets') / name
    if secret_path.exists():
        try:
            return secret_path.read_text().strip()
        except Exception as e:
            print(f"Warning: Failed to read secret from {secret_path}: {e}")
    
    # Intentar variable de entorno
    env_value = os.getenv(name)
    if env_value is not None:
        return env_value
    
    # Usar default si existe
    if default is not None:
        return default
    
    # Fallar si no se encuentra
    raise ValueError(
        f"Secret '{name}' not found in Docker secrets or environment variables. "
        f"Please set {name} in .env file or create Docker secret."
    )


def get_bool_secret(name: str, default: bool = False) -> bool:
    """
    Obtener secreto booleano.
    
    Args:
        name: Nombre del secreto
        default: Valor por defecto
        
    Returns:
        Valor booleano
    """
    value = get_secret(name, str(default))
    return value.lower() in ('true', '1', 'yes', 'on')


def get_int_secret(name: str, default: Optional[int] = None) -> int:
    """
    Obtener secreto entero.
    
    Args:
        name: Nombre del secreto
        default: Valor por defecto
        
    Returns:
        Valor entero
    """
    value = get_secret(name, str(default) if default is not None else None)
    return int(value)


def get_list_secret(name: str, separator: str = ',', default: Optional[list] = None) -> list:
    """
    Obtener secreto como lista.
    
    Args:
        name: Nombre del secreto
        separator: Separador de elementos
        default: Lista por defecto
        
    Returns:
        Lista de valores
    """
    default_str = separator.join(default) if default else None
    value = get_secret(name, default_str)
    return [item.strip() for item in value.split(separator) if item.strip()]


# Alias para compatibilidad
def get_env_secret(name: str, default: Optional[str] = None) -> str:
    """Alias para get_secret()"""
    return get_secret(name, default)
