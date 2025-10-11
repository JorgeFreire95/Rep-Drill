from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import filters
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
