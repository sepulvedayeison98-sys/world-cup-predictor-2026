# CLAUDE.md

Este archivo guía a Claude Code al trabajar en este repositorio.
Para el contexto completo del proyecto, lee `CLAUDE_CONTEXT.md`.

## Qué es

World Cup Predictor 2026: plataforma web pública de predicción de partidos del Mundial FIFA 2026.
Next.js 15 + TypeScript + Tailwind + Supabase. Acceso libre, sin autenticación.

## Comandos

- `npm run dev` — servidor de desarrollo (localhost:3000)
- `npm run build` — build de producción (correr SIEMPRE antes de hacer push para verificar)
- `npm run lint` — linter

## Reglas de trabajo

- **Idioma:** Toda la UI en español. Comentarios de código en español o inglés, consistente por archivo.
- **Antes de cualquier push:** correr `npm run build` y confirmar que pasa limpio.
- **Variables de entorno:** nunca commitear `.env.local`. Las claves van en Vercel/Supabase.
- **Tipado:** `types/database.ts` es genérico por ahora. Si lo regeneras con `supabase gen types`,
  puedes quitar los casts `(x as any)` de las API routes.
- **Base de datos:** cambios de schema van en `supabase/migrations/` con número incremental (005, 006...).
- **RLS:** acceso libre = el rol `anon` lee. Cualquier tabla nueva necesita su política de lectura pública.
- **Estilo:** tema oscuro tipo TradingView/Bloomberg. Verde esmeralda (#10b981) es el acento principal.
  Mínimo de formato, prosa clara, sin sobrecargar de bullets.

## Arquitectura

- **Server Components** para fetch inicial (páginas en `app/`).
- **Client Components** (`'use client'`) para interactividad (tablas, simulador, gráficos).
- **Services** (`services/`) encapsulan queries a Supabase.
- **El motor de predicción** vive en `app/api/predictions/route.ts` (servidor) y
  `components/simulation/SimulationEngine.tsx` (cliente, para el simulador).

## Identificadores clave

- Competición activa: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- Supabase project: `jruanwjjsygcmmvwxexh`
- Repo: github.com/sepulvedayeison98-sys/world-cup-predictor-2026
