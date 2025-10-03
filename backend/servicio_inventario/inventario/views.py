from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Inventory
from .serializers import InventorySerializer
from django.http import JsonResponse

# Create your views here.
class InventoryListView(APIView):
    permission_classes = [IsAuthenticated]


    def get(self, request):
        inventories = Inventory.objects.all()
        serializer = InventorySerializer(inventories, many=True)
        return Response(serializer.data)