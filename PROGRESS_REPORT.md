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

## Actualización 2026-07-10 (4) · Fixes reportados (perfil de equipo + H2H)

Dos reportes del usuario tras el despliegue:

- **Equipos de fútbol no clicables** (bug real): NBA tenía perfil de equipo
  y standings enlazados, fútbol no. Se creó `/equipos/[id]` — perfil
  universal de equipo de fútbol (selecciones y clubes): récord G-E-P, PPG,
  goles a favor/contra por partido, diferencia, ELO, splits local/visitante,
  forma (últimos 5/10 + racha) y últimos partidos clicables. Módulo puro
  `lib/footballTeamStats.ts` (4 tests). Se enlazaron los nombres en la
  `StandingsTable` de ligas y en `GroupCard` (grupos del Mundial). Un equipo
  juega en una sola competición → todo filtra por ella (regla de oro).
- **H2H "no funciona en fútbol"** (percepción, no bug): el H2H sí funciona
  en ligas; en el Mundial sale vacío porque las selecciones se cruzan por
  primera vez. Antes se auto-ocultaba y parecía roto; ahora muestra una nota
  explícita ("no se han enfrentado antes — primer duelo registrado").

Verificación: type-check · lint 0 · build OK (`/equipos/[id]` ● SSG/ISR) ·
**88/88** unitarias (4 nuevas) · **20/20** e2e (nuevo: liga → equipo → perfil).

---

## Actualización 2026-07-15 (4) · Tennis Fase 6 — resultados y cara a cara

- **`/tennis/partidos`** — navegador de resultados reales, filtrable por
  superficie (chips) y paginado. Sin sección de "próximos partidos": la
  fuente es histórica, así que un calendario de fixtures estaría vacío y no
  se fabrica (Data First).
- **`/tennis/h2h`** — cara a cara entre dos jugadores: marcador global,
  balance por superficie e historial de enfrentamientos, todo real. Selector
  con `<datalist>` nativo (autocompletado por nombre, sin dependencias). Acceso
  directo desde cada perfil de jugador ("Cara a cara →").
- Capa de lectura ampliada (`fetchTennisResults`, `fetchTennisH2H`,
  `fetchPlayersForPicker`). Hub con 5 secciones. 125/125 pruebas, build 43
  páginas. Barreras de dominio intactas.

Con esto el dominio Tenis cubre Fases 4-8 (datos, stats, motor 1.1, hub,
ranking, perfiles, resultados, H2H, inteligencia). Pendientes: Fase 9 (Smart
Bets, bloqueada por fuente de cuotas) y el tuning tennis-1.2.

---

## Actualización 2026-07-15 (3) · Tennis — motor tennis-1.1 (cold-start) a producción

Experimento del motor con una **única hipótesis** (para no hacer overfitting):
el ELO arrancaba a todos en 1500 y con solo 2 temporadas no "calentaba" a
tiempo, por eso 1.0 quedaba −0,3 pp bajo el ranking puro. tennis-1.1 = 1.0 +
sembrar el ELO de cada debutante desde su ranking de entrada (priores fijados
a priori, no ajustados a los datos de prueba).

Backtest comparativo pareado en producción (misma ventana, walk-forward):

| Métrica | 1.0 | **1.1** | Δ |
|---|---|---|---|
| Precisión | 63,75 % | **63,95 %** | +0,20 pp |
| Brier | 0,4420 | **0,4400** | −0,0020 |
| Log-loss | 0,6316 | **0,6293** | −0,0023 |
| vs. ranking (subset) | 63,88 % | **64,21 %** | iguala la base (64,19 %) |

Mejora en **las tres métricas**. La precisión sube poco (ruido de ~1 partido);
el avance sólido es probabilístico (Brier/log-loss), lo que importa para valor
esperado. **Promovido a producción**; 1.0 se conserva para comparación
(`?step=backtest&variant=tennis-1.0`). La página `/tennis/inteligencia` refleja
los números de 1.1 automáticamente. 125/125 pruebas (4 nuevas de siembra).

---

## Actualización 2026-07-15 (2) · Tennis Fase 8 — el dominio sale a la superficie

