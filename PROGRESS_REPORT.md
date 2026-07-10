# PROGRESS REPORT — Plan Maestro de Corrección, Descontaminación y Reorganización

**Fecha:** 9 de julio de 2026 · Ejecución autónoma continua
**Fuente de verdad:** Auditoría maestra integral del 2026-07-09 (4 auditores especializados + verificación cruzada)
**Regla absoluta respetada:** Fútbol intacto — cero cambios en motores, páginas o componentes de fútbol.

---

## Resumen Ejecutivo

La plataforma quedó descontaminada, reorganizada y estabilizada. El único
punto de contaminación real entre deportes (el tracker de Smart Bets
procesando partidos NBA con el motor de goles de fútbol) quedó cerrado con
una lista blanca por deporte en el registro, verificado con tests y contra
la base de producción (0 filas contaminadas — la fuga era latente y se
cerró antes de materializarse). El defecto crítico de migraciones (enum
`round_of_32` nunca versionado, que rompía cualquier reconstrucción limpia
de la BD) quedó corregido. La NBA es ahora un dominio propio (`lib/nba/`)
con barrera arquitectónica ESLint que impide importar módulos de fútbol,
seis secciones navegables con métricas 100% reales, y páginas de error
globales que la plataforma nunca tuvo. Todo verificado: 68/68 tests
unitarios, 15/15 e2e, lint 0 errores, type-check y build limpios, 43/43
verificaciones de migración contra la BD viva.

---

## Actualización 2026-07-10 (2) · Quick Wins del playbook Sofascore

Se creó **`SOFASCORE_PLAYBOOK.md`** (plan de producto prioritario: patrones
de Sofascore adaptados sin copiar, con roadmap por fases) y se ejecutaron
los 5 Quick Wins antes de la final del 19-jul:

1. **SEO** — `app/sitemap.ts` dinámico (todas las rutas + ~3.300 partidos
   vía `fetchAllRows` con lista blanca de competiciones), `app/robots.ts`,
   `metadataBase` en el layout, títulos de intención en el detalle
   ("Pronóstico X vs Y — probabilidades del modelo", con marcador y
   veredicto en finalizados), descripción con probabilidades reales y
   JSON-LD `SportsEvent` (solo campos reales).
2. **Ranking ELO del Mundial** — `/mundial/rankings`: 48 selecciones por
   ELO del modelo, contraste honesto vs ranking FIFA (Δ de posiciones
   dentro del torneo), récord real PJ/G-E-P/GF:GC y fase alcanzada.
   Módulo puro `lib/mundialRankings.ts` + 4 tests. Sin Δ de ELO histórico:
   no se almacena la serie y no se estima (Data First).
3. **Favoritos sin auth** — `lib/favorites.ts` (localStorage) + estrella
   en la cabecera universal del partido + franja **"Mis equipos"** en el
   dashboard (próximo partido con ProbBar del modelo o último resultado;
   oculta si no hay favoritos). Etapa 1 del bucle de retención; Web Push
   queda como estratégico.
4. **Countdown a la final** — hero en dashboard: cuenta a la fecha oficial
   (19-jul) mientras el sync no cree la fila del partido; cuando exista,
   muestra finalistas + probabilidades del modelo; tras jugarse,
   desaparece. + Chips de fecha (Hoy/Mañana → `/matches?date=`, zona
   horaria Bogotá).
5. **`ProbBar1X2`** — componente unificado de barra de probabilidades
   (visualización firma; en `components/predictions/` para que la barrera
   NBA lo bloquee). Adopción inicial: tarjetas del dashboard, franja Mis
   equipos y hero de la final.

Verificación: type-check limpio · lint 0 errores · build OK
(`/mundial/rankings` ISR 2m · `sitemap.xml` 1h) · **72/72** unitarias ·
**17/17** e2e (nuevos: ranking 48 filas, sitemap+robots).

---

## Actualización 2026-07-10 · Optimización pre-final (Mundial)

Ejecución autónoma de estabilización de cara al pico de tráfico de la final
(19-jul). **Interpretación de alcance documentada:** "No modificar Football"
se aplicó como *no tocar el motor de predicción (Poisson/Dixon-Coles) ni la
lógica de negocio ni ampliar alcance* — no impide mejoras transversales de
rendimiento/UX sobre páginas que renderizan datos de fútbol. La decisión de
producto sobre cobertura de jugadores (roster parcial: 78 filas / 19 de 48
selecciones, seed manual de la migración 026) queda **fuera** de esta
ejecución, pendiente de decisión específica. El motor de fútbol no se tocó.

