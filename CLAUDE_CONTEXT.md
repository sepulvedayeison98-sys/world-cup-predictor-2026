# 📋 CONTEXTO DEL PROYECTO — World Cup Predictor 2026

> Documento maestro para continuar el desarrollo en Claude Code.
> Pega este archivo o referéncialo al inicio de cualquier sesión nueva.

---

## 1. QUÉ ES ESTE PROYECTO

**World Cup Predictor 2026** es una plataforma web pública de análisis y predicción
de partidos del Mundial FIFA 2026. Genera automáticamente:

- Probabilidades de victoria/empate/derrota por partido
- Marcadores exactos más probables (top 10)
- Apuestas de valor (EV positivo) comparando el modelo vs cuotas de casas de apuestas
- Estadísticas avanzadas de equipos y jugadores
- Tablas de grupos con probabilidad de clasificación
- Simulador de escenarios (modificar lesiones/clima/alineaciones y recalcular)

El motor de predicción usa un **modelo híbrido de 5 factores ponderados**: xG y
capacidad ofensiva/defensiva (40%), ELO Rating (25%), forma reciente — últimos 10
partidos (15%), mercado de apuestas — cuotas 1X2 de-vigueadas (10%), noticias/lesiones
(10%). Las probabilidades 1X2 y el top-10 de marcadores exactos se derivan de una
distribución de goles esperados (lambda por equipo) resuelta sobre la rejilla de
Poisson — equivalente al resultado de una simulación de Montecarlo. Única fuente de
verdad: `lib/predictionEngine.ts` (lo usan `services/sync/recalibrate.ts`,
`app/api/predictions/route.ts` y `lib/simulationEngine.ts`).

---

## 2. FINALIDAD Y VISIÓN

**Objetivo inmediato:** App web pública (acceso libre, sin login) que la gente pueda
usar como apoyo para informarse sobre los partidos del Mundial.

**Visión a futuro:**
- Página web / app móvil completa y escalable
- Conectar fuentes de datos en vivo (API-Football, The Odds API) para actualización automática
- Extender a otras competiciones: Champions League, Copa América, Eurocopa, ligas nacionales
- Posible modelo SaaS

**Contexto del dueño:** Yeison (usuario analítico, enfocado en crecimiento profesional/financiero,
vive en Medellín, interés en logística, optimización, automatización con dashboards/KPIs/IA).
Prefiere respuestas claras, directas, sin rodeos.

---

## 3. STACK TECNOLÓGICO

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 15.5.19 |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS (tema oscuro tipo TradingView) | 3.4 |
| Tablas | TanStack Table | 8.20 |
| Gráficos | Recharts (Radar, Line, Bar) | 2.15 |
| Estado servidor | TanStack React Query | 5.62 |
| Backend/DB | Supabase (PostgreSQL + RLS + Realtime) | — |
| Auth | Ninguna (acceso libre) | — |
| Deploy | Vercel (pendiente) | — |
| Iconos | lucide-react | 0.460 |

---

## 4. ESTADO ACTUAL (lo que YA está hecho)

✅ **Fase 1** — Tipos, schema SQL (15 tablas), servicios, layout, dashboard con KPIs
✅ **Fase 2** — Partidos (tabla + filtros + detalle), grupos, predicciones, apuestas de valor
✅ **Fase 3** — Jugadores + perfiles, simulador en tiempo real, API routes, realtime hooks
✅ **GitHub** — Repo creado y código subido
✅ **Supabase** — Proyecto creado, 4 migraciones ejecutadas, datos del Grupo C cargados
✅ **Acceso libre** — Login eliminado, RLS de lectura pública para rol anon
✅ **Build de producción** — Verificado, compila limpio (15 rutas)

⏳ **PENDIENTE INMEDIATO:** Deploy en Vercel
⏳ **PENDIENTE FUTURO:** Más datos (resto de grupos), fuentes en vivo, dominio propio

---

## 5. ACCESOS Y CREDENCIALES

### GitHub
- **Repo:** https://github.com/sepulvedayeison98-sys/world-cup-predictor-2026
- **Usuario:** sepulvedayeison98-sys
- **Branch principal:** main
- **Visibilidad:** Público

