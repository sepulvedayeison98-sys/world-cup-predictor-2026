# HANDOFF — Veredicto · Inteligencia Deportiva

> Documento de traspaso de sesión. Última actualización: **2026-07-17 (2ª sesión)**.
> Para el contexto arquitectónico completo: `CLAUDE.md`, `CLAUDE_CONTEXT.md`,
> `docs/TENNIS_ARCHITECTURE.md`. Para el histórico de entregas: `PROGRESS_REPORT.md`.

---

## 1. Objetivo

Plataforma web pública multi-deporte de predicción e inteligencia deportiva
(Next.js 15 + TypeScript + Tailwind + Supabase, sin autenticación), con tres
dominios **estrictamente aislados**:

- **Fútbol** (Mundial 2026 + 5 grandes ligas) — CONGELADO, solo correcciones críticas.
- **NBA** — completo (motor nba-1.0, hub, calibración).
- **Tenis** — el frente activo: dominio completo con motor propio, medido con
  backtest walk-forward honesto.

Norte del proyecto (plan maestro vigente): posicionarse como producto de
inteligencia deportiva de clase mundial (referencias: SofaScore, FlashScore,
FotMob) con identidad propia: **predicción explicable, métricas medidas, cero
datos fabricados**.

### Principios innegociables (aplican a TODO)

1. **Data First**: si la fuente no lo da, no existe en la UI. Nada se estima ni
   se rellena; lo bloqueado se declara.
2. **Medido, no prometido**: ningún cambio del motor se promueve sin backtest
   comparativo pareado que lo justifique. Los rechazos se documentan.
3. **Aislamiento de dominios**: barreras ESLint en las cuatro direcciones
   (tenis↛fútbol, tenis↛NBA, fútbol↛tenis, NBA↛tenis). Utilidades compartidas
   → módulos neutros (`lib/utils`, `lib/sports`, `lib/calibration`).
4. `npm run build` limpio antes de cada push. Migraciones numeradas
   (siguiente: **055**) + actualizar `supabase/verify_migrations.sql`.
5. Secretos jamás en el repo ni en el chat (`.env.local` está gitignoreado).

---

## 2. Estado actual (qué hay en producción)

Prod: `https://world-cup-predictor-2026-flax.vercel.app` · Rama de trabajo:
`claude/page-data-refresh-63yioa` (se mantiene en FF-sync con `main`; ambas
apuntan al mismo commit tras cada entrega).

### Dominio Tenis — TODO desplegado y verificado en vivo

| Pieza | Estado |
|---|---|
| Datos ATP 2024-2026 (TML-Database, esquema Sackmann) | ✅ 581 jugadores · 362 torneos · 5.676 partidos · 11.352 stats (cobertura saque/resto **100 %**) · 6.508 rankings observados |
| **Motor `tennis-2.0` (PRODUCCIÓN)** | ✅ **64,00 % precisión · Brier 0,4375 · log-loss 0,6264 — BATE al ranking puro (64,26 % vs 64,19 %) por primera vez** |
| Hub `/tennis` + `/tennis/ranking` + `/tennis/jugadores/[id]` + `/tennis/partidos` (+`[id]` detalle) + `/tennis/h2h` + `/tennis/inteligencia` | ✅ todas 200 en prod, datos reales |
| Registro (`lib/sports.ts`) | ✅ ATP `activa` (sidebar con icono propio); WTA `proximamente` (sin fuente, declarado) |
| **Monte Carlo de mercados** (`lib/tennis/monteCarlo.ts`) | ✅ punto→juego→set→partido con % reales de saque/resto; calibrado contra frecuencias reales (σ=0,065: 2-0 64,11 % vs 63,96 % real); UI en `/tennis/h2h` (`MarketsPanel`) |
| **serveReturn cableado a UI** | ✅ índices 0-100 en perfil de jugador (sección "Saque y devolución") y detalle de partido |
| **Re-validación anti-overfitting** | ✅ split temporal 2020-2026 desde CSVs TML (16.270 partidos): la ventaja Brier/log-loss del 2.0 replica out-of-sample — sin overfitting; 2.0 se mantiene. Ver `TENNIS_ARCHITECTURE.md` |
| **Buscador global + dashboard raíz** | ✅ tenistas en `/api/search` y en el overlay; franja "Tenis · ATP" (top ranking + precisión del motor) en `/dashboard` |
| Pruebas | ✅ **148/148** (`npm test`, +7 de Monte Carlo) · lint 0 errores · e2e del dominio tenis en `e2e/tennis.spec.ts` |

