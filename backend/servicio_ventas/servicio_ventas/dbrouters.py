"""Database router scaffold for future multi-DB separation.

Currently all models use the default database. This router reserves an
"analytics" database alias for future historical / reporting models that may be
introduced into this service (or mounted from a shared app). For now it simply
routes unknown apps to "default" and would route an "analytics" app label to the
"analytics" database if present.

To activate real separation later:
1. Provide distinct connection credentials via ANALYTICS_DATABASE_* env vars.
2. Add the analytics app (or reporting models) to INSTALLED_APPS.
3. Run `python manage.py migrate --database=analytics` for its migrations.
4. Optionally move read-heavy queries to analytics DB by adding their app_label
   to route_app_labels_analytics.
"""
from __future__ import annotations
from typing import Optional, Any

class ServiceRouter:
    """Route selected app labels to the analytics database.

    Adjust `route_app_labels_analytics` as new apps/models are introduced.
    """
    route_app_labels_analytics = {"analytics"}  # placeholder label

    def db_for_read(self, model, **hints) -> Optional[str]:
        if model._meta.app_label in self.route_app_labels_analytics:
            return "analytics"
        return "default"

    def db_for_write(self, model, **hints) -> Optional[str]:
        if model._meta.app_label in self.route_app_labels_analytics:
            return "analytics"
        return "default"

    def allow_relation(self, obj1, obj2, **hints) -> bool:
        # Allow relations if both objects are in routed or default DBs
        db_list = {"default", "analytics"}
        if obj1._state.db in db_list and obj2._state.db in db_list:
            return True
        return False

    def allow_migrate(self, db: str, app_label: str, model_name: Optional[str] = None, **hints: Any) -> Optional[bool]:
        # Ensure analytics app only migrates on analytics DB when present
        if app_label in self.route_app_labels_analytics:
            return db == "analytics"
        # All other apps migrate only on default
        if db != "default":
            return False
        return True
