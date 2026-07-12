# CLAUDE.md

Este archivo guía a Claude Code al trabajar en este repositorio.
Para el contexto completo del proyecto, lee `CLAUDE_CONTEXT.md`.

## Qué es

Veredicto · Inteligencia Deportiva: plataforma web pública multi-deporte
de predicción — Mundial FIFA 2026, 5 grandes ligas europeas y NBA.
Next.js 15 + TypeScript + Tailwind + Supabase. Acceso libre, sin autenticación.

## Comandos

- `npm run dev` — servidor de desarrollo (localhost:3000)
- `npm run build` — build de producción (correr SIEMPRE antes de hacer push para verificar)
- `npm run lint` — linter (0 errores es lo esperado; quedan warnings heredados)
- `npm run type-check` — TypeScript sin emitir
- `npm test` — pruebas unitarias (motores, ligas, NBA, veredictos, aislamiento)
- `npm run test:e2e` — Playwright. En el sandbox de Claude Code correr con:
  `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test`
  (el fetch de Node necesita el proxy para llegar a Supabase; el build local igual)

## Reglas de trabajo

- **Idioma:** Toda la UI en español. Comentarios de código en español o inglés, consistente por archivo.
- **Antes de cualquier push:** correr `npm run build` y confirmar que pasa limpio.
- **Variables de entorno:** nunca commitear `.env.local`. Las claves van en Vercel/Supabase.
- **Base de datos:** cambios de schema van en `supabase/migrations/` con número incremental
  (siguiente: 054). Actualizar también `supabase/verify_migrations.sql`.
- **RLS:** acceso libre = el rol `anon` lee. Cualquier tabla nueva necesita RLS activo + su
  política de lectura pública.
- **Estilo:** tema oscuro tipo TradingView/Bloomberg. Verde esmeralda (#10b981) es el acento principal.
  Mínimo de formato, prosa clara, sin sobrecargar de bullets.
- **Data First:** cero datos fabricados. Si la fuente no provee una métrica (p. ej. posesión
  NBA), no se estima ni se rellena — se declara honestamente y va al backlog.

## Arquitectura

- **Server Components** para fetch inicial (páginas en `app/`), ISR donde no hay cookies.
- **Client Components** (`'use client'`) para interactividad (tablas, simulador, gráficos).
- **Services** (`services/`) encapsulan queries a Supabase.
- **Registro multi-deporte** en `lib/sports.ts`: la navegación raíz nunca crece — crece el
  registro. Procesos transversales usan `competitionIdsOfSport()` como lista blanca.
- **Motor de fútbol**: `lib/predictionEngine.ts` (fuente única Poisson/Dixon-Coles),
  `lib/leagueEngine.ts` para ligas.
- **Dominio NBA**: `lib/nba/` + `components/nba/` + `app/nba/`. PROHIBIDO importar motores o
  componentes de fútbol desde el dominio NBA — hay regla ESLint (`no-restricted-imports` en
  `.eslintrc.json`) que lo bloquea. Utilidades compartidas van a módulos neutros o se duplican.
- **Dominio Tennis**: `lib/tennis/` + `components/tennis/` + `app/tennis/` + `services/tennis/`
  + tablas exclusivas `tennis_*` (migración 053). Barreras ESLint en las CUATRO direcciones
  (tenis↛fútbol, tenis↛NBA, fútbol↛tenis, NBA↛tenis). Ver `docs/TENNIS_ARCHITECTURE.md`.

## Identificadores clave

- Mundial: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- NBA: `12000000-0000-4000-8000-000000000012` (ver `lib/nba/constants.ts`)
- Ligas: Premier `39000000-0000-4000-8000-000000000039`,
  La Liga `14000000-0000-4000-8000-000000000140` (ver `lib/constants.ts`)
- Supabase project: `jruanwjjsygcmmvwxexh`
- Repo: github.com/sepulvedayeison98-sys/world-cup-predictor-2026

## Regla de oro multi-competición

Toda query a `matches`, `teams`, `team_statistics` o `predictions` DEBE
filtrar por competición (directo o con `matches!inner`). Conviven Mundial,
amistosos, ligas de clubes y NBA en las mismas tablas. Las tablas grandes
(NBA ~1.314 partidos) superan el tope de 1000 filas de PostgREST: usar
`fetchAllRows` de `lib/fetchAll.ts`.
