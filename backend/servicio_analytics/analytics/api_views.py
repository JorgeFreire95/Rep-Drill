"""
API views para monitoreo de tareas programadas.
"""
from rest_framework import viewsets, filters
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from .models import TaskRun
from django.db.models import Count, Avg, Q
from datetime import datetime, timedelta


class TaskRunPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class TaskRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para consultar ejecuciones de tareas Celery.
    
    Query params:
    - task_name: filtrar por nombre de tarea exacto
    - status: filtrar por estado (running, success, error)
    - date_from: fecha desde (YYYY-MM-DD)
    - date_to: fecha hasta (YYYY-MM-DD)
    - limit: límite de resultados (máx 200)
    """
    queryset = TaskRun.objects.all().order_by('-started_at')
    permission_classes = [AllowAny]
    pagination_class = TaskRunPagination
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['started_at', 'finished_at', 'duration_ms']
    ordering = ['-started_at']

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filtro por nombre de tarea
        task_name = self.request.query_params.get('task_name')
        if task_name:
            qs = qs.filter(task_name=task_name)
        
        # Filtro por estado
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        
        # Filtro por rango de fechas
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if date_from:
            try:
                df = datetime.strptime(date_from[:10], '%Y-%m-%d').date()
                qs = qs.filter(started_at__date__gte=df)
            except ValueError:
                pass
        
        if date_to:
            try:
                dt = datetime.strptime(date_to[:10], '%Y-%m-%d').date()
                qs = qs.filter(started_at__date__lte=dt)
            except ValueError:
                pass
        
        # Límite personalizado
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                lim = int(limit)
                if 0 < lim <= 200:
                    qs = qs[:lim]
            except ValueError:
                pass
        
        return qs

    def list(self, request, *args, **kwargs):
        """Lista las ejecuciones con información de paginación y estadísticas."""
        queryset = self.get_queryset()
        
        # Estadísticas generales
        last_24h = datetime.now() - timedelta(hours=24)
        stats = {
            'total': queryset.count(),
            'last_24h': {
                'total': queryset.filter(started_at__gte=last_24h).count(),
                'success': queryset.filter(started_at__gte=last_24h, status='success').count(),
                'error': queryset.filter(started_at__gte=last_24h, status='error').count(),
                'running': queryset.filter(started_at__gte=last_24h, status='running').count(),
            }
        }
        
        # Paginación
        page = self.paginate_queryset(queryset)
        if page is not None:
            data = []
            for run in page:
                data.append({
                    'id': run.id,
                    'run_id': run.run_id,
                    'task_name': run.task_name,
                    'status': run.status,
                    'started_at': run.started_at.isoformat(),
                    'finished_at': run.finished_at.isoformat() if run.finished_at else None,
                    'duration_ms': run.duration_ms,
                    'details': run.details,
                    'error': run.error,
                })
            
            response = self.get_paginated_response(data)
            response.data['stats'] = stats
            return response
        
        # Sin paginación
        data = []
        for run in queryset:
            data.append({
                'id': run.id,
                'run_id': run.run_id,
                'task_name': run.task_name,
                'status': run.status,
                'started_at': run.started_at.isoformat(),
                'finished_at': run.finished_at.isoformat() if run.finished_at else None,
                'duration_ms': run.duration_ms,
                'details': run.details,
                'error': run.error,
            })
        
        return Response({
            'stats': stats,
            'results': data
        })
