# 📋 CONTEXTO DEL PROYECTO — Veredicto · Inteligencia Deportiva

> Documento maestro para continuar el desarrollo en Claude Code.
> Actualizado: 2026-07-10 (post Quick Wins del playbook Sofascore).

---

## 1. QUÉ ES ESTE PROYECTO

**Veredicto** (repo histórico: world-cup-predictor-2026) es una plataforma
web pública de análisis y predicción **multi-deporte**:

- **Mundial FIFA 2026** — probabilidades 1X2, marcadores exactos, value
  bets, grupos, eliminatorias, goleadores, simulador.
- **5 grandes ligas europeas** (Premier, La Liga, Serie A, Bundesliga,
  Ligue 1) — temporada 2024-25 completa, motor calibrado para la 2026-27.
- **NBA** — temporada 2024-25 completa (1.314 partidos con puntos por
  cuarto), hub con standings, calendario, perfiles de equipo, rankings,
  estadísticas de liga, tendencias y calibración del modelo.

**Motores** (uno por deporte, aislados):
- Fútbol: híbrido 5 factores (xG 40%, ELO 25%, forma 15%, mercado 10%,
  noticias 10%) sobre rejilla Poisson/Dixon-Coles. Fuente única:
  `lib/predictionEngine.ts`. Ligas: `lib/leagueEngine.ts` (liga-1.0).
- NBA: ELO sin empates, local +60 ELO, margen por diferencia de ELO.
  Dominio completo en `lib/nba/` (nba-1.0).

**Principios innegociables**: honestidad estadística (toda precisión con
su línea base: azar 33% fútbol / 50% baloncesto), Data First (cero datos
fabricados — si la fuente no lo da, no se publica), identidad de terminal
financiera oscura con esmeralda #10b981.

---

## 2. ARQUITECTURA MULTI-DEPORTE

- **`lib/sports.ts`** — registro único de deportes y competiciones. La
  navegación raíz NUNCA crece: crece el registro. Helpers:
  `sportOfCompetition(id)`, `competitionIdsOfSport(sport)` (lista blanca
  para procesos transversales — así se aisló Smart Bets).
- **Dominio NBA** — `lib/nba/{constants,engine,verdict,stats}.ts`,
  `components/nba/`, `app/nba/`, `services/nba.service.ts`. Una regla
  ESLint (`no-restricted-imports` en `.eslintrc.json`) impide importar
  motores/componentes de fútbol desde el dominio NBA.
- **Regla de oro**: toda query a `matches`/`teams`/`team_statistics`/
  `predictions` filtra por competición (directo o `matches!inner`).
- **Detalle universal** (`app/matches/[id]`): sport-aware — timeline de
  eventos y pestañas de análisis Poisson para fútbol; desglose por
  cuarto, panel moneyline y comparación NBA para baloncesto.

---

## 3. STACK

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router), Server Components + ISR |
| Lenguaje | TypeScript (types/database.ts generado del schema real) |
| Estilos | Tailwind CSS, tema oscuro fijo |
| Datos cliente | TanStack React Query (sin Supabase Realtime — retirado) |
| Backend/BD | Supabase (PostgreSQL + RLS; acceso libre, SIN auth) |
| IA | Claude `claude-sonnet-4-6` (pulido de veredictos/análisis, fail-open a determinista) |
| Deploy | Vercel + GitHub Actions (workflows de sync con CRON_SECRET) |

---

## 4. ESTADO ACTUAL (2026-07-09)

✅ Plataforma multi-deporte en producción — world-cup-predictor-2026-flax.vercel.app
✅ Mundial: motor v1.2.0, recalibración automática, bracket, veredictos
✅ Ligas: liga-1.0 walk-forward (1.512 partidos evaluados), /ligas
✅ NBA: nba-1.0 (65.9% acierto, Brier 0.428), 6 secciones, dominio aislado
✅ Smart Bets con historial público y aislamiento por deporte
✅ Saneamiento completo (ver PROGRESS_REPORT.md): migraciones
   reconstruibles (032b), hardening BD (050), páginas de error, cero
   rutas muertas, cero huérfanos
✅ Quick Wins Sofascore (SOFASCORE_PLAYBOOK.md): sitemap+robots+JSON-LD,
   ranking ELO Mundial, favoritos localStorage + "Mis equipos", countdown
   a la final, ProbBar1X2 (visualización firma)
✅ Calidad: 72 tests unitarios · 17 e2e · lint 0 · verify_migrations 43/43

⏳ BACKLOG: ver SOFASCORE_PLAYBOOK.md (mejoras 6-12 y estratégicas 13-17) ·
   temporada NBA 2025-26 (octubre, autollenado por cron) · stats de
   jugadores NBA y métricas de posesión (requiere fuente con boxscores) ·
   Smart Bets NBA (requiere cuotas de baloncesto) · upgrade API-Football
   (~19 USD/mes, agosto) · cobertura de jugadores del Mundial (78 filas /
   19 de 48 selecciones, decisión de producto pendiente)

---

## 5. ACCESOS