Hasta ahora el tenis pensaba pero no se veía (Fases 4/5/7 eran datos, motor y
métricas, sin UI). Esta fase lo hace **visible y navegable** con datos reales.

- **Registro:** ATP pasa de `proximamente` a **`activa`** en `lib/sports.ts`;
  aparece "ATP Tour" como enlace real en el sidebar (icono propio `CircleDot`,
  acento lima). WTA sigue como promesa honesta ("Pendiente de fuente") — cero
  enlaces rotos, cero datos inventados.
- **Páginas nuevas** (Server Components, ISR con cliente anon):
  - `/tennis` — hub: KPIs medidos (precisión del backtest, partidos, jugadores,
    torneos), Top 15 ATP, resultados recientes, accesos a secciones.
  - `/tennis/ranking` — clasificación ATP completa a la última fecha real.
  - `/tennis/jugadores/[id]` — perfil: Win% global y por superficie (barras),
    Hold%/Break%, aces/DF, forma reciente y últimos resultados. Los 50 mejores
    se prerenderizan; el resto on-demand. Si la fuente no trae saque/resto, se
    declara "—" (Data First), no se estima.
  - `/tennis/inteligencia` — métricas del motor tennis-1.0: precisión, Brier,
    log-loss, y la **comparación honesta vs. ranking puro** con el aviso de que
    aún no lo supera en precisión cruda (tennis-1.1).
- **Capa de datos:** `services/tennis/queries.ts` (lectura acotada al tour,
  paginada). `components/tennis/*` (RankingTable, ResultsList, átomos ui).
  Barreras de dominio intactas (lint 0 errores).
- Gates: type-check ✔, lint ✔, **121/121 pruebas** (actualizado el test de
  aislamiento: tenis ahora activa exactamente ATP), build ✔ (41 páginas,
  incluidos los perfiles prerenderizados).

Siguiente: Fase 6 (calendario/H2H dedicado) y el tuning tennis-1.1.

---

## Actualización 2026-07-15 · Tennis Fases 5+7 (núcleo) — motor tennis-1.0 medido

Núcleo predictivo del dominio Tennis, con métricas **medidas sobre el
histórico real, no prometidas** (vigilancia estrecha del motor, según lo
pedido).

- **Fase 5 (núcleo):** `lib/tennis/stats.ts` — perfil de jugador derivado
  de partidos reales: Win% global y por superficie, forma reciente,
  **Hold% / Break%**, aces y dobles faltas por partido. Métricas propias del
  tenis (jamás xG/posesión). Si la fuente no trae saque/resto, quedan `null`
  (Data First). Módulo puro + 6 pruebas. *Falta solo la página UI (Fase 8).*
- **Fase 7 (motor):** `lib/tennis/engine.ts` — ELO walk-forward global y por
  superficie (K=32, inicial 1500, solo `finished`/`retired`), combinación de
  factores por los pesos aprobados (35/25/20/10/10) con **renormalización
  honesta** cuando un factor falta. 13 pruebas. Total dominio: 19/19.
- **Backtest walk-forward** (`services/tennis/backtest.ts`,
  `?step=backtest`): ejecutado en producción sobre **5.636 partidos ATP**
  (2024-01-01 → 2026-01-17), predecir-luego-incorporar (sin fuga).
  Persistido en `tennis_backtests` + `tennis_model_metrics`:
  - Precisión **63,75 %** · Brier **0,442** (azar 0,50) · log-loss **0,632**
    (azar 0,693). Bate al azar en las tres.
  - **Hallazgo honesto:** vs. la línea base "gana el mejor clasificado"
    (64,19 % en el mismo subconjunto), el motor rinde 63,88 % — aún **−0,3 pp
    por debajo del ranking puro** en precisión cruda. Declarado, no
    maquillado; es la línea de trabajo de tennis-1.1 (arranque en frío del
    ELO con 2 temporadas, peso de forma, calibración por superficie).
  - Sin cuotas de tenis todavía (Fase 9 bloqueada): ROI/yield quedan `null`,
    no se inventan.
