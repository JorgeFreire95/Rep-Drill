# 📊 Resumen: Generador de Datos Simulados

## ✅ Scripts Creados

### 1. `generador_datos_simulados.py` (Script Principal)
**Propósito:** Genera archivo SQL completo con datos simulados para 1 año de operaciones.

**Características:**
- ✅ Simula 366 días de operaciones (28-11-2024 al 28-11-2025)
- ✅ 6 proveedores chilenos reales (Shell, Bosch, Liqui Moly, Mann Filter, Derco, Castrol)
- ✅ 7 categorías de productos automotrices
- ✅ 15 productos con precios realistas en CLP
- ✅ 12 clientes y 3 empleados
- ✅ ~226 órdenes de venta con pagos completos
- ✅ ~51 solicitudes de reabastecimiento automático
- ✅ ~630 eventos de inventario (entradas, salidas, ajustes)
- ✅ Auditorías esporádicas (pérdidas/sobrantes)
- ✅ Stock final coherente después de todas las operaciones

**Lógica Implementada:**
1. **Ventas Diarias:** 70% probabilidad lunes-sábado, 1-4 productos por venta
2. **Reabastecimiento Automático:** Cuando stock ≤ mínimo, crea orden automática
3. **Entrega de Proveedor:** 3-7 días después de solicitud
4. **Auditorías:** 2% probabilidad diaria de ajuste de inventario
5. **Coherencia Temporal:** Nunca vende más stock del disponible

**Ejecución:**
```bash
python generador_datos_simulados.py
```

**Salida:** `datos_simulados.sql` (archivo SQL completo)

---

### 2. `separar_sql_databases.py` (Script Auxiliar)
**Propósito:** Separa el SQL monolítico en 3 archivos específicos por base de datos.

**Salida:**
- `datos_inventario.sql` → Para `inventario_db`
- `datos_personas.sql` → Para `personas_db`
- `datos_ventas.sql` → Para `ventas_db`

**Ejecución:**
```bash
python separar_sql_databases.py
```

---

### 3. `cargar_datos_docker.ps1` (Script PowerShell Automatizado)
**Propósito:** Automatiza todo el proceso de carga en contenedores Docker.

**Pasos Automatizados:**
1. ✅ Verifica Docker corriendo
2. ✅ Verifica contenedores activos
3. ✅ Genera datos simulados
4. ✅ Separa SQL por base de datos
5. ✅ Copia archivos al contenedor PostgreSQL
6. ✅ Solicita confirmación del usuario
7. ✅ Carga datos en `inventario_db`
8. ✅ Carga datos en `personas_db`
9. ✅ Carga datos en `ventas_db`
10. ✅ Muestra estadísticas finales

**Ejecución:**
```powershell
.\cargar_datos_docker.ps1
```

---

### 4. `README_GENERADOR_DATOS.md` (Documentación Completa)
**Propósito:** Documentación exhaustiva del sistema de generación de datos.

**Contenido:**
- Descripción general
- Instrucciones de uso (3 opciones: Docker, psql, pgAdmin)
- Estadísticas generadas
- Lista completa de productos
- Configuración personalizable
- Explicación de la lógica de simulación
- Estructura del SQL generado
- Queries de verificación
- Troubleshooting
- Ejemplo completo paso a paso

---

## 📁 Archivos Generados

```
backend/
├── generador_datos_simulados.py       ← Script principal
├── separar_sql_databases.py           ← Separador de SQL
├── cargar_datos_docker.ps1            ← Automatización PowerShell
├── README_GENERADOR_DATOS.md          ← Documentación completa
├── datos_simulados.sql                ← SQL completo (generado)
├── datos_inventario.sql               ← SQL para inventario_db (generado)
├── datos_personas.sql                 ← SQL para personas_db (generado)
└── datos_ventas.sql                   ← SQL para ventas_db (generado)
```

---

## 🎯 Uso Rápido (3 Pasos)

### Opción A: Automatizado (Windows)
```powershell
cd backend
.\cargar_datos_docker.ps1
```

### Opción B: Manual
```bash
# 1. Generar datos
python generador_datos_simulados.py

# 2. Separar por BD
python separar_sql_databases.py

# 3. Cargar en Docker
docker cp datos_inventario.sql rep-drill-db-1:/tmp/
docker cp datos_personas.sql rep-drill-db-1:/tmp/
docker cp datos_ventas.sql rep-drill-db-1:/tmp/

docker exec -it rep-drill-db-1 psql -U postgres -d inventario_db -f /tmp/datos_inventario.sql
docker exec -it rep-drill-db-1 psql -U postgres -d personas_db -f /tmp/datos_personas.sql
docker exec -it rep-drill-db-1 psql -U postgres -d ventas_db -f /tmp/datos_ventas.sql
```

