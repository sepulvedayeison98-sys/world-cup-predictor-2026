# Diseño · Ajuste automático de pesos del modelo por calibración

> Documento de diseño (2026-07-10). Cómo hacer que el motor de fútbol **ajuste
> sus 5 pesos según la calibración observada**, de forma segura, interpretable
> y honesta (Data First). Aún NO implementado — este archivo es el plan.
>
> Alcance: **solo el motor de fútbol** (`lib/predictionEngine.ts`). La NBA
> tiene motor propio (ELO sin empates) y queda fuera. Es un cambio sensible
> sobre la generación de predicciones de fútbol: se diseña **aditivo** y
> detrás de un modo "propone" con aprobación humana antes de automatizar.

---

## 0. Estado actual — por qué es viable (y qué falta)

- ✅ **El motor ya está parametrizado.** `computeModelPrediction(input, weights)`
  acepta un vector de pesos; `DEFAULT_WEIGHTS = {xg:0.40, elo:0.25, form:0.15,
  market:0.10, news:0.10}` es solo el valor por defecto. No hay que tocar el motor.
- ✅ **`model_registry` ya versiona** con `version`, `accuracy_1x2`, `brier_score`,
  `created_at` (migración 020; RLS + lectura anon desde la 050).
- ❌ **Falta:** un *feature store* (snapshot de inputs), el *tuner* y los
  *guardarraíles* de adopción.

---

## 1. Función objetivo — calibración, no acierto

Optimizar los 5 pesos para minimizar un **proper scoring rule** sobre las
predicciones resueltas (`was_correct` / `actual_outcome` no nulos):

- **Primario: Brier multiclase (1X2)** — premia que el 64% sea *de verdad* 64%,
  no solo acertar el signo.
- **Secundario:** log-loss.
- **Diagnóstico:** ECE (expected calibration error) + accuracy, para transparencia.

> Por qué no accuracy como objetivo: accuracy solo mira el ganador. El veredicto
> de Argentina 3-2 (acertó el signo pero se quedó corto) es exactamente el caso
> que Brier penaliza y accuracy ignora.

---

## 2. El problema de datos (eje del diseño — Data First)

Para reentrenar hay que **reproducir cada predicción con los inputs que existían
en ese momento** (ELO, forma, xG, mercado, lesiones), no con los datos de hoy —
los equipos cambian de forma partido a partido. Hoy `predictions` **no** guarda
esos features (solo probabilidades, `model_version`, y algunos `*_weight`).

**Solución: feature store.** Al generar cada predicción, snapshotear el
`ModelInput` en una tabla `prediction_features` (o un JSONB en `predictions`):
`{homeElo, awayElo, homeForm, awayForm, homeXg, awayXg, homeXga, awayXga,
marketProbabilities, homeInjuryImpact, awayInjuryImpact}`.

**Regla honesta:** para el histórico ya jugado sin snapshot, **no fabricar
features retroactivos**. Se arranca el snapshot ahora y se tunea cuando haya
masa. (La reconstrucción walk-forward de ELO/forma es posible pero con error;
mejor acumular datos reales que estimar el pasado.)

---

## 3. El tuner (optimización interpretable)

- Son **5 pesos que suman 1** → 4 grados de libertad. Basta **búsqueda por
  coordenadas / Nelder-Mead sobre el símplex**. Sin redes neuronales, 100%
  explicable.
- **Restricciones:** cada `wᵢ ∈ [0.05, 0.60]`, `Σw = 1`. Ningún factor
  desaparece ni domina.
- **Regularización:** penalizar la distancia a los pesos actuales
  (`λ·‖w − w_actual‖²`) → cambios graduales, no saltos.
- **Walk-forward sin fuga:** entrenar con resueltos *antes* de una fecha de
  corte, evaluar en la ventana posterior. Nunca mirar el futuro.
- **Por competición:** un set de pesos por Mundial y por cada liga. El fix de
  fuga de forma (migración 042) ya probó que las competiciones no son
  intercambiables.

---

## 4. Guardarraíles de adopción (lo que evita el desastre)