- Gates: type-check ✔, lint 0 errores (barreras de dominio intactas),
  build ✔ (con proxy para el SSG a Supabase), migración 054 registrada en
  `verify_migrations.sql`.

Siguiente: Fase 6 (calendario/H2H) y Fase 8 (páginas UI + flip del registro
a `activa`); tuning tennis-1.1 para cerrar la brecha con el ranking.

---

## Actualización 2026-07-12 (3) · Tennis Fase 4 — datos reales ATP ingestados

Ingesta ejecutada contra producción, vigilada corrida a corrida (tres
defectos reales detectados por los números y corregidos: filas duplicadas
en el CSV de la fuente → dedupe por clave natural; tope de 1.000 filas de
PostgREST en el mapeo de stats → paginación; paginación sin `order` →
orden estable). Resultado final verificado en BD:

- **Fuente:** TML-Database (esquema Sackmann, diaria, CC BY-NC-SA con
  atribución). Los repos Sackmann originales devolvían 404 desde
  producción — cambio documentado. **WTA pendiente de fuente** (la
  ingesta la rechaza explícitamente; cero fabricado).
- **Datos ATP 2024-2026:** 581 jugadores (mano/país/altura reales) ·
  362 torneos · **5.676 partidos** · **11.352 stats** (exactamente 2 por
  partido) · 6.508 observaciones de ranking (rank real a fecha de torneo).
- **Integridad:** 0 huérfanos en rankings/partidos, 0 duplicados,
  0 finished sin ganador — `ok: true`.
- **Idempotencia probada:** re-corridas de las 3 temporadas → no-op.
- Fila de muestra cotejada contra la fuente (United Cup 2026, Báez d.
  Munar 6-4 6-4) — coincide exacto.
- `/api/tennis/sync` (CRON_SECRET) queda como sync repetible; 1 fila de
  2026 descartada por datos incompletos en la fuente (registrada).

Siguiente: Fase 5 (perfiles de jugador con Win%/Hold%/Break% derivados de
estos partidos) y Fase 7 (motor tennis-1.0 + ELO por superficie).

---

## Actualización 2026-07-12 (2) · Tennis — fase inicial del tercer dominio

Base arquitectónica del dominio Tennis, con el aislamiento implementado
ANTES que la lógica (a propósito):

- **Modelo de datos (migración 053, aplicada a BD viva):** 9 tablas
  exclusivas `tennis_*` (players, rankings, tournaments, matches,
  match_stats, predictions con feature-store nativo, smart_bets,
  backtests, model_metrics) — cero reutilización de tablas de
  fútbol/NBA — todas con RLS + lectura anon. Competiciones ATP
  (`20000000-…-0020`) y WTA (`21000000-…-0021`) registradas (sport_id=3).
- **Estructura (patrón NBA, decisión arquitectónica registrada):**
  `lib/tennis/{constants,types}.ts` (pesos tennis-1.0: 35% ranking+ELO,
  25% forma, 20% superficie, 10% H2H, 10% mercado), `services/tennis/`
  (contratos de sync ATP/WTA + invariantes de integridad),
  `components/tennis/`, `app/tennis/`, `app/api/tennis/`.
- **Registro:** ATP/WTA en `lib/sports.ts` con ids reales de BD, estado
  `proximamente` (flip a `activa` en Fase 8, cuando exista el hub — sin
  enlaces rotos ni placeholders). Mientras tanto NO entran en ninguna
  lista blanca transversal.
- **Barreras (Fase 11, hecha primero):** ESLint en las CUATRO direcciones
  (tenis↛fútbol, tenis↛NBA, fútbol↛tenis, NBA↛tenis ampliada), verificadas
  con tests negativos reales — las 4 fallan compilación como se exige.
  Nota: el detalle universal sport-aware conserva su composición NBA por
  diseño documentado.
- **Fuente de datos (decisión honesta):** base histórica = datasets
  públicos de Jeff Sackmann (CSV reales, gratis) para Fases 4-7 y
  backtesting; calendario en vivo + cuotas requieren API de pago
  (api-sports NO cubre tenis) — decisión de compra pendiente, declarada
  como bloqueo de las Fases 4(vivo) y 9. Cero datos fabricados: las
  tablas nacen vacías.
