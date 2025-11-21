# Generador de Datos Simulados - Sistema de Inventario Automotriz

## 📋 Descripción

Script Python que genera datos de prueba realistas para un sistema de gestión de inventario automotriz en Chile. Simula un año completo de operaciones (28-11-2024 al 28-11-2025) con:

- ✅ **Ventas diarias** (lunes a sábado)
- ✅ **Reabastecimiento automático** cuando el stock baja del mínimo
- ✅ **Auditorías esporádicas** con ajustes de inventario
- ✅ **Datos realistas** con marcas chilenas (Shell, Bosch, Liqui Moly, etc.)
- ✅ **Coherencia temporal** garantizada

## 🚀 Uso Rápido

### 1. Generar el archivo SQL

```bash
cd backend
python generador_datos_simulados.py
```

Esto generará el archivo `datos_simulados.sql` con todas las instrucciones SQL.

### 2. Cargar datos en PostgreSQL

**Opción A: Usando Docker (Recomendado)**

```bash
# Copiar el archivo SQL al contenedor de PostgreSQL
docker cp backend/datos_simulados.sql rep-drill-db-1:/tmp/datos_simulados.sql

# Ejecutar el SQL en la base de datos de inventario
docker exec -it rep-drill-db-1 psql -U postgres -d inventario_db -f /tmp/datos_simulados.sql

# Ejecutar inserts de personas (clientes y empleados)
docker exec -it rep-drill-db-1 psql -U postgres -d personas_db -c "$(grep 'personas_' backend/datos_simulados.sql)"

# Ejecutar inserts de ventas (ordenes y pagos)
docker exec -it rep-drill-db-1 psql -U postgres -d ventas_db -c "$(grep -E 'orders|order_details|ventas_payment' backend/datos_simulados.sql)"
```

**Opción B: Usando psql local**

```bash
psql -h localhost -U postgres -d inventario_db -f backend/datos_simulados.sql
```

**Opción C: Usando pgAdmin o DBeaver**

1. Abrir el archivo `datos_simulados.sql`
2. Copiar y ejecutar el contenido en las bases de datos correspondientes

## 📊 Estadísticas Generadas

El script genera aproximadamente:

- **226 órdenes de venta** (ventas completadas con pago)
- **51 solicitudes de reabastecimiento** (automáticas por stock bajo)
- **630 eventos de inventario** (entradas, salidas, ajustes)
- **15 productos** con stock realista
- **6 proveedores chilenos** reales
- **7 categorías** de productos automotrices
- **12 clientes** base
- **3 empleados** (Gerente, Vendedor Senior, Vendedor Junior)

## 🏭 Productos Incluidos

### Aceites y Lubricantes
- Shell Helix HX7 10W-40 1L
- Liqui Moly Top Tec 4200 5W-30 5L
- Castrol EDGE 5W-30 4L

### Filtros
- Mann Filter W 712/75 (Aceite)
- Bosch Filtro de Aire F026400165
- Mann Filter CUK 2440 (Habitáculo)

### Sistema de Frenos
- Bosch Pastillas de Freno 0 986 494 289
- Bosch Discos de Freno 0 986 479 195

### Baterías
- Bosch S4 12V 60Ah 540A
- Bosch S5 12V 75Ah 730A

### Sistema Eléctrico
- Bosch Bujía Platinum FR7DPP332S

### Refrigeración
- Shell Anticongelante Concentrado 1L
- Liqui Moly Kühlerfrostschutz KFS 2001 Plus 5L

### Sistema de Suspensión
- Amortiguador Delantero Monroe G16764
- Amortiguador Trasero Monroe G16765

## 🔧 Configuración Personalizable

Puedes modificar las siguientes constantes en `generador_datos_simulados.py`:

```python
FECHA_INICIO = date(2024, 11, 28)
FECHA_FIN = date(2025, 11, 28)
DIAS_ENTREGA_PROVEEDOR = (3, 7)  # Rango de días para entrega
PROBABILIDAD_VENTA_DIA = 0.7      # 70% de probabilidad de venta
PROBABILIDAD_AUDITORIA = 0.02     # 2% de auditorías
```

## 🎯 Lógica de Simulación

### 1. Inicialización
- Crea bodega central
- Registra proveedores chilenos reales
- Crea categorías de productos
- Inicializa productos con stock base

### 2. Simulación Día a Día (366 días)

**Lunes a Sábado:**
- 70% probabilidad de generar venta
- Ventas con 1-4 productos aleatorios
- Descuenta stock automáticamente
- Crea orden + detalles + pago + eventos de inventario