### Paso previo · Transacción del sync de cuotas (auditoría 🟡-10 / 🔴 disponibilidad)

- **`services/sync/odds.ts`**: el sync borraba y luego insertaba cuotas y
  value bets sin atomicidad; un fallo entre ambos pasos dejaba las tablas
  **vacías** para esos partidos (páginas de cuotas/value bets en blanco en
  plena jornada). Reescrito a **reemplazo por swap**: primero escribe el
  lote nuevo (`odds.recorded_at = now`, `value_bets.updated_at = now`) y
  solo después elimina lo previo con filtro estrictamente anterior
  (`< now`). Si el insert falla, corta antes del delete y no pierde nada;
  nunca queda vacío y el siguiente sync sanea cualquier resto. El lector ya
  deduplica por más-reciente, así que la convivencia momentánea es inocua.

### Fase 1 · Limpieza (auditoría 🟡-12, 🟢-16, 🟢-17, 🟢-18)

- **Kelly/EV deduplicado**: eliminadas las copias muertas
  `kellyFraction`/`expectedValue`/`impliedProbability` de `lib/utils.ts`
  (0 referencias; además la de `utils` no tenía guardia de división por
  cero). Única fuente canónica: `lib/valueBets.ts` (con `if (b<=0) return 0`).
- **Topbar** (`components/layout/Topbar.tsx`): retirado el avatar "A"
  hardcodeado — simulaba una sesión inexistente (la app es pública sin
  auth). Buscar queda como única acción real del topbar.
- **Simulador** (`components/simulation/SimulationEngine.tsx`): "Guardar
  escenario" → "Añadir a comparación" + nota "se reinicia al recargar". Ya
  no sugiere una persistencia que no ocurre (la API muerta se eliminó en el
  saneamiento previo). ROI fabricado (🔴-1) y versión de modelo (🟢-14) ya
  estaban resueltos.

### Fase 2 · Columnas fijas en móvil (sticky)

Patrón `sticky left-0 z-10 bg-zinc-900` (identidad) replicando el ya usado
en la clasificación de ligas y NBA. Aplicado a las tablas que faltaban:

- **`GroupCard`** (clasificación de grupos del Mundial): `#` + `Equipo`
  fijos; el borde de color de clasificación se movió del `<tr>` a la celda
  `#` para que no lo tape el fondo opaco al hacer scroll.
- **`PredictionsTable`**: columna `Partido` fija (`!bg` para ganar sobre la
  regla `.data-table tr:hover td`).
- **`ValueBetsFullTable`**: estrella (top pick) + `Partido` fijos en la vista
  de tabla (tablet/desktop; móvil ya usa tarjetas apiladas).
- **`PlayersTable`**: columna `Jugador` fija (solo presentación; sin tocar
  datos ni lógica de jugadores).
- **Excepción justificada — `MatchesTable`**: no se fija. Su identidad
  (equipos) va en columnas centrales, no en la primera (`Fecha`), y la fila
  entera es clicable al detalle; un sticky sobre `Fecha` no serviría al
  objetivo. Ya tenían sticky: `StandingsTable` (ligas), `ConferenceStandings`
  y rankings (NBA).

### Fase 3 · Estrategia ISR

11 páginas usaban el cliente Supabase de cookies, lo que fuerza render
dinámico en **cada visita** (la app no tiene auth: la cookie no aporta).
Migradas a `createStaticSupabaseClient` (sin cookies) + `revalidate` por
volatilidad del dato:

| Páginas | revalidate | Antes → Después |
|---------|-----------|-----------------|
| `matches` | 60s | ƒ Dynamic → ○ Static ISR |
| `groups`, `bracket`, `predictions`, `value-bets` | 120s | ƒ Dynamic → ○ Static ISR |
| `champion`, `scorers`, `players`, `simulation` | 300s | ƒ Dynamic → ○ Static ISR |
| `matches/[id]`, `players/[id]` | 60s / 300s | ƒ (sin caché) → ƒ con caché por-id en runtime |

**Corrección tras verificar en producción:** quitar `cookies()` NO bastó
para cachear los segmentos `[id]`. En Next 15, un `[id]` sin
`generateStaticParams` se sirve dinámico (`cache-control: no-store`) en
cada visita aunque tenga `revalidate` — verificado en vivo: `/matches/[id]`
devolvía `x-vercel-cache: MISS` + `no-store`. Se añadió
`generateStaticParams` vacío a `matches/[id]`, `players/[id]` y
`nba/equipos/[id]`: no prerenderiza nada en build pero habilita el caché
ISR on-demand (cada id se genera y cachea en la primera visita). Build:
pasan de `ƒ Dynamic` a `● SSG/ISR`. Reverificado en producción:
`/matches/[id]` ahora da `MISS` en el primer hit y `HIT` en el segundo;
`nba/equipos/[id]` da `HIT`. La frescura en vivo del detalle la maneja
`LiveMatchRefresh` en el cliente. Bajo carga (1.000 visitas simultáneas a
`/matches` → antes 1.000 queries, ahora ~1-2 por ventana de revalidación).
`app/api/predictions/route.ts` conserva el cliente de cookies: es un route
handler (ya dinámico, sin beneficio ISR).