### Historial del motor de tenis (todo medido walk-forward, sin fuga)

| Versión | Cambio | Resultado | Decisión |
|---|---|---|---|
| tennis-1.0 | base (ELO 1500 + factores 35/25/20/10/10) | 63,75 % / 0,4420 | superada |
| tennis-1.1 | + siembra ELO por ranking (cold-start) | 63,95 % / 0,4400 | superada |
| tennis-1.2 | mapeo logElo del ranking | 63,43 % / 0,4427 — **peor** | **RECHAZADA** |
| 2.0 espec original | superficie 30 % dominante + fatiga | 62,89 % / 0,4500 — **peor** | **RECHAZADA** |
| **tennis-2.0 final** | ancla rankingElo 40 % + superficie 15 % (respaldo jerárquico) + forma 15 % + **saque/devolución 15 %** + H2H 10 % + mercado 5 % (renormaliza) | **64,00 % / 0,4375** | **PRODUCCIÓN** |

La composición final salió de una **ablación pareada** (una pasada, mismo
estado, variantes simultáneas) con **regla de promoción pre-declarada**:
batir a 1.1 en las 3 métricas globales Y en Brier de ventana tardía
(≥2025-07-01). Los variants `tennis-1.0/1.1/1.2` siguen reproducibles vía
`?step=backtest&variant=…`.

---

## 3. Archivos en los que se está trabajando (mapa del dominio tenis)

### Motor y lógica pura (`lib/tennis/`)
- `constants.ts` — ids, `TENNIS_MODEL_VERSION='tennis-2.0'`, `TENNIS_WEIGHTS`
  (1.x), **`TENNIS2_WEIGHTS`** (2.0 final), `TENNIS_ENGINE_CONFIG` (mapa
  versión→config, fuente única).
- `engine.ts` — motor 1.x: ELO walk-forward (K=32, siembra `rankToSeedElo`),
  `sortChronologically`, `formLog5` (exportada), `extractFactors`,
  `predictTennisMatch`.
- **`engine2.ts`** — motor 2.0: `TennisWalkState2` (envuelve el walk-state 1.1
  + acumulador saque/devolución), `extractFactors2`, `predictTennisMatch2`,
  `K_SERVE_RETURN=2.7`, `SR_MIN_MATCHES=3`.
- `serveReturn.ts` — perfil saque/devolución 0-100 (`SR_ANCHORS` a priori);
  **aún sin cablear a la UI** (siguiente paso).
- `fatigue.ts` — proxy de frescura; **EXCLUIDO del motor** (medido dañino con
  granularidad fecha-de-torneo). Queda como módulo puro para cuando la fuente
  tenga fechas/minutos por partido.
- `stats.ts` — stats de jugador (Win%, Hold%, Break%, superficie, forma).
- `types.ts` — espejo tipado del schema `tennis_*`.

### Servicios (`services/tennis/`)
- `backtest.ts` — walk-forward 1.x y 2.0 (camino `useEngine2`), persiste en
  `tennis_backtests` + `tennis_model_metrics`, baseline "gana el mejor
  clasificado" sobre el mismo subconjunto.
- `queries.ts` — capa de lectura anon/ISR: hub, **ranking honesto**
  (`buildLatestRanking`: última posición conocida POR JUGADOR — ver §5),
  perfil, resultados, H2H, detalle de partido.