**Reabastecimiento Automático:**
- Detecta cuando `stock <= min_stock`
- Crea solicitud de reorden automática
- Simula entrega del proveedor (3-7 días después)
- Actualiza stock al recibir productos

**Auditorías Esporádicas (2%):**
- Ajustes por pérdida o sobrante
- Registra en audit log
- Actualiza eventos de inventario

### 3. Actualización Final
- Actualiza el stock final de todos los productos
- Refleja el estado real después de 1 año de operaciones

## 📁 Estructura del SQL Generado

```sql
-- 1. Bodega
INSERT INTO inventario_warehouse ...

-- 2. Proveedores
INSERT INTO inventario_supplier ...

-- 3. Categorías
INSERT INTO inventario_category ...

-- 4. Productos (con stock inicial)
INSERT INTO inventario_product ...

-- 5. Clientes y Empleados
INSERT INTO personas_customer ...
INSERT INTO personas_employee ...

-- 6. Simulación día a día
-- Ventas
INSERT INTO orders ...
INSERT INTO order_details ...
INSERT INTO ventas_payment ...
INSERT INTO inventario_inventoryevent (salidas) ...

-- Reabastecimientos
INSERT INTO inventario_reorderrequest ...
INSERT INTO inventario_reorderstatushistory ...
INSERT INTO inventario_inventoryevent (entradas) ...

-- Auditorías
INSERT INTO inventario_inventoryevent (ajustes) ...
INSERT INTO inventario_auditlog ...

-- 7. Actualización de stock final
UPDATE inventario_product SET quantity = ...
```

## 🔍 Verificación de Datos

Después de cargar los datos, verifica con:

```sql
-- Stock actual de productos
SELECT id, name, quantity, min_stock, 
       CASE WHEN quantity <= min_stock THEN '⚠️ BAJO' ELSE '✅ OK' END as estado
FROM inventario_product
ORDER BY id;

-- Total de ventas
SELECT COUNT(*) as total_ordenes, SUM(total) as ventas_totales
FROM orders
WHERE status = 'COMPLETED';

-- Productos más vendidos
SELECT p.name, SUM(od.quantity) as total_vendido
FROM order_details od
JOIN inventario_product p ON p.id = od.product_id
GROUP BY p.name
ORDER BY total_vendido DESC;

-- Solicitudes de reabastecimiento
SELECT COUNT(*) as total_reorders, 
       SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as recibidas,
       SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) as pendientes
FROM inventario_reorderrequest;
```

## ⚠️ Notas Importantes

1. **Ejecutar en orden:** Primero inventario (productos, proveedores, etc.), luego personas, finalmente ventas.
2. **IDs únicos:** El script usa IDs específicos. Si ya tienes datos, ajusta los IDs iniciales.
3. **Stock coherente:** El stock final refleja todas las operaciones del año.
4. **Fechas futuras:** Las últimas órdenes de reabastecimiento pueden tener fecha de entrega después del 28-11-2025.

## 🛠️ Troubleshooting

**Error: duplicate key value violates unique constraint**
- Solución: Limpia las tablas antes de importar o ajusta los IDs iniciales en el script.

**Error: foreign key constraint**
- Solución: Asegúrate de ejecutar los INSERTs en el orden correcto (bodega → proveedores → categorías → productos → personas → ventas).

**Encoding issues (caracteres especiales)**
- Solución: Asegúrate de que el archivo SQL se guarda con encoding UTF-8.

## 📝 Ejemplo de Uso Completo

```bash
# 1. Generar datos
cd backend
python generador_datos_simulados.py

# 2. Verificar archivo generado
ls -lh datos_simulados.sql

# 3. Copiar al contenedor Docker
docker cp datos_simulados.sql rep-drill-db-1:/tmp/

# 4. Ejecutar en cada base de datos
docker exec -it rep-drill-db-1 bash

# Dentro del contenedor:
psql -U postgres -d inventario_db -f /tmp/datos_simulados.sql
# (Filtrar y ejecutar solo las partes correspondientes a cada DB)

# 5. Verificar
psql -U postgres -d inventario_db -c "SELECT COUNT(*) FROM inventario_product;"
psql -U postgres -d ventas_db -c "SELECT COUNT(*) FROM orders;"
```

## 📞 Soporte

Para modificaciones o consultas sobre el script, revisa:
- Modelos de Django en `backend/servicio_inventario/inventario/models.py`
- Modelos de ventas en `backend/servicio_ventas/ventas/models.py`
- Modelos de personas en `backend/servicio_personas/personas/models.py`

---

**Versión:** 1.0  
**Última actualización:** 2025-11-19  
**Autor:** Sistema Rep-Drill