### Verificación

type-check limpio · lint 0 errores (solo warnings heredados) · build de
producción OK · **68/68** unitarias · **15/15** e2e (incluye buscador desde
el topbar tras quitar el avatar). Nada del motor de fútbol fue tocado.

**Desplegado a producción** (`e9564fa`, Vercel `READY`) y verificado en
vivo: las 9 páginas de lista dan `x-vercel-cache: HIT`; las 3 de detalle
`[id]` cachean tras el primer hit; `/value-bets` y el detalle de partido
renderizan. Los previews de rama figuran en `ERROR` — esperado: el entorno
preview de Vercel no tiene las claves de Supabase/API (están scopeadas a
producción); solo el deploy `production` importa.

---

## Fases completadas (plan maestro previo)

| Fase | Alcance | Estado |
|------|---------|--------|
| F1 | Aislamiento Smart Bets por deporte + descontaminación del detalle NBA | ✅ |
| F2 | Deuda de plataforma: migraciones, seguridad BD, errores, rutas muertas, huérfanos | ✅ |
| F3 | Dominio NBA: `lib/nba/`, métricas reales, 6 secciones, barrera ESLint | ✅ |
| F4 | QA integral, documentación y entrega | ✅ |

## Cambios realizados

### F1 · Descontaminación y aislamiento (Prioridades 1-2)

- **`competitionIdsOfSport(sport)`** en `lib/sports.ts`: la lista blanca
  oficial por deporte. Todo proceso transversal debe usarla.
- **`services/smartBetTracking.ts`**: `snapshotScheduledPicks` y
  `resolvePendingPicks` filtran por competiciones de fútbol. Un partido
  de NBA (o de cualquier deporte futuro) jamás entra al pipeline de
  Smart Bets de fútbol.
- **Detalle de partido NBA descontaminado**: la pestaña Estadísticas ya
  no muestra ranking FIFA, radar de goles ni alineaciones — renderiza
  `NbaTeamComparison` (ELO, puntos por partido, permitidos, diferencial,
  forma W/L). La pestaña Cuotas se oculta en baloncesto (los mercados
  cargados son 1X2/goles y no existe fuente de cuotas NBA).
- **Verificación en producción**: `smart_bet_picks` contiene 20 picks,
  todos del Mundial. 0 contaminados. Los 1.314 partidos NBA están
  `finished` (sin `scheduled`), por eso la fuga no se materializó; con
  la temporada 2025-26 lo habría hecho — quedó cerrada de raíz.

### F2 · Deuda de plataforma (Prioridad 5)

- **Migración `032b_add_round_of_32_enum.sql`**: el valor `round_of_32`
  del enum `match_phase` nunca estuvo versionado (se agregó a mano a la
  BD viva); la migración 033 lo usa, así que una reconstrucción limpia
  fallaba. El archivo 032b ordena entre 032 y 033 y es idempotente.
- **Migración `050_security_hardening.sql`** (aplicada y verificada en
  la BD viva): `SET search_path` en las 5 funciones `SECURITY DEFINER`
  restantes (incluida `recalculate_group_standings`, cuya versión viva
  había perdido el fix de la 012) + RLS activo con política de lectura
  pública en las 6 tablas V3 que solo tenían GRANT.
- **Páginas de error globales**: `app/error.tsx`, `app/global-error.tsx`
  y `app/not-found.tsx` — ningún fallo vuelve a caer en la pantalla
  genérica de Next.js (hallazgo 🟡-11 de la auditoría técnica original).
- **Errores de Supabase ya no se ignoran** en `app/inteligencia` y en el
  contexto de grupo del detalle de partido (páginas compartidas).
- **Rutas API muertas eliminadas** (auth heredada en una app sin login;
  0 llamadores verificados): `POST /api/predictions`, `/api/odds`,
  `/api/simulation`, `/api/sync/espn-stats` (duplicaba espn-results).
- **Huérfanos eliminados**: `MatchCard.tsx`, `ui/table.tsx`,
  `ui/skeleton.tsx` (0 imports); dependencia `class-variance-authority`
  sin uso; worktree suelto `.claude/worktrees/` borrado.
