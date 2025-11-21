"""
Sistema de prompts para el chatbot de forecasting.
Optimizado para español chileno y análisis de tendencias.
"""
from typing import Dict, Any, List
from datetime import datetime


def build_system_prompt(context: Dict[str, Any]) -> str:
    """
    Construye el prompt de sistema con contexto de forecasting.
    
    Args:
        context: Diccionario con forecasts, métricas, recomendaciones
    
    Returns:
        str: Prompt de sistema en español chileno
    """
    summary = context.get('summary', {})
    accuracy = context.get('accuracy_metrics', {})
    
    # Formatear forecast
    forecast_7d = summary.get('forecast_next_7_days', 0)
    forecast_30d = summary.get('forecast_next_30_days', 0)
    growth = summary.get('growth_percent', 0)
    
    # Formatear números con separador de miles chileno
    forecast_7d_fmt = f"${forecast_7d:,.0f}".replace(',', '.')
    forecast_30d_fmt = f"${forecast_30d:,.0f}".replace(',', '.')
    
    # Determinar confiabilidad
    mape = accuracy.get('mape', 100)
    if mape < 10:
        confidence_text = "Alta (MAPE < 10%)"
    elif mape < 20:
        confidence_text = "Media (MAPE 10-20%)"
    else:
        confidence_text = "Baja (MAPE >= 20%)"
    
    prompt = f"""Eres un asistente experto en análisis de forecasting y tendencias de ventas para Rep Drill, un sistema de gestión empresarial chileno.

**Tu Rol:**
- Analizar datos de forecasting generados con Prophet (modelo estadístico de series temporales)
- Identificar tendencias, patrones estacionales y riesgos
- Recomendar acciones concretas basadas en los datos reales
- Explicar conceptos técnicos de forma simple y accionable para gerentes y tomadores de decisiones

**Contexto Actual (Actualizado: {context.get('timestamp', 'N/A')}):**

📊 **Forecast de Ventas (próximos {context.get('periods', 30)} días):**
- Proyección 7 días: {forecast_7d_fmt} CLP
- Proyección 30 días: {forecast_30d_fmt} CLP
- Crecimiento estimado: {growth:+.1f}%

🎯 **Precisión del Modelo:**
- MAPE (error promedio): {mape:.1f}%
- Confiabilidad: {confidence_text}
- Significado: {"El modelo es muy preciso y confiable" if mape < 10 else "El modelo tiene precisión aceptable" if mape < 20 else "El modelo requiere más datos históricos"}

⚠️ **Alertas de Restock:**
- Productos críticos: {summary.get('critical_restock_count', 0)}
- Productos en alerta alta: {summary.get('high_restock_count', 0)}

**Instrucciones Críticas:**
1. **Idioma**: Responde SIEMPRE en español chileno formal pero cercano (usa "tú", no "usted")
2. **Datos Reales**: USA SOLO datos del contexto proporcionado - NUNCA inventes números o fechas
3. **Honestidad**: Si no tienes información suficiente, di claramente "No tengo datos para responder eso con precisión"
4. **Accionable**: Prioriza insights que lleven a acciones: "Deberías...", "Te recomiendo...", "Considera..."
5. **Riesgos Específicos**: Menciona productos o situaciones concretas: "El Filtro de Aceite Mann tiene riesgo de stockout"
6. **Formato**:
   - Usa emojis para categorías: 📈 tendencias, ⚠️ alertas, 💡 recomendaciones, 🎯 precisión
   - Números con formato chileno: $1.500.000 CLP (punto para miles)
   - Fechas: DD-MM-YYYY
   - Porcentajes con signo: +15% o -8%
7. **Brevedad**: Máximo 3-4 párrafos cortos por respuesta (250-300 palabras)
8. **Contexto**: Si hay historial de conversación, mantén coherencia con mensajes anteriores

**Ejemplo de Respuesta Ideal:**
"📈 **Tendencia Positiva:** Las ventas proyectadas para los próximos 7 días muestran un crecimiento del 15%, alcanzando $5.2 millones CLP. El peak se espera para el 15-11-2025.

⚠️ **Alerta Urgente:** Tenemos 3 productos en estado crítico que necesitan reorden inmediato:
- Filtro de Aceite Mann: Stock para 2 días
- Pastillas de Freno Bosch: Stock para 3 días
- Aceite Motor Castrol 5W30: Stock para 1 día

💡 **Recomendación:** Prioriza la compra de estos productos antes del 10-11-2025. El modelo tiene una precisión del 8.5% (muy confiable), por lo que puedes confiar en estas proyecciones para tomar decisiones."

**Datos Disponibles en Contexto:**
{_format_context_for_prompt(context)}

**Restricciones:**
- NO menciones limitaciones técnicas del modelo o del sistema
- NO uses jerga técnica sin explicarla (ej: "MAPE" → "error promedio del modelo")
- NO respondas preguntas fuera del ámbito de forecasting/ventas/inventario
- Si preguntan por análisis que requieren datos no disponibles, sugiere qué información necesitarías
"""
    return prompt


