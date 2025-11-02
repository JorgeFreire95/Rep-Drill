# Sistema de Actualización Automática de Inventario

## 📋 Descripción

Este sistema actualiza automáticamente el inventario cuando se completa el pago de una orden de venta. El proceso es completamente automático y garantiza que el stock se reduzca solo cuando el pago se ha completado.

## 🔄 Flujo de Trabajo

### 1. **Creación de Orden**
```
Cliente → Crea Orden → Estado: PENDING
```
- Se crea una orden con productos y cantidades
- El inventario **NO** se actualiza todavía
- La orden queda en estado `PENDING`

### 2. **Registro de Pagos**
```
Cliente → Agrega Pago(s) → Sistema verifica total pagado
```
- Se registran uno o más pagos asociados a la orden
- El sistema calcula automáticamente si la orden está completamente pagada
- Cada pago puede ser parcial o total

### 3. **Actualización Automática** ✨
```
Pago Completo → Signal → Actualiza Inventario → Estado: COMPLETED
```

Cuando el total pagado >= total de la orden:

1. **Signal se activa automáticamente**
2. **Verifica** que el inventario no haya sido actualizado previamente
3. **Comunica con el servicio de inventario** para cada producto
4. **Reduce el stock** de cada producto según la cantidad vendida
5. **Marca la orden** como `inventory_updated = True`
6. **Cambia el estado** de la orden a `COMPLETED`

## 🛠️ Componentes del Sistema

### 1. **Servicios** (`ventas/services.py`)

#### `InventoryService`
- `update_product_stock()`: Reduce el stock de un producto
- `check_product_availability()`: Verifica disponibilidad antes de vender
- `update_inventory_for_order()`: Actualiza todos los productos de una orden

#### `OrderService`
- `process_payment_completion()`: Orquesta todo el proceso de finalización

### 2. **Signals** (`ventas/signals.py`)

#### `payment_created_or_updated`
Se ejecuta cuando se crea o actualiza un pago:
```python
Payment creado/actualizado
    ↓
Actualizar estado de orden
    ↓
¿Pago completo? → Sí → Actualizar inventario
                ↓ No
              Esperar más pagos
```

### 3. **Modelos** (`ventas/models.py`)

#### Campos importantes en `Order`:
- `inventory_updated`: Flag booleano que previene actualizaciones duplicadas
- `status`: Estado de la orden (PENDING, COMPLETED, etc.)
- `total`: Total de la orden

#### Métodos útiles:
- `get_total_paid()`: Calcula el total pagado
- `is_fully_paid()`: Verifica si está completamente pagada
- `update_status_from_payment()`: Actualiza estado basado en pagos

## 📡 Endpoints de la API

### 1. Verificar Disponibilidad de Productos
```http
POST /api/check-availability/
Content-Type: application/json

{
  "products": [
    {"product_id": 1, "quantity": 5},
    {"product_id": 2, "quantity": 3}
  ]
}
```

**Respuesta:**
```json
{
  "all_available": true,
  "products": [
    {
      "success": true,
      "available": true,
      "current_quantity": 100,
      "required_quantity": 5,
      "product_name": "Taladro Eléctrico"
    }
  ]
}
```

### 2. Ver Estado de Pago de una Orden
```http
GET /api/orders/{order_id}/payment-status/
```

**Respuesta:**
```json
{
  "order_id": 1,
  "total": "1500.00",
  "total_paid": "1500.00",
  "remaining": "0.00",
  "is_fully_paid": true,
  "inventory_updated": true,
  "status": "COMPLETED",
  "payment_percentage": 100.0
}
```

### 3. Procesar Pago Manualmente (Admin)
```http
POST /api/orders/{order_id}/process-payment/
```

Útil si necesitas forzar la actualización del inventario.

## 🔒 Seguridad y Validaciones

### Prevención de Duplicados
- ✅ Flag `inventory_updated` previene actualizaciones múltiples
- ✅ Verificación de estado antes de actualizar
- ✅ Logs detallados de cada operación

### Manejo de Errores
```python
try:
    actualizar_inventario()
except TimeoutError:
    # Log del error, no se marca como actualizado
except ConnectionError:
    # Reintentar o notificar al administrador
```

