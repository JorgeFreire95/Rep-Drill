from rest_framework import serializers
from .models import Order, OrderDetails, Shipment, Payment


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'


class OrderDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderDetails
        fields = '__all__'


class ShipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shipment
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'


# Keep the VentasSerializer name for compatibility
class VentasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'
