from __future__ import annotations

"""
Pequeñas utilidades para auditoría: mantiene el "actor" (usuario) actual y la IP
en un contexto thread-local, para que las señales puedan registrar quién hizo un cambio.
"""

import threading
from typing import Optional

_state = threading.local()


def set_current_actor(username: Optional[str], ip: Optional[str] = None) -> None:
    _state.username = username
    _state.ip = ip


def get_current_actor() -> Optional[str]:
    return getattr(_state, 'username', None)


def get_current_ip() -> Optional[str]:
    return getattr(_state, 'ip', None)


def clear_current_actor() -> None:
    for attr in ('username', 'ip'):
        if hasattr(_state, attr):
            delattr(_state, attr)
