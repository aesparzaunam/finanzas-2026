# Diseño de Dashboard de Finanzas Personales (v2026)

## Visión General
El objetivo central es un dashboard que proporcione claridad inmediata sobre la salud financiera del usuario, evitando el "ruido" de datos irrelevantes y enfocándose en métricas accionables.

## Métricas Clave (Hero Section)
Estas 5 métricas deben ser las protagonistas del dashboard principal.

### 1. Patrimonio Neto (Net Worth)
*   **Definición**: Activos Totales - Pasivos Totales.
*   **Visualización**: Tarjeta grande con el monto actual. Gráfico de línea sparkline mostrando la tendencia de los últimos 12 meses.
*   **Código de Color**: Verde (Crecimiento), Rojo (Decrecimiento).
*   **Objetivo**: Maximizar este número a lo largo del tiempo.

### 2. Flujo de Caja Mensual (Cash Flow)
*   **Definición**: Ingresos Mensuales - Gastos Mensuales (Mes en curso).
*   **Visualización**: Barra de progreso dual o gráfico de velocímetro.
    *   Izquierda: Ingresos acumulados.
    *   Derecha: Gastos acumulados.
*   **Indicador**: "Superávit" (Verde) o "Déficit" (Rojo) proyectado para fin de mes.

### 3. Tasa de Ahorro (Savings Rate)
*   **Definición**: % del ingreso total destinado a ahorro e inversión.
*   **Visualización**: Gráfico de anillo (Donut Chart).
*   **Meta**: Mostrar la meta del usuario (ej. 20%) vs. realidad actual.

### 4. Runway / Fondo de Emergencia
*   **Definición**: Meses de vida cubiertos por liquidez actual (Cash / Gastos Promedio).
*   **Visualización**: Indicador tipo "Batería".
    *   0-1 mes: Crítico (Rojo).
    *   1-3 meses: Precaución (Amarillo).
    *   3-6+ meses: Seguro (Verde).

### 5. Ratio de Endeudamiento (DTI)
*   **Definición**: % de ingreso mensual destinado a pagar deudas.
*   **Visualización**: Barra horizontal simple con umbral de "Peligro" al 30-40%.
*   **Acción**: Alerta si supera el umbral recomendado.

## Estructura de Navegación Sugerida
1.  **Dashboard**: Las 5 métricas clave + Resumen de actividad reciente.
2.  **Transacciones**: Detalle de ingresos/gastos.
3.  **Presupuesto**: Control de categorías.
4.  **Metas**: Objetivos de ahorro.
5.  **Análisis**: Reportes históricos profundos.
