# Registro de cambios

Cambios relevantes del proyecto, más reciente primero. Este archivo se inicia en
la Fase 3 de consolidación; el historial anterior vive en el log de git y en
`PROGRESS_REPORT.md` / `HANDOFF.md`.

## 2026-07-19 · Fase 6 — Smart Bets Engine (motor de valor, modular)

Nuevo motor de valor `lib/smartBets/` que CONSUME el Prediction Engine y produce
recomendaciones con EV, riesgo, score explicable y trazabilidad. Aditivo y puro:
no toca el Prediction Engine, el Dashboard ni el flujo de producción de
`value_bets`/`smart_bet_picks`. Gates: tsc 0 · lint 0 · npm test **179/179** ·
build compila. Caracterización del PE intacta.

### Módulos (responsabilidad única cada uno)
- `version.ts` (`SMART_BETS_ENGINE_VERSION = sbe-1.0.0`, independiente del PE),
  `types.ts` (contratos + `TraceRecord`), `validate.ts` (ingesta/inconsistencias),
  `markets.ts` (registro extensible multi-deporte), `value.ts` (comparación de
  cuotas multi-casa + EV), `risk.ts` (riesgo 0-100), `scoring.ts` (score
  explicable 0-100), `engine.ts` (orquestador), `index.ts` (API).

### Principios respetados
- **Nunca genera probabilidades:** consume `ModelProbabilities` del PE; los
  mercados derivados (doble oportunidad, empate-no-acción) son álgebra sobre las
  probs del PE. Mercados de goles/BTTS/córners **registrados pero inactivos**
  (punto de extensión, sin inventar nada).
- **Sin duplicar lógica:** reutiliza `gradeEV`/`kellyFraction` de `valueBets`.
- **Multi-casa / multi-deporte / multi-mercado** por diseño (registro + `bestQuote`).
- **Trazabilidad:** cada recomendación registra fecha, partido, mercado, prob y
  cuota usadas, EV, riesgo, versión del PE y del SBE, y motivo.

### Pruebas (`tests/smartBetsEngine.test.ts`, 10 casos)
Determinismo, sin duplicados (una por familia), consistencia (EV>0), aislamiento
por deporte, validación de inconsistencias, scoring reproducible, registro
extensible. ADR-012. Doc: `docs/SMART_BETS_ENGINE.md`.

### Pendiente (no en esta fase, evita regresiones)
Cablear a persistencia/endpoint con datos reales + panel en Dashboard + activar
mercados de goles cuando el PE exponga la rejilla — requiere entorno conectado.

## 2026-07-19 · Fases B + C — Observabilidad y Learning Engine (modo "propone")

Activación de primitivas latentes (Fase B) y maquinaria del Learning Engine
(Fase C · F1/F2), **sin cambiar ningún resultado ni publicar pesos nuevos**.
Todo aditivo y fail-open. Gates: tsc 0 · lint 0 · npm test **169/169** · build
compila. Caracterización del motor intacta (3/3, bit a bit).

### Fase B · Observabilidad (escritores de tablas latentes)
- Nuevo `lib/observability.ts`: `recordModelRegistry` (versiona métricas del
  modelo en `model_registry`, idempotente por model_name+version) y
  `recordDataHealth` (upsert de salud de fuente en `data_health`). Ambos
  **nunca lanzan** — mismo patrón que `lib/syncLog.ts`.
- `services/sync/recalibrate.ts`: al final (fail-open) calcula las métricas de
  las predicciones YA resueltas (Brier/accuracy, sin fabricar nada) y las
  registra en `model_registry`; registra la salud de la fuente `recalibrate` en
  `data_health`. No cambia la recalibración ni ninguna predicción.

### Fase C · Learning Engine — F1 (métricas) + F2 (tuner "propone")
- `lib/calibration.ts`: nuevas `expectedCalibrationError` (ECE) y
  `calibrationReport` (Brier/log-loss/accuracy/ECE + n) — puras, testeadas.
- Nuevo `lib/prediction/tuner.ts` (F2, **modo propone**): búsqueda por
  coordenadas sobre el símplex que minimiza el Brier con TODOS los guardarraíles
  del diseño (pesos ∈ [0.05,0.60], Σ=1, cota de paso 0.05, regularización, masa
  mínima, mejora ≥ 2%). Determinista. **Devuelve un candidato; NO publica ni
  activa nada** — la adopción (F3) es una decisión versionada y aprobada.