- `sackmann.ts` — ingesta TML (idempotente, paginada, dedupe).
- `contracts.ts` — contratos de sync.

### UI (`app/tennis/` + `components/tennis/`)
- Páginas: `page.tsx` (hub), `ranking/`, `jugadores/[id]/`, `partidos/` +
  `partidos/[id]/`, `h2h/`, `inteligencia/`.
- Componentes: `RankingTable`, `ResultsList`, `H2HPicker`, `ui.tsx` (átomos;
  acento lima `#a3e635`).
- API: `app/api/tennis/sync/route.ts` — `step=matches|validate|backtest`
  (+`variant=`), protegida con `CRON_SECRET`.

### Pruebas (`tests/`)
`tennisEngine.test.ts` (18) · `tennisEngine2.test.ts` (7) ·
`tennisServeReturn.test.ts` (3) · `tennisFatigue.test.ts` (5) ·
`tennisStats.test.ts` (6) · `tennisSackmann.test.ts` · `sports.test.ts`
(aislamiento) · resto de dominios. Total **141**.

---

## 4. Qué ha cambiado (últimas entregas, más reciente primero)

-5. **Sesión 2026-07-19 — Fase 6 (Smart Bets Engine)** (misma rama):
   - Nuevo `lib/smartBets/` — motor de valor modular (version/types/validate/
     markets/value/risk/scoring/engine) que **consume** el Prediction Engine y
     produce recomendaciones con EV, riesgo, score explicable y trazabilidad.
   - Nunca genera probabilidades (álgebra sobre las probs del PE); registro de
     mercados extensible multi-deporte/casa; reutiliza `gradeEV`/`kellyFraction`
     (sin duplicar). Aditivo: no toca PE, Dashboard ni `value_bets` de producción.
   - `tests/smartBetsEngine.test.ts` (10). Suite 179/179, tsc 0, lint 0, build
     compila. ADR-012. Doc `docs/SMART_BETS_ENGINE.md`.
   - **Pendiente:** cablear a datos reales + panel Dashboard + activar mercados de
     goles (requiere que el PE exponga la rejilla) — con entorno conectado.

-4. **Sesión 2026-07-19 — Fases B + C (observabilidad + Learning Engine)** (misma rama):
   - **Fase B:** `lib/observability.ts` (`recordModelRegistry`, `recordDataHealth`,
     fail-open) cableado en `recalibrate` → puebla `model_registry` (métricas de
     resueltas) y `data_health`. Aditivo, no cambia predicciones.
   - **Fase C · F1:** `lib/calibration.ts` gana ECE + `calibrationReport`.
   - **Fase C · F2:** `lib/prediction/tuner.ts` — tuner de pesos **modo propone**
     (coordinate search + guardarraíles, determinista). NO publica ni activa.
   - Suite 169/169, tsc 0, lint 0, build compila. ADR-011.
   - **Límite:** las escrituras a Supabase no se validaron aquí (sin `.env.local`);
     son fail-open. **F3 (activar pesos en vivo) pendiente** de aprobación +
     entorno conectado. Dispatcher sobre `jobs` (B4) también pendiente.

-3. **Sesión 2026-07-19 — Fase 5 (Prediction Engine fútbol)** (misma rama):
   - Motor modularizado en `lib/prediction/{config,factors,poisson}.ts` +
     `lib/predictionEngine.ts` como fachada (API estable, 13 consumidores intactos).
   - Parámetros centralizados en `ENGINE_PARAMS` (config.ts) → listo para el
     Learning Engine (Fase C) sin reescribir. `docs/PREDICTION_ENGINE.md` es el
     documento canónico (arquitectura, versionado, registro de versiones).
   - **Sin cambiar resultados:** `tests/predictionEngineCharacterization.test.ts`
     fija valores dorados exactos; refactor verificado bit a bit. Suite 161/161,
     tsc 0, lint 0, build compila. ADR-010.
   - Barreras ESLint NBA/Tenis extendidas a `lib/prediction/*`. No se tocó Smart
     Bets, Dashboard ni IA. Sin ML.