def _format_context_for_prompt(context: Dict) -> str:
    """Formatea el contexto en texto legible para el LLM."""
    lines = []
    
    # Top productos (limitar a 3 para no saturar el prompt)
    top_products = context.get('top_products', [])
    if top_products and len(top_products) > 0:
        lines.append("\n**Top 3 Productos por Demanda Proyectada:**")
        for i, prod in enumerate(top_products[:3], 1):
            name = prod.get('product_name', 'N/A')
            forecast_values = [f['yhat'] for f in prod.get('forecast', [])[:30]]
            if forecast_values:
                forecast_sum = sum(forecast_values)
                forecast_fmt = f"${forecast_sum:,.0f}".replace(',', '.')
                lines.append(f"{i}. {name}: {forecast_fmt} CLP proyectados (30 días)")
    
    # Recomendaciones críticas (prioridad 'urgent')
    restock = [
        r for r in context.get('restock_recommendations', []) 
        if r.get('reorder_priority') == 'urgent'
    ]
    if restock and len(restock) > 0:
        lines.append("\n**Productos Críticos que Requieren Reorden Urgente:**")
        for rec in restock[:5]:
            product_name = rec.get('product_name', 'N/A')
            stockout_risk = rec.get('stockout_risk_score', 0)
            recommended_qty = rec.get('recommended_order_quantity', 0)
            days_of_stock = rec.get('days_of_stock_remaining', 0)
            lines.append(
                f"- {product_name}: Riesgo {stockout_risk:.0%}, "
                f"{days_of_stock:.0f} días de stock, ordenar {recommended_qty} unidades"
            )
    
    # Componentes de tendencia
    components = context.get('components', {})
    if 'trend' in components and components['trend']:
        trend_values = components['trend']
        if len(trend_values) >= 2:
            trend_direction = "alcista ↗" if trend_values[-1] > trend_values[0] else "bajista ↘"
            trend_change = abs(trend_values[-1] - trend_values[0])
            trend_change_pct = (trend_change / abs(trend_values[0])) * 100 if trend_values[0] != 0 else 0
            lines.append(
                f"\n**Tendencia General:** {trend_direction.capitalize()} "
                f"({trend_change_pct:+.1f}% en el periodo analizado)"
            )
    
    # Estacionalidad semanal
    if 'weekly' in components and components['weekly']:
        lines.append("\n**Patrón Semanal:** Se detectan variaciones semanales en la demanda (considerar días de mayor/menor venta)")
    
    # Estacionalidad anual
    if 'yearly' in components and components['yearly']:
        lines.append("**Patrón Anual:** Se detectan variaciones estacionales a lo largo del año")
    
    return "\n".join(lines) if lines else "No hay datos de contexto adicionales disponibles en este momento."


def build_user_prompt(question: str, conversation_history: List[Dict] = None) -> str:
    """
    Construye el prompt del usuario con historial opcional.
    
    Args:
        question: Pregunta del usuario
        conversation_history: Últimos N mensajes para contexto
    
    Returns:
        str: Prompt del usuario con contexto
    """
    if conversation_history and len(conversation_history) > 0:
        # Incluir solo los últimos 3 mensajes para no saturar el contexto
        recent = conversation_history[-3:]
        history_text = "\n".join([
            f"{'👤 Usuario' if msg['role'] == 'user' else '🤖 Asistente'}: {msg['content']}"
            for msg in recent
        ])
        return f"""**Historial reciente de la conversación:**
{history_text}

**Pregunta actual del usuario:**
{question}

**Nota:** Mantén coherencia con el historial. Si ya respondiste algo similar, puedes referirte a tu respuesta anterior."""
    
    return question


def get_quick_question_prompts() -> List[str]:
    """
    Retorna lista de preguntas rápidas sugeridas para el usuario.
    
    Returns:
        Lista de strings con preguntas predefinidas
    """
    return [
        "¿Cómo están las ventas proyectadas para esta semana?",
        "¿Qué productos tienen mayor riesgo de quedarse sin stock?",
        "¿Cuál es la tendencia de ventas del último mes?",
        "Dame un resumen de las alertas críticas de inventario",
        "¿Cuáles son los productos con mayor demanda proyectada?",
        "¿Qué tan confiable es el pronóstico actual?",
        "¿Cuándo debería hacer el próximo pedido de inventario?",
        "¿Hay algún patrón semanal en las ventas?",
    ]
