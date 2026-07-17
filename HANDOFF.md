# HANDOFF — Veredicto · Inteligencia Deportiva

> Documento de traspaso de sesión. Última actualización: **2026-07-17**.
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
| Pruebas | ✅ **141/141** (`npm test`) · lint 0 errores · build 89/89 páginas |

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
- **WTA / Challenger / ITF**: sin fuente verificable.
- **Lesiones, clima, minutos jugados, indoor**: la fuente no los trae.
- **Calendario de próximos partidos**: la fuente es histórica; no hay fixtures.

---

## 6. Qué se planea hacer (en orden recomendado)

1. **Monte Carlo de mercados** (siguiente natural, sin bloqueos): simulador
   punto→juego→set→partido alimentado con hold%/break% reales del motor 2.0
   para publicar probabilidades de **2-0/2-1, over/under de juegos y
   hándicap** — sin cuotas (los mercados con EV llegan con la Fase 9).
   Módulo puro + tests + validación contra frecuencias reales del histórico
   (p. ej. % real de 2-0 en best-of-3) antes de UI.
2. **Cablear `serveReturn.ts` a la UI**: índices de saque/devolución 0-100 en
   el perfil de jugador y en el detalle de partido.
3. **Validación anti-overfitting del motor**: traer más temporadas ATP desde
   TML (2020-2023) y re-validar tennis-2.0 con split temporal real
   (advertencia in-sample documentada en `TENNIS_ARCHITECTURE.md` §motor).
4. **Restaurar `CRON_SECRET`** (acción del dueño en Vercel → env vars) para
   reactivar el endpoint remoto de backtest/sync.
5. **Fase 9 Smart Bets tenis**: al confirmarse fuente de cuotas (candidatas:
   API-Tennis, Sportradar, Tennis-Data). El schema (`tennis_smart_bets`,
   mercados moneyline/over-under/handicap) ya existe en migración 053.
6. Backlog menor: buscador global con tenistas; tenis en dashboard raíz;
   e2e Playwright del dominio tenis; fatiga 2.0 si llegan minutos/fechas
   reales por partido.

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

# Flujo de entrega
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