-2. **Sesión 2026-07-19 — Fase 4 (ejecución roadmap, iter. 1-2)** (misma rama):
   - **A3 · Guard regla de oro** `tests/goldenRule.test.ts`: falla la CI si una
     query a `matches`/`teams`/`team_statistics`/`predictions` no está acotada por
     competición. 4 queries globales legítimas marcadas con `regla-oro-ok`.
   - **Frontera V3** `tests/v3Frontier.test.ts` (ADR-004): la capa analítica no
     importa el cliente de escritura ni muta tablas autoritativas.
   - Suite 156→158, tsc 0, lint 0, sin cambios de runtime. **Fase A completa.**
   - **Siguiente (Fase B):** activar escritores `model_registry`/`data_health` +
     dispatcher sobre `jobs`. BLOQUEO en este sandbox: requiere Supabase conectado
     para validar los writes; `.env.local` ausente. No se envía código de
     escritura sin poder ejecutarlo. Ver ADR-002/008 y CHANGELOG.

-1. **Sesión 2026-07-19 — Fases 1-3 de arquitectura** (rama
   `claude/indu-predictor-architecture-analysis-5qxz6y`):
   - **Fase 1** `docs/FASE1_ANALISIS_ARQUITECTURA.md`: análisis completo del repo
     (15 secciones, solo lectura).
   - **Fase 2** `docs/FASE2_PLAN_MAESTRO_EVOLUCION.md`: plan maestro, arquitectura
     objetivo, roadmap A-E, matrices, 8 ADR (diseño, sin implementar).
   - **Fase 3** consolidación segura: imports muertos eliminados en 14 archivos
     (sin cambio de comportamiento — `tsc` 0, `lint` 0, `npm test` 155/155),
     documentación sincronizada con el estado real (migraciones 054, tests 155,
     verify 47, e2e 28), nuevo `docs/CAPA_ANALITICA_VS_PRODUCCION.md` (frontera
     V3) y `CHANGELOG.md`. Detalle en el changelog.

0. **Sesión 2026-07-17 (2ª) — plan §6 ejecutado** (rama
   `claude/handoff-action-plan-splrmy`):
   - **Monte Carlo de mercados** (§6.1): `lib/tennis/monteCarlo.ts` +
     `MarketsPanel` en `/tennis/h2h` + 7 tests. Validado y CALIBRADO contra
     frecuencias reales (`PERFORMANCE_SIGMA=0,065`, medido; el iid puro
     sesgaba 2-0 en −9 pp). Media de resto del circuito medida: 0,3594.
   - **serveReturn → UI** (§6.2): índices 0-100 en perfil y detalle de partido.
   - **Re-validación anti-overfitting** (§6.3): hecha LOCALMENTE desde CSVs
     TML 2020-2026 (sin tocar la BD): Brier/log-loss del 2.0 mejoran a 1.1
     también out-of-sample (0,4299/0,6177 vs 0,4319/0,6201 en 2020-23);
     precisión empatada dentro del ruido. 2.0 se mantiene. La INGESTA de
     2020-2023 a la BD viva sigue pendiente (requiere service key — abajo).
   - **Backlog menor** (§6.6): tenistas en el buscador global
     (`/api/search` + overlay), franja "Tenis · ATP" en `/dashboard`,
     e2e Playwright del dominio (`e2e/tennis.spec.ts`), nota del registro
     actualizada a `tennis-2.0`.
   - Hallazgo de fuente: TML publica **`minutes` por partido** → la fatiga
     2.0 con carga por minutos es reintenable (sigue faltando la fecha
     exacta por partido).
