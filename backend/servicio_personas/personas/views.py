from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Customer, Employee, Supplier, Rep, Persona
from .serializers import (
    CustomerSerializer, 
    EmployeeSerializer, 
    SupplierSerializer, 
    RepSerializer,
    PersonaSerializer
)
from .permissions import (
    CanManageCustomers,
    CanManageEmployees,
    CanManageSuppliers,
    CanManageReps
)

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [AllowAny]  # Cambiado a AllowAny para desarrollo

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [AllowAny]  # Cambiado a AllowAny para desarrollo

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [AllowAny]  # Cambiado a AllowAny para desarrollo

class RepViewSet(viewsets.ModelViewSet):
    queryset = Rep.objects.all()
    serializer_class = RepSerializer
    permission_classes = [AllowAny]  # Cambiado a AllowAny para desarrollo


class PersonaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar personas (clientes y proveedores)
    """
    queryset = Persona.objects.all()
    serializer_class = PersonaSerializer
    permission_classes = [AllowAny]  # Cambiar a IsAuthenticated en producción
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nombre', 'numero_documento', 'email']
    ordering_fields = ['nombre', 'fecha_creacion']
    ordering = ['-fecha_creacion']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrar por tipo
        es_cliente = self.request.query_params.get('es_cliente')
        es_proveedor = self.request.query_params.get('es_proveedor')
        
        if es_cliente is not None:
            queryset = queryset.filter(es_cliente=es_cliente.lower() == 'true')
        
        if es_proveedor is not None:
            queryset = queryset.filter(es_proveedor=es_proveedor.lower() == 'true')
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def search_customers(self, request):
        """
        Búsqueda rápida de clientes por teléfono, email o nombre.
        
        Query params:
        - phone: buscar por teléfono (búsqueda parcial)
        - email: buscar por email (búsqueda parcial)
        - name: buscar por nombre (búsqueda parcial)
        - limit: máximo número de resultados (default: 50)
        
        Ejemplo: /api/personas/search_customers/?phone=56912345678
        
        Response:
        {
            "count": 5,
            "results": [
                {
                    "id": 1,
                    "nombre": "Juan Pérez",
                    "telefono": "+56912345678",
                    "email": "juan@example.com",
                    "numero_documento": "12345678-9",
                    "direccion": "Calle Principal 123",
                    "es_cliente": true
                }
            ]
        }
        """
        phone = request.query_params.get('phone', '').strip()
        email = request.query_params.get('email', '').strip()
        name = request.query_params.get('name', '').strip()
        limit = int(request.query_params.get('limit', 50))
        
        # Filtrar solo clientes
        queryset = self.get_queryset().filter(es_cliente=True)
        
        # Construir query con OR para buscar en múltiples campos
        query = Q()
        
        if phone:
            # Buscar por teléfono (sin espacios ni caracteres especiales)
            phone_clean = phone.replace(' ', '').replace('-', '').replace('+', '')
            query |= Q(telefono__icontains=phone_clean)
        
        if email:
            query |= Q(email__icontains=email)
        
        if name:
            query |= Q(nombre__icontains=name)
        
        # Aplicar filtros
        if query:
            queryset = queryset.filter(query)
        
        # Limitar resultados
        queryset = queryset[:limit]
        
        # Serializar
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'count': len(queryset),
            'results': serializer.data
        })