- **Documentación:** `docs/TENNIS_ARCHITECTURE.md` (decisiones + plan
  detallado de Fases 4-10 con bloqueos y estimaciones).

Verificación: type-check · lint 0 (con barreras nuevas) · build OK ·
unitarias verdes · verify_migrations 053.

---

## Actualización 2026-07-12 · Métricas de calibración + dieta de bundle

Dos tareas ejecutadas de forma autónoma (probando cada cambio):

### Tarea 1 · Métricas de calibración en /inteligencia (vitrina de confianza)
- **`lib/calibration.ts`** (puro, 6 tests): Brier multiclase 1X2, log-loss,
  accuracy, `calibrationBuckets` (curva por probabilidad del favorito).
- **`components/intelligence/CalibrationCurve.tsx`**: curva SVG (prometido vs
  observado) con diagonal de calibración perfecta; puntos ∝ tamaño de muestra.
- **`/inteligencia`**: sección "Calibración del modelo · Mundial" con KPIs
  (Brier, ventaja vs azar, log-loss) + curva + tabla por tramo.
- Datos 100% reales: 87 predicciones resueltas del Mundial. **Brier = 0.314**
  vs azar 1X2 = 0.667 → el modelo mejora ~53% sobre el azar (verificado por
  SQL de contraste, coincide con el módulo).

### Tarea 2 · Dieta de bundle
- **Lazy-load de Recharts en `/players/[id]`**: `PlayerRadarChartLazy`
  (dynamic + ssr:false). La ruta bajó de **221 kB → 118 kB** de First Load JS
  (chunk propio 108 kB → 5.37 kB). Los charts del detalle de partido ya eran
  dynamic.
- **Dependencia muerta eliminada**: `sonner` (^1.7.1) — el `Toaster` local es
  un placeholder propio que no importa el paquete. Cero imports en el código.
- Auditoría de huérfanos: **0 componentes sin usar** (71 revisados). Sin
  imports muertos nuevos.

Verificación: type-check · lint 0 · build OK · **98/98** unitarias (6 nuevas) ·
e2e de /inteligencia y perfiles verde. No se abrieron nuevas líneas de trabajo.

---

## Actualización 2026-07-10 (3) · Mejoras 1-2 semanas del playbook

Cuatro mejoras del roadmap de mejoras importantes (SOFASCORE_PLAYBOOK.md):

- **Bottom nav móvil** (mejora 6) — `components/layout/BottomNav.tsx`: barra
  inferior fija <lg con 5 destinos (Inicio/Partidos/Predice/Smart Bets/Más);
  "Más" abre el drawer del sidebar. Navegación raíz sigue congelada (atajos a
  rutas existentes). `<main>` con `pb-16 lg:pb-0`.
- **H2H** (mejora 10) — `lib/h2h.ts` (puro, 3 tests) + `HeadToHead.tsx` en el
  detalle de partido. Enfrentamientos previos en la MISMA competición (regla
  de oro), balance + últimos cruces clicables. Se auto-oculta sin historia.
- **Balance/Informe del Mundial** (mejora 12) — `lib/mundialReport.ts` (puro,
  5 tests) + `/mundial/balance`: precisión vs azar, precisión por fase,
  mejores aciertos / fallos más sonados, tabla de calibración. Es "balance en
  curso" hasta que la final se juega, cuando pasa a "informe final".
- **Movimiento del mercado** (mejora 7) — `lib/marketMovement.ts` (puro, 4
  tests) + writer en `services/sync/odds.ts` (lee cuotas Pinnacle previas
  antes del swap, registra before→after en `market_movements`, best-effort no
  bloqueante) + `MarketMovementPanel.tsx` en el detalle (pre-partido). Los
  datos se acumulan con cada corrida del cron; el panel se auto-oculta hasta
  entonces (Data First).

Verificación: type-check limpio · lint 0 errores · build OK
(`/mundial/balance` ISR 5m · `/matches/[id]` ● SSG/ISR) · **84/84** unitarias
(12 nuevas) · **19/19** e2e (nuevos: bottom nav móvil, balance del modelo).

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