## 📊 Ejemplo Práctico

### Escenario: Cliente compra productos

```python
# 1. Crear orden
order = Order.objects.create(
    customer_id=1,
    total=1500.00,
    status='PENDING'
)

# 2. Agregar productos
OrderDetails.objects.create(
    order=order,
    product_id=1,  # Taladro
    quantity=2,
    unit_price=500.00
)
OrderDetails.objects.create(
    order=order,
    product_id=2,  # Brocas
    quantity=10,
    unit_price=50.00
)

# 3. Cliente paga la mitad
payment1 = Payment.objects.create(
    order=order,
    amount=750.00,
    payment_method='Tarjeta'
)
# ❌ Inventario NO se actualiza (pago incompleto)
# order.status = 'PENDING'

# 4. Cliente paga el resto
payment2 = Payment.objects.create(
    order=order,
    amount=750.00,
    payment_method='Efectivo'
)
# ✅ Signal detecta pago completo
# ✅ Inventario se actualiza automáticamente
# ✅ order.status = 'COMPLETED'
# ✅ order.inventory_updated = True
```

## 🔍 Logs del Sistema

El sistema genera logs detallados:

```log
INFO: 💰 Pago completado para orden 123. Procesando actualización de inventario...
INFO: Stock actualizado exitosamente. Producto: 1, Cantidad anterior: 100, Nueva cantidad: 98
INFO: Stock actualizado exitosamente. Producto: 2, Cantidad anterior: 50, Nueva cantidad: 40
INFO: ✅ Inventario actualizado exitosamente para orden 123
```

## ⚙️ Configuración

### Variables de Entorno (`.env`)

```env
# URL del servicio de inventario
INVENTARIO_SERVICE_URL=http://localhost:8001

# Timeout para comunicación entre servicios (segundos)
MICROSERVICE_REQUEST_TIMEOUT=5
```

### Settings de Django

```python
# settings.py
INVENTARIO_SERVICE_URL = os.getenv('INVENTARIO_SERVICE_URL', 'http://localhost:8001')
```

## 🚨 Casos Especiales

### 1. **Pago Eliminado**
Si se elimina un pago después de actualizar el inventario:
- ⚠️ El estado de la orden se revierte
- ⚠️ El inventario **NO** se revierte automáticamente
- 📝 Se genera un log de advertencia
- 👤 Requiere intervención manual del administrador

### 2. **Servicio de Inventario No Disponible**
- ❌ La actualización falla
- 📝 Se registra el error en los logs
- 🔄 El flag `inventory_updated` permanece en `False`
- ✅ Se puede reintentar más tarde

### 3. **Stock Insuficiente**
- El servicio de inventario solo reduce hasta llegar a 0
- No permite cantidades negativas
- Se recomienda verificar disponibilidad antes de confirmar la orden

## 📝 Recomendaciones

1. **Siempre verificar disponibilidad** antes de crear una orden
2. **Monitorear los logs** para detectar problemas de comunicación entre servicios
3. **Configurar alertas** para cuando falle la actualización del inventario
4. **Backup regular** de la base de datos
5. **Implementar cola de mensajes** (Celery/RabbitMQ) para mayor robustez en producción

## 🔗 Arquitectura de Microservicios

```
┌─────────────────┐         ┌─────────────────┐
│  Servicio de    │         │  Servicio de    │
│    Ventas       │────────▶│  Inventario     │
│  (Puerto 8002)  │  HTTP   │  (Puerto 8001)  │
└─────────────────┘         └─────────────────┘
        │
        │ Signal
        ▼
  Actualización
   Automática
```

## ✅ Testing

Para probar el sistema:

```bash
# 1. Ejecutar tests
python manage.py test ventas

# 2. Verificar manualmente
curl -X POST http://localhost:8002/api/payments/ \
  -H "Content-Type: application/json" \
  -d '{
    "order": 1,
    "amount": 1500.00,
    "payment_method": "Tarjeta"
  }'

# 3. Verificar estado
curl http://localhost:8002/api/orders/1/payment-status/
```

---

**Desarrollado por**: RazorZ7X  
**Fecha**: Octubre 2025  
**Versión**: 1.0.0