- Tests: `tests/tuner.test.ts` (guardarraíles, determinismo, nunca empeora) +
  ECE/report en `tests/calibration.test.ts`. +11 casos.

### Límite de validación declarado (honesto)
- La lógica pura (métricas, tuner) está 100% validada por tests. Las ESCRITURAS
  a Supabase (`model_registry`/`data_health`) no pudieron ejecutarse en este
  sandbox (sin `.env.local`), pero son aditivas y fail-open (jamás tumban el
  sync). Requieren un entorno conectado para confirmar el efecto end-to-end.
- **F3 (activación de pesos en vivo) NO se implementó**: cambia predicciones y
  exige aprobación humana + entorno conectado (ADR-011).

## 2026-07-19 · Fase 5 — Consolidación del Prediction Engine (fútbol)

Modularización del motor de fútbol **sin cambiar resultados**. Verificado bit a
bit: `tests/predictionEngineCharacterization.test.ts` (valores dorados exactos +
10 corridas idénticas), tests de motor 20/20, suite completa **161/161**, tsc 0,
lint 0, build compila y empaqueta correctamente.

### Modularización (responsabilidades desacopladas)
- Nuevo `lib/prediction/config.ts`: `ENGINE_VERSION`, `Weights`,
  `DEFAULT_WEIGHTS` y `ENGINE_PARAMS` (todas las perillas del modelo con sus
  valores actuales, sin cambio).
- Nuevo `lib/prediction/factors.ts`: `normalizeELO`, `formToScore`,
  `computeXgFactor`, `computeConfidenceLevel` + utilidades (`clamp`, `round4`).
- Nuevo `lib/prediction/poisson.ts`: `simulateMatch` + tipos `Probabilities`,
  `ExactScore` (rejilla Poisson/Dixon-Coles).
- `lib/predictionEngine.ts` reescrito como **fachada + orquestación**: mantiene
  el API público estable (re-exporta todo); los 13 consumidores no cambian.

### Configuración y versionado
- Parámetros antes hardcodeados (ρ Dixon-Coles, maxGoals, amortiguación de
  eliminatoria, cotas de λ, escala de lesiones, mezcla de mercado, coeficientes
  de confianza) centralizados en `ENGINE_PARAMS`. Cuidado con el trap IEEE-754:
  la mezcla de mercado usa pesos explícitos {model:0.8, market:0.2} (no 1−0.8).
- Nuevo `docs/PREDICTION_ENGINE.md`: documento canónico (arquitectura, I/O,
  estrategia de versionado, registro de versiones, preparación Learning Engine).

### Integración
- `.eslintrc.json`: los submódulos `lib/prediction/*` añadidos a las barreras
  NBA y Tenis (no pueden importar el motor de fútbol ni bypasear la fachada).

### Sin cambios (respetadas las reglas de la fase)
- No se tocó Smart Bets, Dashboard ni la IA. No se implementó aprendizaje
  automático — solo se dejó el motor preparado para recibirlo.

## 2026-07-19 · Fase 4 — Ejecución del roadmap (iteraciones 1-2)

Ejecución controlada del roadmap. Cada iteración validada con `tsc` (0),
`next lint` (0) y `npm test`. Completa la **Fase A** del Plan Maestro
(fundaciones) — A1/A2 se entregaron en la Fase 3; A3 aquí.

### Iteración 1 · Guard de la regla de oro (A3) — Arquitectura, prioridad Crítica
- Nuevo `tests/goldenRule.test.ts`: escanea `app/`, `lib/`, `services/` y falla
  si una query a `matches`/`teams`/`team_statistics`/`predictions` no está
  acotada por competición (o por fila/entidad única). Convierte el guardrail más
  crítico del proyecto —hasta ahora dependiente de disciplina humana— en garantía
  de CI.
- 4 queries globales legítimas (KPIs/gates que solo leen columnas neutras) se
  marcaron con el comentario explícito `regla-oro-ok: <motivo>` en
  `app/api/sync/live/route.ts`, `app/dashboard/page.tsx` (×2) y
  `services/sync/odds.ts`. Solo comentarios — sin cambio de comportamiento.