1. **tennis-2.0 a producción** (2026-07-17): módulos `serveReturn`/`fatigue`,
   `engine2`, ablación, promoción. Docs con la historia completa.
2. **Detalle de partido** `/tennis/partidos/[id]` + enlaces desde resultados.
3. **tennis-1.2 escrito** (quedó pendiente de medición por pérdida de
   secretos; hoy medido y **rechazado**).
4. **Fix ranking honesto**: `tennis_rankings` NO es foto semanal — son
   observaciones por partido. El board pasó de "los 4 que jugaron la última
   fecha" a **última posición conocida por jugador** (510 filas).
5. **Fase 6**: `/tennis/partidos` (filtro superficie + paginación) y
   `/tennis/h2h`.
6. **Fase 8**: hub + ranking + perfiles + inteligencia + flip ATP a `activa`.
7. **tennis-1.1** (cold-start) promovida; luego superada por 2.0.

---

## 5. Qué ha fallado y qué se intentó (lecciones — NO repetir)

### Experimentos del motor rechazados con números
- **tennis-1.2 (logElo del ranking)**: hipótesis razonable ("ratio mal
  calibrado en extremos"), midió PEOR en las 3 métricas. Lección: el ratio
  crudo `rank2/(rank1+rank2)` es empíricamente fuerte como factor.
- **2.0 espec original (superficie 30 % dominante)**: el ELO por superficie
  solo es más ruidoso que el ancla ranking+ELO. La jerarquía con respaldo
  (superficie→global→ranking) como factor SECUNDARIO (15 %) sí funciona.
- **Fatiga (proxy fecha-de-torneo)**: dañina. `scheduled_at` es la fecha de
  INICIO del torneo (todas las rondas comparten fecha) — sin minutos por
  partido no hay señal de carga útil. No reintroducir sin mejores datos.

### Fallos operativos y sus fixes
- **Reinicio del contenedor efímero** a mitad de sesión: borró `node_modules`
  (→ `npm ci`) y **`.env.local`** (→ el usuario restauró las claves Supabase;
  **`CRON_SECRET` sigue SIN restaurar** — "no se dejaba ver" en Vercel).
  *Workaround activo*: los backtests se corren LOCALMENTE con la service key
  (`npx tsx` + cargar `.env.local` a `process.env`), sin pasar por el endpoint.
- **Tope de 1000 filas de PostgREST**: mordió dos veces (stats de ingesta, y
  la auditoría de cobertura que primero dio "9 %" cuando era 100 %). SIEMPRE
  paginar con `.order().range()` o `fetchAllRows`.
- **Ranking engañoso** (ver §4.4): "última fecha" ≠ "ranking actual" en una
  fuente por-partido. Captions de UI lo declaran.
- **Smokes con regex ingenuos**: React inserta `<!-- -->` entre texto estático
  y dinámico (`ATP #<!-- -->5`) — hubo una falsa alarma de "rank ausente".
  Limpiar comentarios HTML antes de hacer match.
- **tsx en CJS**: no admite top-level await en scripts sueltos — envolver en
  `async function main()`.
- **Un commit entró directo a `main`** por un checkout olvidado; se detectó y
  se re-sincronizó la rama. Verificar `git branch --show-current` antes de
  commitear.

### Bloqueado por falta de fuente (NO fabricar)
- **Cuotas de tenis / EV / Smart Bets tenis (Fase 9)**: requiere API de pago
  (api-sports no cubre tenis). **Decisión de compra del dueño pendiente.**
- **WTA / Challenger / ITF**: sin fuente verificable en TML-Database.
- **Lesiones, clima, minutos jugados, indoor**: la fuente no los trae.
- **Próximos partidos de TENIS**: TML-Database es histórico (resultados ya
  jugados), no publica sorteos/fixtures. Para "próximos partidos" reales
  hace falta OTRO proveedor de calendario. Comparativa hecha (sesión
  2026-07-19): **tennis-api.com (matchstat)** es la candidata recomendada
  — free tier 50 req/día, Pro US$29/mes, cubre ATP+WTA+ITF+Challenger con
  fixtures/draws (desbloquearía WTA de paso). Alternativas: api-tennis.com
  (solo trial, desde US$40), Sportradar/SportsDataIO (más robustas, sin
  precio público — hablar con ventas). Mantener TML para histórico/motor.
  **Decisión de fuente/compra del dueño pendiente.**

### Próximos partidos de NBA — resuelto en código (sesión 2026-07-19)
No era falta de fuente: API-Basketball (api-sports.io, misma clave que
fútbol) SÍ trae partidos `NS`/scheduled. El gap era de config:
`NBA_API_SEASON` estaba fijo en `2024-2025` y el ingest no estaba en cron.
**Arreglado**: `currentNbaSeason()` sigue el calendario (override por env
`NBA_API_SEASON`), ventanas de fecha del ingest derivadas del año, y
`/api/sync/nba/ingest` + `/api/sync/nba/calibrate` añadidos al cron de
Vercel (05:00 y 05:30). Se activa al restaurar `CRON_SECRET`. **Nota real**:
no habrá "próximos partidos" NBA hasta que la liga publique el calendario
2026-27 (~mediados de agosto); hasta entonces la vitrina vacía es honesta,
no un bug. Para adelantarlo cuando salga, setear env `NBA_API_SEASON=2026-2027`.

### Próximos partidos de FÚTBOL (5 ligas) — bloqueado por plan de pago
Verificado (sesión 2026-07-19): las 5 ligas tienen SOLO la temporada
2024-25 completa (Premier/LaLiga/SerieA 380/380, Bundesliga/Ligue1 308/308),
último partido may-2025. Falta la 2025-26 (ya jugada) y la 2026-27. **No es
bug de código sino límite del plan Free de API-Football (solo hasta 2024)** —
subir el número de temporada sin plan de pago hace que la API devuelva 0.
**Dejado listo (código, no bloqueante)**: `DEFAULT_SEASON` ahora se controla
con la env `FOOTBALL_API_SEASON` y existe `currentFootballSeason()` (+ test).
Tras contratar el upgrade (~19 USD/mes, ya en el roadmap), el flujo es:
1) poner `FOOTBALL_API_SEASON=2026` en Vercel; 2) llamar una vez
`/api/sync/leagues/ingest` (opcional `?season=2025` para backfillear la
campaña ya jugada). La ingesta de ligas queda manual/on-demand a propósito
(no en cron: los fixtures no cambian a diario y en Free malgastaría cuota).
Recomendable añadir un cron semanal de `/api/sync/leagues/ingest` SOLO ya
con el plan de pago.