- **Repo:** https://github.com/sepulvedayeison98-sys/world-cup-predictor-2026 (main)
- **Supabase:** proyecto `jruanwjjsygcmmvwxexh` (claves solo en
  Vercel/Supabase/env — NUNCA en el código ni en chat)
- **IDs clave:** Mundial `a1b2c3d4-e5f6-7890-abcd-ef1234567890` · NBA
  `12000000-0000-4000-8000-000000000012` · ligas en `lib/constants.ts`

---

## 6. ESTRUCTURA (rutas y módulos clave)

```
app/
├── dashboard/            # Inicio global (ISR 60s)
├── mundial/              # Hub del torneo + rankings (ELO vs FIFA)
├── ligas/ + ligas/[slug] # Las 5 grandes ligas
├── nba/                  # Hub + equipos/[id], rankings, estadisticas,
│                         #   tendencias, predicciones (ISR 300s)
├── matches/ + [id]       # Partidos + detalle universal sport-aware
├── inteligencia/         # Precisión verificable + metodología
├── value-bets/           # Smart Bets fútbol + historial
├── {champion,bracket,groups,scorers,players,simulation}/  # Mundial legacy
├── error.tsx / not-found.tsx / global-error.tsx
└── api/
    ├── predictions (GET) · search · nba/games · matches/[id]/{events,verdict,periods}
    ├── analysis/match/[id] · admin/{health,result} · simulate
    └── sync/{auto,window,live,results,espn-results,odds,recalibrate,
             smart-bets,leagues/*,nba/*}   # todos con CRON_SECRET

lib/
├── predictionEngine.ts   # FÚTBOL — fuente única Poisson/Dixon-Coles
├── leagueEngine.ts · simulationEngine.ts · scenarioEngine.ts · bracket.ts
├── smartBetsEngine.ts · smartBetGrading.ts · valueBets.ts   # fútbol
├── nba/                  # DOMINIO NBA (no importa nada de fútbol)
│   ├── constants.ts · engine.ts · verdict.ts · stats.ts
├── sports.ts             # Registro multi-deporte + listas blancas
├── verdictEngine.ts      # Veredicto fútbol (tipo compartido VerdictOutput)
├── fetchAll.ts           # Paginación >1000 filas PostgREST
└── constants.ts · teamForm.ts · models/ · agents/ · intelligence/

services/
├── verdict.ts            # Orquestación veredictos (dispatch por deporte)
├── smartBetTracking.ts   # Historial Smart Bets (SOLO fútbol, con guardia)
├── nba.service.ts        # Datos del dominio NBA
└── sync/                 # espn, odds, api-football, leagues, nba, recalibrate
```

---

## 7. BASE DE DATOS

Migraciones `001` → `050` (aplicar en orden; `032b` entre 032 y 033).
Verificación: `supabase/verify_migrations.sql` — 43 chequeos.

Tablas principales: competitions, sports, teams (+conference/division),
team_statistics, matches (+period_scores JSONB, round), predictions,
exact_score_predictions, odds, value_bets, smart_bet_picks, match_events,
match_verdicts, players, group_standings, injuries, sync_logs + tablas V3
(model_registry, prediction_audit_log, …) con RLS + lectura anon.

Datos reales cargados: Mundial 48 equipos/104 partidos · 5 ligas 2024-25
completas (~1.900 partidos) · NBA 30 equipos/1.314 partidos con cuartos.

---

## 8. COMANDOS

```bash
npm run dev          # desarrollo
npm run build        # SIEMPRE antes de push
npm test             # 72 unitarias
npm run test:e2e     # Playwright (en sandbox: ver CLAUDE.md para proxy)
npm run lint         # 0 errores esperado (incluye barrera NBA)
npm run type-check
```

---

## 9. NOTAS TÉCNICAS

- **Sin auth**: middleware solo redirige `/` → `/dashboard`. RLS con
  lectura pública (rol anon); escritura solo service-role.
- **ISR**: dashboard 60s, mundial 120s, ligas/nba/inteligencia 300s con
  `createStaticSupabaseClient` (sin cookies). El resto usa el cliente de
  cookies (deuda conocida, ver backlog).
- **Veredictos**: deterministas siempre; Claude pule si hay
  `ANTHROPIC_API_KEY` con guarda anti-pérdida de factores. Caché
  permanente en `match_verdicts`.
- **NBA sin fabricar**: métricas de posesión (Pace/ORtg/eFG%) y stats de
  jugadores NO se calculan — la fuente free no da boxscores. La UI lo
  declara. No "estimar" jamás estos valores.
- **Smart Bets sin edge falso**: The Odds API/Pinnacle solo entrega 1X2 y
  goles. Las cuotas de corners/tarjetas/disparos en la BD son referencia
  estática (seed de la migración 029, no se refrescan). El motor
  (`lib/smartBetsEngine.ts`, `STATIC_ODDS_FAMILIES`) omite el "edge vs
  mercado" para esas familias y lo aclara en la justificación: la
  probabilidad del modelo (forma real) es honesta, la ventaja de mercado
  no existiría. Si algún día hay fuente de cuotas en vivo para esos
  mercados, quitar la familia del set y sincronizarlas como 1X2/goles.