### Supabase
- **Project URL:** https://jruanwjjsygcmmvwxexh.supabase.co
- **Publishable key (anon, pública):** sb_publishable_pc8dmXXxxVls5qG2CR_-wA__lDRLPFl
- **Secret key:** ⚠️ NO incluida aquí — está solo en el panel de Supabase. Nunca commitear.

### Variables de entorno (.env.local — NO se sube a git)
```
NEXT_PUBLIC_SUPABASE_URL=https://jruanwjjsygcmmvwxexh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_pc8dmXXxxVls5qG2CR_-wA__lDRLPFl
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=World Cup Predictor 2026
NEXT_PUBLIC_COMPETITION_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

> ⚠️ Nota de seguridad: la publishable key es segura para el frontend (RLS la protege).
> Si quieres máxima seguridad, puedes rotar las llaves en Supabase y actualizar el .env.

---

## 6. ESTRUCTURA DE ARCHIVOS

```
world-cup-predictor-2026/
├── app/
│   ├── layout.tsx                    # Layout raíz: sidebar + topbar + providers
│   ├── globals.css                   # Design tokens, tema oscuro
│   ├── dashboard/page.tsx            # Dashboard principal (KPIs, widgets)
│   ├── matches/
│   │   ├── page.tsx                  # Lista de partidos (TanStack Table + filtros)
│   │   └── [id]/page.tsx             # Detalle de partido (radar, prob history, lineup)
│   ├── groups/page.tsx               # 12 grupos con standings
│   ├── predictions/page.tsx          # Tabla de predicciones + accuracy
│   ├── value-bets/page.tsx           # Apuestas de valor con EV/Kelly
│   ├── players/
│   │   ├── page.tsx                  # Lista de jugadores (tabla)
│   │   └── [id]/page.tsx             # Perfil individual + radar
│   ├── simulation/page.tsx           # Simulador de escenarios
│   ├── settings/page.tsx             # Página informativa (sin login)
│   └── api/
│       ├── predictions/route.ts      # POST: motor de predicción REST
│       ├── odds/route.ts             # POST: ingesta cuotas + genera value bets
│       └── simulation/route.ts       # POST: guardar escenarios
├── components/
│   ├── layout/                       # Sidebar, Topbar, ThemeProvider, QueryProvider
│   ├── dashboard/                    # KPICards, UpcomingMatches, ValueBets, GroupStandings widgets
│   ├── charts/                       # ROIChart, PredictionAccuracy, TeamComparisonRadar, ProbabilityHistory, PlayerRadar
│   ├── matches/                      # MatchesTable, MatchFiltersBar, MatchHeader, MatchPredictionPanel, MatchStatsComparison, ExactScoresTable, LineupDisplay, InjuriesPanel
│   ├── players/                      # PlayersTable, PlayersFiltersBar, PlayerProfileHeader, PlayerStatsPanel
│   ├── groups/                       # GroupCard
│   ├── predictions/                  # PredictionsTable, ValueBetsFullTable
│   ├── simulation/                   # SimulationEngine (recálculo en cliente)
│   └── ui/                           # sonner (toast placeholder)
├── services/
│   ├── matches.service.ts            # Queries de partidos con filtros + predictions join
│   ├── predictions.service.ts        # Motor de cálculo + KPIs + value bets
│   └── teams.service.ts              # Teams, groups, players, injuries
├── hooks/
│   └── useRealtimeMatches.ts         # Supabase Realtime subscriptions
├── lib/
│   ├── supabase/client.ts            # Cliente browser
│   ├── supabase/server.ts            # Cliente server (con cookies)
│   └── utils.ts                      # cn(), formatProbability, kellyFraction, expectedValue, etc.
├── types/
│   ├── index.ts                      # TODOS los tipos del dominio (Match, Team, Player, Prediction...)
│   └── database.ts                   # Tipado Supabase (genérico — regenerar con supabase gen types)
├── supabase/migrations/
│   ├── 001_initial_schema.sql        # 15 tablas, enums, RLS, triggers, funciones
│   ├── 002_seed_data.sql             # Datos Grupo C (Brasil, Marruecos, Haití, Escocia) + B y D parcial
│   ├── 003_realtime_and_sync.sql     # Realtime, notificaciones, sync_logs, vista dashboard_kpis
│   └── 004_public_read_access.sql    # Políticas RLS lectura pública (rol anon)
├── middleware.ts                     # Acceso libre: raíz → /dashboard
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── package.json
└── README.md
```

---

## 7. BASE DE DATOS — TABLAS (15)

users · competitions · groups · teams · team_statistics · group_standings ·
players · player_statistics · matches · match_statistics · lineups · lineup_players ·
injuries · predictions · exact_score_predictions · prediction_history · odds ·
value_bets · simulation_results · sync_logs · notifications

**Datos cargados actualmente:** 11 equipos, 22 jugadores, 6 partidos del Grupo C,
1 predicción (Brasil vs Marruecos), cuotas y 2 value bets. Grupos B y D parciales.

**ID de competición activa:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Convención de UUIDs en seed data:**
- `10000000-*` = equipos
- `20000000-*` = jugadores
- `30000000-*` = partidos
- `40000000-*` = predicciones
- `00000000-*` = grupos

---

## 8. PRÓXIMOS PASOS SUGERIDOS (en orden)

### Inmediato
1. **Deploy en Vercel** — conectar repo GitHub, agregar las 4 variables de entorno, deploy

### Corto plazo
2. **Cargar el resto de datos del Mundial 2026** — 48 equipos, 12 grupos completos, 104 partidos
   (crear una migración 005 o un script de ingesta)
3. **Generar predicciones para todos los partidos** — usar el endpoint POST /api/predictions
4. **Dominio propio** — comprar dominio y conectarlo en Vercel

### Medio plazo
5. **Conectar fuente de datos en vivo:**
   - API-Football (api-sports.io) para resultados/estadísticas en tiempo real
   - The Odds API para cuotas automáticas
   - Crear cron jobs / Vercel Cron para sincronización periódica
6. **Mejorar el tipado de Supabase** — regenerar `types/database.ts` con:
   `npx supabase gen types typescript --project-id jruanwjjsygcmmvwxexh > types/database.ts`
7. **Sistema de roles** — si en el futuro se quiere panel de admin para editar predicciones

### Largo plazo
8. **App móvil** (React Native / Expo reutilizando la lógica)
9. **Extender a otras competiciones** (el schema ya lo soporta con `competition_type`)
10. **Notificaciones push** cuando salen alineaciones o se detectan value bets

---

## 9. COMANDOS ÚTILES

```bash
# Desarrollo local
npm install
npm run dev                    # http://localhost:3000