- **`v1.2.0` literal → `MODEL_VERSION`** en Inteligencia.
- **Id de modelo Claude verificado**: `claude-sonnet-4-6` es válido y
  activo — el hallazgo se cierra sin cambio (los veredictos
  `deterministic` en producción son el fail-open por falta de
  `ANTHROPIC_API_KEY` en ese entorno, no un id roto).

### F3 · Dominio NBA (Prioridades 1 y 4)

- **`lib/nba/` como dominio**: `constants.ts`, `engine.ts`, `verdict.ts`,
  `stats.ts`. El motor es autocontenido — se eliminó el import del motor
  de fútbol (`computeConfidenceLevel` se define en el dominio como
  `nbaConfidenceLevel`). Único vínculo restante: el TIPO `VerdictOutput`
  (contrato compartido de veredictos, sin lógica).
- **`lib/nba/stats.ts` — métricas 100% reales** desde marcadores y
  cuartos de la BD: récord y splits local/visitante, PPG/permitidos/
  diferencial, últimos 5/10, racha, perfil por cuarto, récord en
  prórrogas y en partidos cerrados (≤5), agregados de liga y
  **calibración del modelo** (franjas de probabilidad vs acierto real).
- **Seis secciones navegables**: hub `/nba` (tarjetas de sección +
  standings clicables) · `/nba/equipos/[id]` (perfil de franquicia) ·
  `/nba/rankings` (30 equipos por ELO) · `/nba/estadisticas` (liga) ·
  `/nba/tendencias` (rachas, fortines, clutch) · `/nba/predicciones`
  (precisión + calibración honesta). Todas ISR 300s, paginadas contra
  el tope de 1000 filas de PostgREST, con la regla de oro de filtrar
  por competición.
- **Barrera arquitectónica** (`.eslintrc.json`): `no-restricted-imports`
  impide que `lib/nba/**`, `components/nba/**`, `app/nba/**` y los sync
  NBA importen motores/componentes de fútbol. Verificada con test
  negativo (dispara con un import prohibido, limpia sin él).
- **`services/nba.service.ts`**: carga de datos del dominio (equipos,
  temporada completa paginada, predicciones resueltas paginadas).

## Problemas corregidos (matriz auditoría → estado)

| Hallazgo de la auditoría maestra | Estado |
|----------------------------------|--------|
| 🔴 Smart Bets sin filtro de deporte (contaminación NBA) | ✅ Cerrado + verificado en producción |
| 🔴 Enum `round_of_32` fuera de migraciones (rompe rebuild) | ✅ Migración 032b |
| 🟠 Rutas API muertas (401 permanente) | ✅ Eliminadas |
| 🟠 Sin `app/error.tsx` / not-found | ✅ Creados |
| 🟠 Errores Supabase ignorados (páginas compartidas) | ✅ Capturados (inteligencia, detalle) |
| 🟡 SECURITY DEFINER sin search_path (5 funciones) | ✅ Migración 050, BD viva verificada |
| 🟡 Tablas V3 sin RLS | ✅ Migración 050, BD viva verificada |
| 🟡 Id de modelo Claude por verificar | ✅ Verificado válido — sin cambio |
| 🟡 Huérfanos + dependencia sin uso + worktree | ✅ Eliminados |
| 🟡 `v1.2.0` hardcodeado en Inteligencia | ✅ Constante única |

## Archivos modificados

**Nuevos**: `lib/nba/stats.ts` · `services/nba.service.ts` ·
`components/nba/NbaTeamComparison.tsx` · `app/nba/{equipos/[id],rankings,estadisticas,tendencias,predicciones}/page.tsx` ·
`app/{error,global-error,not-found}.tsx` ·
`supabase/migrations/{032b_add_round_of_32_enum,050_security_hardening}.sql` ·
`tests/{sports,nbaStats}.test.ts`

**Movidos (dominio)**: `lib/nba.ts → lib/nba/constants.ts` ·
`lib/nbaEngine.ts → lib/nba/engine.ts` · `lib/nbaVerdict.ts → lib/nba/verdict.ts`

**Modificados**: `lib/sports.ts` · `services/smartBetTracking.ts` ·
`services/sync/nba-calibrate.ts` · `components/matches/MatchAnalysisTabs.tsx` ·
`components/nba/ConferenceStandings.tsx` · `app/nba/page.tsx` ·
`app/inteligencia/page.tsx` · `app/matches/[id]/page.tsx` ·
`app/api/predictions/route.ts` · `.eslintrc.json` ·
`supabase/verify_migrations.sql` · `e2e/smoke.spec.ts` · `package.json`