### Iteración 2 · Guard de la frontera V3 (ADR-004) — Arquitectura
- Nuevo `tests/v3Frontier.test.ts`: verifica que la capa analítica
  (`lib/models`, `lib/agents`, `lib/intelligence`) no importa el cliente de
  escritura (`@/lib/supabase/admin`) ni muta tablas autoritativas. Cierra el
  riesgo del "motor sombra" (RT-2). Confirmado limpio hoy; el guard lo mantiene.

### Resultado
- Suite **156 → 158** tests (+3 casos). tsc 0 · lint 0. Sin cambios de runtime.

### Pendiente / bloqueo declarado para la Fase B
- La Fase B (activar escritores en `model_registry`/`data_health` y el dispatcher
  sobre `jobs`) toca las rutas de sync que escriben en Supabase. Implementarlas
  con seguridad exige un entorno con Supabase conectado para validar los writes
  sin regresión; en este sandbox no hay credenciales (`.env.local` ausente). Se
  deja como la siguiente tarea, pendiente de ese entorno. No se envía código de
  escritura que no pueda ejecutarse al menos una vez.

## 2026-07-19 · Fase 3 — Consolidación de la arquitectura

Consolidación técnica sin cambios de comportamiento. Todo verificado con
`tsc --noEmit` (0 errores), `next lint` (0 errores), `npm test` (155/155) y build
(compila y empaqueta todas las páginas; solo falla en fase de datos por ausencia
de credenciales Supabase en el sandbox — no relacionado con estos cambios).

### Limpieza de deuda técnica segura
- Eliminados **imports no usados** en 14 archivos (iconos lucide, hooks de React,
  utilidades y tipos muertos). Cambio puramente de higiene: ningún símbolo
  eliminado se referenciaba. Sin efecto en runtime, tipos ni resultados.
  - `app/dashboard/page.tsx` (`competitionHref`), `app/sitemap.ts`
    (`COMPETITION_ID`), `components/champion/ChampionProbabilityBracket.tsx`
    (`Medal`), `components/charts/TeamComparisonRadar.tsx` (`Legend`),
    `components/digital-twin/MatchDigitalTwin.tsx` (`TacticalProfile`),
    `components/intelligence/MonteCarloPanel.tsx` (`formToScore`),
    `components/matches/AISmartBetsPanel.tsx` (10 iconos + `cn` +
    `SmartBetRecommendation`), `components/matches/MatchesTable.tsx`
    (`useCallback`, `formatProbability`),
    `components/matches/smart-bets/sections.tsx` (`useMemo`, `useQuery`,
    `computeSmartBets`, `generateFallbackAnalysis`, `AnalysisContext`,
    `GroupContext`), `components/nba/NbaSchedule.tsx` (`cn`),
    `components/search/GlobalSearch.tsx` (`cn`),
    `components/simulation/SimulationEngine.tsx` (`useMutation`, `Play`),
    `lib/agents/riskAssessmentAgent.ts` (`Probabilities`),
    `services/matches.service.ts` (`Lineup`).

### Documentación sincronizada con el estado real
- `README.md`, `CLAUDE_CONTEXT.md`: cifras corregidas — migraciones **050 → 054**,
  verify_migrations **43 → 47** chequeos, tests unitarios **68/72 → 155**, e2e
  **15/17 → 28**.
- `CLAUDE.md`: próxima migración **054 → 055**.
- Nuevo `docs/CAPA_ANALITICA_VS_PRODUCCION.md`: declara la frontera entre el motor
  de producción (autoritativo) y la capa analítica V3 (realiza ADR-004).
- `docs/FASE1_*` y `docs/FASE2_*`: cifra de tests alineada a 155 (conteo en
  ejecución) para coherencia entre entregables.

### No modificado a propósito (hallazgos documentados, no tocados)
- **Variables/parámetros locales sin uso** (~30 casos): pueden ocultar un efecto
  colateral o cambiar una firma; requieren análisis caso por caso. Se dejan para
  una revisión dirigida, no para una limpieza masiva.
- **Warnings heredados de lint** (`<img>` vs `next/image`, `react-hooks/
  exhaustive-deps`): cambiarlos altera comportamiento (memoización, carga de
  imágenes). Fuera del alcance "cambio seguro".
- **Migraciones `012` duplicadas en número**: renumerar una migración ya aplicada
  en producción es riesgoso; se documenta como deuda opcional.
- **Tabla `jobs` y tablas de monitoreo sin escritores**: son primitivas que las
  Fases B–C deben *activar*, no eliminar.