### Mundial → retrospectiva + goleadores (sesión 2026-07-19)
El Mundial 2026 **terminó** (103/104 finished, la final fue el 19-jul). Se
convirtió el hub a registro histórico: **eliminados** el Simulador what-if
(ruta `/simulation` + tile + `TournamentPathTracker` "avance por etapas"),
las proyecciones de goleadores y el KPI forward "Favorito al título"
(→ "Favorito del modelo"). Campeón muestra ahora **campeón real vs lo que
daba el modelo** (banner solo si la final está resuelta en BD). Goleadores
es tabla FINAL sin proyección.
**Hallazgo de datos (goleadores desactualizados)**: NO existe sync de
`player_statistics` — se pobló A MANO vía migración `026_wc2026_players_scorers.sql`
con datos "al 23-jun-2026 (jornada 2)". El sync de ESPN (`espn-stats.ts`)
solo escribe `match_statistics` (nivel equipo), nunca goles por jugador. La
UI ahora declara honestamente "datos a la última actualización". **Arreglo
real (backlog)**: cablear una fuente de stats por jugador (ESPN summary
scoring plays, o api-football player-stats en plan pago) o re-seed manual
verificado — no se fabrican cifras finales (conocimiento < resultado real).

### Próximo (pendiente, decisión del dueño): reforma KPIs cross-deporte + UX
El usuario pidió (2026-07-19) revisar qué KPIs/pestañas sirven para
ligas/NBA/tenis, estandarizar los útiles y trabajar la experiencia. Alcance
acordado: **poda del Mundial primero (HECHO)**; la reforma cross-deporte +
UX queda para un pase aparte. Patrón clave a estandarizar en los 3 deportes:
página "precisión/calibración del motor" (existe en los tres), tarjeta de
predicción de partido, tabla de ranking, y franja de próximos partidos
(bloqueada por datos en fútbol/NBA hoy).

