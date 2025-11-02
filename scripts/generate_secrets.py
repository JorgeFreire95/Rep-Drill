#!/usr/bin/env python3
"""
Script para generar secrets seguros para el sistema Rep Drill
Ejecutar: python scripts/generate_secrets.py
"""

import secrets
import string
from django.core.management.utils import get_random_secret_key

def generate_strong_password(length=32):
    """Genera un password fuerte con letras, números y símbolos"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}|;:,.<>?"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_jwt_key(length=64):
    """Genera una clave JWT de 64 caracteres"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

if __name__ == "__main__":
    print("=" * 70)
    print("  REP DRILL - GENERADOR DE SECRETS SEGUROS")
    print("=" * 70)
    print()
    print("Copia estos valores en tu archivo .env:\n")
    
    print("# Django Secret Key")
    print(f"DJANGO_SECRET_KEY={get_random_secret_key()}")
    print()
    
    print("# JWT Signing Key (64 caracteres)")
    print(f"JWT_SIGNING_KEY={generate_jwt_key()}")
    print()
    
    print("# Database Password")
    print(f"DB_PASSWORD={generate_strong_password()}")
    print()
    
    print("# Redis Password")
    print(f"REDIS_PASSWORD={generate_strong_password()}")
    print()
    
    print("=" * 70)
    print("⚠️  IMPORTANTE:")
    print("  1. Guarda estos valores en un lugar seguro (gestor de contraseñas)")
    print("  2. NO los compartas en git ni en comunicaciones inseguras")
    print("  3. Usa valores diferentes en cada entorno (dev, staging, prod)")
    print("=" * 70)
