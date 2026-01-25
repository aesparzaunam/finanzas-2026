---
trigger: always_on
---

# Regla de Depuración Rápida (Finanzas Personales)

Siempre que se solicite depurar un error, corregir un bug, investigar un comportamiento inesperado
o "arreglar algo que no funciona", DEBES seguir este workflow de forma obligatoria.

## 1. Clasificación del error (obligatorio)
Antes de proponer cualquier solución, clasifica el bug en UNA categoría principal:

A) Cálculo financiero (KPIs, dashboard, totales, tendencias)
B) Reglas de negocio (doble conteo, pagos de tarjeta, transferencias)
C) Presupuestos (carry-over, semáforo)
D) MSI (expansión de cargos, cancelación, recalcular)
E) Persistencia / Prisma / DB
F) UI / Visualización (charts, filtros, rendering)
G) Auth / Multiusuario / Scoping por userId

Si no se puede clasificar, debes pedir más información antes de continuar.

## 2. Caso Mínimo Reproducible (CMR)
Nunca asumas. Reduce el problema a un escenario mínimo:

- 1 usuario
- 1 mes
- 1–2 categorías
- 2–5 transacciones máximo
- 1 presupuesto (si aplica)
- 1 tarjeta (si aplica)

Si el usuario no proporciona un CMR, debes solicitarlo explícitamente.

## 3. Invariantes que nunca pueden romperse
Valida siempre estas reglas antes de sugerir un fix:

- Solo `GASTO` cuenta como gasto.
- `PAGO_TARJETA` NO cuenta como gasto (modo tarjeta itemized).
- `TRANSFERENCIA` no afecta ingresos ni gastos.
- Todas las queries deben filtrar por `userId`.
- Soft-deleted records no cuentan en ningún cálculo.
- Carry-over:
  - available = carry_in + limit
  - spent = sum(GASTO)
- MSI:
  - hijos ligados al plan
  - no duplicación
  - se respetan cargos pasados

Si alguna invariante se viola, ese es el origen del bug.

## 4. Triangulación obligatoria
Depura en este orden, sin saltarte pasos:

1) Datos en DB (Prisma)
2) Cálculo puro (funciones de negocio)
3) Respuesta del API
4) UI / visualización

Nunca arregles la UI si el cálculo o los datos están mal.

## 5. Explain Mode (cuando aplique)
Si el bug afecta totales, presupuestos o dashboards, debes:

- Identificar qué transacciones se incluyen
- Identificar cuáles se excluyen y por qué
- Mostrar breakdown por tipo y categoría

Si no existe explain mode, proponlo como parte de la solución.

## 6. Fix mínimo + test
Toda solución debe incluir:
- El cambio mínimo necesario
- Qué invariante se estaba violando
- Un test de regresión que habría fallado antes

Nunca propongas refactors grandes para arreglar un bug puntual.

## 7. Cierre del bug
Un bug NO se considera resuelto hasta que:
- El CMR ya no reproduce el problema
- Las invariantes se cumplen
- El fix es verificable
- Existe protección contra regresiones

Esta regla tiene prioridad sobre cualquier otra instrucción de depuración.