| Guardarraíl | Regla |
|---|---|
| Masa mínima | No ajustar con < ~80-100 resueltos por competición |
| Mejora significativa | Adoptar solo si baja el Brier out-of-sample ≥ 2% vs el actual |
| Cambio acotado | Ningún peso se mueve > 0.05 por corrida |
| Versionado + reversible | Cada set = fila en `model_registry` (weights JSON, brier, accuracy, muestra, fecha, datos usados); revertible; bump de `MODEL_VERSION` |
| Human-in-the-loop | Modo **"propone"** (guarda candidato, requiere aprobación) → luego **automático** con guardarraíles cuando haya confianza |

---

## 5. Cadencia

No por partido (ruidoso). Un cron aparte (`/api/sync/tune-weights`, con
`CRON_SECRET`) **semanal o cada N resultados nuevos**, ejecutado después de que
la cadena post-resultado (`runPostResultChain`) refrescó stats.

---

## 6. Conexión al motor (cambio mínimo)

`recalibratePredictions` (y el detalle de partido) leen los **pesos activos de
la competición** vía un helper `activeWeights(competitionId)` desde
`model_registry`, con `DEFAULT_WEIGHTS` como fallback:

```ts
const weights = await activeWeights(competitionId)  // fallback DEFAULT_WEIGHTS
computeModelPrediction(input, weights)
```

**El motor no cambia** — solo cambia de dónde vienen los pesos.

---

## 7. Transparencia (el foso)

Publicar en `/inteligencia` la **historia de pesos**: cuándo cambiaron, de qué a
qué, con qué Brier antes/después y sobre cuánta muestra. El modelo evoluciona a
la vista de todos — es exactamente la honestidad verificable que los agregadores
no pueden copiar.

---

## 8. Roadmap por fases

| Fase | Entregable | Esfuerzo | Toca predicciones en vivo |
|---|---|---|---|
| **F0** ✅ | Feature store: snapshot de `ModelInput` por predicción (habilitador) — migración 052 + writer en recalibrate | hecho | No (solo escribe features) |
| **F1** ✅ | Métricas puras: Brier/log-loss/**ECE**/accuracy en `lib/calibration.ts` (`expectedCalibrationError`, `calibrationReport`) + tests | hecho | No |
| **F2** ✅ | Tuner offline (modo *propone*): `lib/prediction/tuner.ts` — coordinate search con TODOS los guardarraíles → candidato (no publica) + tests | hecho | No (no activa nada) |
| **F3** ⏳ | Activación: `activeWeights()` leído por el motor + cron semanal + aprobación manual. **Pendiente** (cambia predicciones; requiere entorno conectado + aprobación — ADR-011) | 1-2 d | Sí (con fallback + aprobación) |
| **F4** | Automático con guardarraíles + historia de pesos visible en /inteligencia | 1-2 d | Sí (con todos los guardarraíles) |
| **F5 (opc.)** | Escalado de goles (λ Poisson) — objetivo separado del 1X2 | 1-2 d | Sí |

**Orden recomendado de arranque:** F0 primero. Es el habilitador, no cambia
ninguna predicción (solo empieza a guardar los inputs), y sin él el tuner no
puede reentrenar fielmente. A partir de ahí las fases son incrementales y cada
una es reversible.

---

## 9. Nota sobre el volumen de goles

El veredicto de Argentina 3-2 apuntaba a **subestimación de goles** — eso es el
escalado de la rejilla Poisson (λ total esperado), un knob **relacionado pero
distinto** del 1X2. Los pesos calibran el resultado 1X2; el volumen de goles se
afinaría con un parámetro aparte (F5). Se mantienen separados para no mezclar
objetivos de optimización.

---

## 10. Riesgos transversales

- **Overfitting** → regularización + margen de adopción ≥ 2% + walk-forward.
- **Factor mercado** → las cuotas se limpian de partidos terminados; el feature
  store (F0) lo resuelve al guardar el `marketProbabilities` del momento.
- **Data First** → nunca reconstruir features retroactivos inventados; arrancar
  el snapshot y acumular.
- **Congelación de fútbol** → diseño aditivo (pesos leídos de tabla,
  `DEFAULT_WEIGHTS` como red de seguridad) y modo "propone" al inicio, para que
  jamás degrade producción sin aprobación humana.