# Build de producción (verificar antes de deploy)
npm run build

# Regenerar tipos de Supabase (mejora el tipado)
npx supabase gen types typescript --project-id jruanwjjsygcmmvwxexh > types/database.ts

# Git
git add -A && git commit -m "mensaje" && git push origin main
```

---

## 10. NOTAS TÉCNICAS IMPORTANTES

- **Acceso libre:** No hay autenticación. El middleware solo redirige `/` → `/dashboard`.
- **RLS activo:** Todas las tablas tienen Row Level Security. El rol `anon` tiene lectura
  pública (migración 004). La escritura sigue restringida a admin/analyst (no usado aún).
- **Tipado Supabase:** Actualmente `types/database.ts` es genérico (acepta `any`). Las API
  routes usan casts `(x as any)`. Al regenerar los tipos reales, se puede endurecer.
- **typedRoutes desactivado** en next.config (causaba fricción con hrefs dinámicos).
- **Fuentes:** Inter + JetBrains Mono vía next/font/google. Funcionan en Vercel.
- **El simulador** recalcula en el cliente (sin llamada a servidor) en <50ms.
- **Migraciones idempotentes:** Si re-ejecutas una migración puede dar error "already exists".
  Para empezar limpio: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + permisos.

---

## 11. PROMPTS PROVENIENTES DEL DISEÑO ORIGINAL

El proyecto nació de dos documentos de especificación:
1. **WORLD CUP PREDICTOR DASHBOARD V1** — arquitectura completa SaaS con todos los módulos
2. **PROMPT ULTRA PRO - MOTOR DE PREDICCIÓN MUNDIALISTA 2026** — lógica del motor de
   predicción, simulación Monte Carlo, generador de marcadores, índice de confianza,
   tabla de probabilidades por mercado.

Ambos están reflejados en el código actual. El motor implementado es una versión
estadística de los pesos definidos en el prompt ultra pro.
