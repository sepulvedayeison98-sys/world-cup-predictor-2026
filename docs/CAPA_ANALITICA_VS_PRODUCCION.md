# Frontera: capa analítica (V3) vs. camino de producción

> **Origen:** Fase 3 · Consolidación (realiza el ADR-004 del Plan Maestro).
> **Estado:** Declarativo. **No cambia código** — documenta la frontera que ya
> existe implícitamente para que las Fases B–C la respeten.
> **Última verificación:** 2026-07-19 contra el repositorio.

## Por qué existe este documento

En el repo coexisten **dos nociones de "modelo"** que conviene no confundir. La
Fase 1 la señaló como la principal ambigüedad conceptual y la Fase 2 la resolvió
por decisión (ADR-004). Este documento fija la regla operativa.

## Las dos capas

### 1. Camino de producción (autoritativo) — la fuente de verdad

Es el único que **persiste predicciones oficiales** en la tabla `predictions` y
deriva de ellas value bets, veredictos y KPIs.

```
Datos (Supabase) → motor puro por deporte → services/sync/recalibrate → predictions
```

| Deporte | Motor autoritativo | Persistencia |
|---------|--------------------|--------------|
| Fútbol | `lib/predictionEngine.ts` (5 factores → Poisson/Dixon-Coles) | `predictions`, `exact_score_predictions` |
| NBA | `lib/nba/engine.ts` (ELO walk-forward) | `predictions` (draw=0) |
| Tenis | `lib/tennis/engine2.ts` (tennis-2.0) | tablas `tennis_*` |

**Invariante:** cualquier número que el usuario perciba como "la predicción del
sistema" proviene de aquí. Hay **una sola** fuente por deporte (regla ya vigente,
documentada en el encabezado de `predictionEngine.ts`).

### 2. Capa analítica V3 (exploración y visualización) — NO autoritativa

`lib/models/`, `lib/agents/`, `lib/intelligence/` alimentan paneles de
transparencia y exploración (`components/intelligence/*`,
`components/digital-twin/*`): curva de calibración, comparación de modelos,
Monte Carlo ilustrativo, gemelo digital, análisis táctico.

**Consumidores verificados (Fase 1):** solo componentes de `intelligence/`,
`digital-twin/` y `matches/OddsComparisonTable`. **Ningún** sincronizador ni
`recalibrate` importa esta capa.

## La regla (una frase)

> **La capa V3 puede *leer* datos y *mostrar* análisis, pero NUNCA escribe en
> `predictions`, `value_bets`, `smart_bet_picks` ni `match_verdicts`. Toda
> predicción oficial pasa por el motor puro único de su deporte.**

## Implicaciones para las próximas fases

- **Fase B (Learning/observabilidad):** el auto-tuning de pesos y el registro en
  `model_registry` operan sobre el **camino de producción**, no sobre V3.
- **Fase C (precisión):** comparar versiones de pesos usa el motor autoritativo;
  V3 puede visualizar la comparación, no producirla.
- **Riesgo que esta frontera cierra (RT-2):** que V3 se convierta en un "motor
  sombra" divergente. Mientras no escriba predicciones, no puede divergir de la
  verdad publicada.

## Qué NO se decide aquí (deuda documentada, sin tocar)

- Si la redundancia aparente de "market movement" (`lib/marketMovement.ts`,
  `lib/intelligence/marketMovement.ts`, `lib/agents/marketMovementAgent.ts`) debe
  consolidarse. Es una tarea de mantenibilidad de prioridad baja (Fase 2 §7); se
  analiza caso por caso antes de tocar, no en esta fase.