---

## 6. Qué se planea hacer (en orden recomendado)

1. ✅ **HECHO (2ª sesión 2026-07-17) — Monte Carlo de mercados**: módulo puro
   + 7 tests + validación/calibración contra frecuencias reales + UI en H2H.
2. ✅ **HECHO — `serveReturn.ts` cableado a la UI** (perfil + detalle).
3. ✅ **HECHO (validación) / ⏳ PENDIENTE (ingesta)** — re-validación
   anti-overfitting con split temporal 2020-2026 desde CSVs TML: 2.0 sin
   señal de overfitting, se mantiene. La ingesta de 2020-2023 a la BD viva
   sigue pendiente: requiere service key o `CRON_SECRET` (punto 4). Al
   ingestarse, re-correr el backtest remoto (los números cambiarán a los de
   la tabla de `TENNIS_ARCHITECTURE.md` §re-validación).
4. **Restaurar `CRON_SECRET`** (acción del dueño en Vercel → env vars) para
   reactivar el endpoint remoto de backtest/sync — y con él, la ingesta
   2020-2023 (`?step=matches&year=…` por temporada).
5. **Fase 9 Smart Bets tenis**: al confirmarse fuente de cuotas (candidatas:
   API-Tennis, Sportradar, Tennis-Data). El schema (`tennis_smart_bets`,
   mercados moneyline/over-under/handicap) ya existe en migración 053. El
   Monte Carlo ya publica las probabilidades; con cuotas se calcula EV.
6. ✅ **HECHO — backlog menor**: buscador global con tenistas; franja de
   tenis en dashboard raíz; e2e Playwright del dominio. Queda: fatiga 2.0
   (TML trae `minutes` por partido — reintenable con carga por minutos,
   pero sigue sin fecha exacta por partido); WTA (sin fuente).

---

## 7. Cómo operar (recetario de la sesión)

```bash
# Gates (correr SIEMPRE antes de push)
npm run type-check && npm test && npm run lint
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run build

# E2E (sandbox)
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test

# Backtest local (sin CRON_SECRET; usa service key de .env.local)
# — script efímero que carga .env.local a process.env e importa
#   runTennisBacktest('ATP', { modelVersion: 'tennis-2.0' }) con npx tsx.
#   Ver PROGRESS_REPORT 2026-07-17. Borrar el script tras usarlo.

# Flujo de entrega (2ª sesión 2026-07-17: se trabajó en la rama
# claude/handoff-action-plan-splrmy por mandato de la sesión remota;
# el merge a main queda a criterio del dueño)
git branch --show-current   # debe ser claude/page-data-refresh-63yioa
# commit → push rama → checkout main → merge --ff-only → push main → volver a la rama
# después: smoke de las URLs públicas en prod (esperar ~1-2 min el deploy)
```

- `.env.local` actual: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (restauradas 2026-07-17). **Falta `CRON_SECRET`.**
- Supabase project: `jruanwjjsygcmmvwxexh` · Vercel prod:
  `world-cup-predictor-2026-flax.vercel.app`.
- El detalle fino de decisiones del dominio tenis vive en
  `docs/TENNIS_ARCHITECTURE.md` (incluye la ablación completa del motor).