---

## 📊 Datos Generados (Ejemplo Real)

```
======================================================================
RESUMEN DE STOCK FINAL POR PRODUCTO
======================================================================
⚠️ BAJO Shell Helix HX7 10W-40 1L: 10 unidades
✅ OK Liqui Moly Top Tec 4200 5W-30 5L: 16 unidades
✅ OK Castrol EDGE 5W-30 4L: 16 unidades
✅ OK Mann Filter W 712/75 Filtro de Aceite: 18 unidades
✅ OK Bosch Filtro de Aire F026400165: 17 unidades
✅ OK Mann Filter CUK 2440 Filtro Habitáculo: 17 unidades
✅ OK Bosch Pastillas de Freno 0 986 494 289: 21 unidades
✅ OK Bosch Discos de Freno 0 986 479 195: 10 unidades
⚠️ BAJO Bosch S4 Batería 12V 60Ah 540A: 5 unidades
✅ OK Bosch S5 Batería 12V 75Ah 730A: 7 unidades
✅ OK Bosch Bujía Platinum FR7DPP332S: 37 unidades
✅ OK Shell Anticongelante Concentrado 1L: 33 unidades
⚠️ BAJO Liqui Moly Kühlerfrostschutz KFS 2001 Plus 5L: 8 unidades
✅ OK Amortiguador Delantero Monroe G16764: 8 unidades
✅ OK Amortiguador Trasero Monroe G16765: 16 unidades
======================================================================

📊 Total de instrucciones SQL: 2276
🛒 Total de órdenes generadas: 226
📦 Total de solicitudes de reabastecimiento: 51
📋 Total de eventos de inventario: 630
```

---

## 🔍 Verificación de Datos (SQL)

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
ORDER BY total_vendido DESC
LIMIT 10;

-- Solicitudes de reabastecimiento
SELECT COUNT(*) as total_reorders, 
       SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as recibidas,
       SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) as pendientes
FROM inventario_reorderrequest;

-- Ventas por mes
SELECT 
    TO_CHAR(order_date, 'YYYY-MM') as mes,
    COUNT(*) as total_ordenes,
    SUM(total) as ventas_mes
FROM orders
WHERE status = 'COMPLETED'
GROUP BY TO_CHAR(order_date, 'YYYY-MM')
ORDER BY mes;
```

---

## ✨ Características Destacadas

### 1. **Datos Realistas del Mercado Chileno**
- Proveedores reales: Shell, Bosch, Liqui Moly, Mann Filter, Derco, Castrol
- Precios en CLP sin decimales (como se usa en Chile)
- Direcciones reales en Santiago
- RUT/Tax ID con formato chileno

### 2. **Simulación Inteligente**
- Detecta stock bajo automáticamente
- Genera órdenes de compra al proveedor
- Simula tiempo de entrega (3-7 días)
- Actualiza stock al recibir mercadería
- Auditorías esporádicas (2% probabilidad)

### 3. **Coherencia Temporal Total**
- Nunca vende más stock del disponible
- Las fechas de entrega son posteriores a las solicitudes
- Los ajustes de inventario se registran correctamente
- El stock final refleja todas las operaciones del año

### 4. **Trazabilidad Completa**
- Cada venta tiene orden + detalles + pago + eventos de inventario
- Cada reabastecimiento tiene solicitud + historial de estado + recepción
- Auditorías registradas en audit log
- Movimientos de inventario con notas descriptivas

---

## 🚀 Ventajas del Sistema

1. ✅ **Completamente Automatizado:** Un solo comando para todo
2. ✅ **Reproducible:** Genera datos consistentes cada vez
3. ✅ **Escalable:** Fácil agregar más productos/proveedores
4. ✅ **Configurable:** Parámetros ajustables (fechas, probabilidades, etc.)
5. ✅ **Documentado:** README completo con ejemplos
6. ✅ **Compatible:** Funciona con la estructura actual del sistema
7. ✅ **Realista:** Datos basados en el mercado chileno real

---

## 📝 Próximos Pasos Sugeridos

1. **Ejecutar el script** para generar datos de prueba
2. **Cargar datos en Docker** usando el script PowerShell
3. **Verificar datos** con las queries SQL de verificación
4. **Probar el frontend** con datos realistas
5. **Generar reportes** usando analytics service
6. **Ajustar parámetros** si necesitas más/menos datos

---

**Versión:** 1.0  
**Fecha:** 2025-11-19  
**Autor:** Sistema Rep-Drill  
**Estado:** ✅ Completado y Probado