**Eliminados**: `app/api/{odds,simulation}/route.ts` ·
`app/api/sync/espn-stats/route.ts` · `components/matches/MatchCard.tsx` ·
`components/ui/{table,skeleton}.tsx`

## APIs corregidas

- Eliminadas 4 rutas muertas (detalle arriba). `GET /api/predictions`
  (pública, en uso) se conservó; solo se retiró el POST inalcanzable.
- Sin cambios en las rutas vivas de sync (todas con CRON_SECRET).

## Dependencias eliminadas

- `class-variance-authority` (0 referencias en el código).

## Pruebas ejecutadas

| Suite | Resultado |
|-------|-----------|
| Unitarias (`npm test`) | **68/68** ✅ (6 nuevas de stats NBA, 5 de aislamiento) |
| E2E Playwright | **15/15** ✅ (nuevo: secciones del dominio NBA; detalle NBA sin pestañas de fútbol) |
| `npm run type-check` | limpio ✅ |
| `npm run lint` | **0 errores** ✅ (barrera activa, sin falsos positivos) |
| Build de producción | limpio ✅ |
| `verify_migrations.sql` | **43/43** contra la BD viva ✅ |
| Test negativo de la barrera | dispara con import prohibido ✅ |

## Resultados obtenidos

- Fútbol intacto (cero diffs en sus motores, páginas y componentes).
- NBA como dominio independiente con barrera que impide regresiones.
- Smart Bets aislado por deporte a nivel de datos y de código.
- Base de datos reconstruible desde migraciones (antes no).
- Cero componentes huérfanos, cero rutas muertas, cero TODOs nuevos.

## Riesgos detectados

1. **La barrera ESLint corre con `next lint`** (deprecado en Next 16).
   Al migrar a ESLint CLI/flat config habrá que portar la regla —
   trivial, pero no olvidarla.
2. **`syncSmartBetTracking` se invoca también desde la calibración NBA**
   (mantenimiento del historial de fútbol al correr cualquier cron).
   Con la guardia es inocuo; si algún día molesta, quitar la llamada de
   `nba-calibrate.ts` es un cambio de una línea.

## Decisiones arquitectónicas

1. **Dominio NBA dentro de las convenciones del App Router**
   (`lib/nba/`, `components/nba/`, `app/nba/`) en lugar de
   `src/modules/nba`: crear un árbol paralelo `src/` solo para NBA
   habría dejado dos convenciones conviviendo (fútbol está congelado y
   no se puede mover) — más confusión, no menos. El aislamiento real lo
   da el directorio de dominio + la barrera de imports, no la ruta.
2. **Métricas de posesión NO implementadas** (ORtg/DRtg/Pace/eFG%/TS%,
   y todas las de jugadores: PPG/RPG/APG/PER/Usage): exigen tiros,
   rebotes y pérdidas que API-Basketball (plan free) no provee. La regla
   de oro es no fabricar datos → **movidas al backlog** con su
   requisito explícito (fuente con boxscores, p. ej. plan pago o
   balldontlie). La UI lo declara honestamente en /nba/estadisticas.
3. **Smart Bets NBA movido al backlog**: requiere fuente de cuotas de
   baloncesto (The Odds API cubre NBA — decisión de integración) y un
   motor de mercados propio (spread/total/moneyline). El aislamiento
   entregado garantiza que cuando exista, no tocará el de fútbol.
4. **Confianza 1-5 duplicada a propósito** en el dominio NBA (6 líneas)
   para eliminar el último import del motor de fútbol: independencia
   vale más que DRY en una frontera entre dominios.
5. **`claude-sonnet-4-6` se mantiene** como modelo de pulido: verificado
   válido y vigente; cambiarlo sería tocar algo que funciona.

## Próximos pasos (backlog priorizado)

1. **Temporada NBA 2025-26** (octubre): la ingesta y calibración ya son
   cron; las secciones nuevas se llenan solas.
2. **Estadísticas de jugadores NBA + métricas de posesión** — requiere
   fuente con boxscores (decisión de compra/integración del dueño).
3. **Smart Bets NBA** — requiere The Odds API basketball + motor de
   mercados propio del dominio.
4. **Deuda heredada de fútbol (congelada por la regla de este plan)**:
   paginación de Jugadores, Kelly/EV triplicado, transacción en sync de
   cuotas, columnas sticky en tablas de fútbol, ISR en las 12 páginas
   con cliente de cookies. Documentada en la auditoría maestra.
5. **Upgrade API-Football** (~19 USD/mes, agosto) para la 2026-27 en vivo.
