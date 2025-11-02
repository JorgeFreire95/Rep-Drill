from __future__ import annotations

from django.utils.deprecation import MiddlewareMixin
from .audit import set_current_actor, clear_current_actor


class CurrentActorMiddleware(MiddlewareMixin):
    """
    Captura el usuario que realiza la petición para usarlo en auditoría.
    - Intenta tomarlo desde request.user si está disponible.
    - Como alternativa, acepta cabeceras: X-User o X-Username y X-Forwarded-For para IP.
    """

    def process_request(self, request):
        username = None
        # 1) Cabeceras del gateway (si existieran)
        username = (
            request.headers.get('X-User')
            or request.headers.get('X-Username')
        )

        # 2) Usuario de DRF/Django (si existiera)
        if not username:
            user = getattr(request, 'user', None)
            if getattr(user, 'is_authenticated', False):
                username = getattr(user, 'username', None)

        # 3) Fallback
        if not username:
            username = 'system'

        ip = request.headers.get('X-Forwarded-For') or request.META.get('REMOTE_ADDR')
        set_current_actor(username, ip)

    def process_response(self, request, response):
        clear_current_actor()
        return response
