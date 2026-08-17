# Veredicto · Inteligencia Deportiva

Plataforma pública de análisis y predicción multi-deporte: **Mundial FIFA
2026**, las **5 grandes ligas europeas** (Premier, La Liga, Serie A,
Bundesliga, Ligue 1) y la **NBA**. Estética de terminal financiera
(TradingView/Bloomberg), honestidad estadística como principio: toda
precisión se publica con su línea base y ningún dato se fabrica.

**🌐 En vivo:** https://world-cup-predictor-2026-flax.vercel.app

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Estilos | Tailwind CSS (tema oscuro, acento esmeralda #10b981) |
| Gráficos | Recharts |
| Tablas | TanStack Table (partidos/jugadores) + tablas propias |
| Estado servidor | React Query (componentes cliente) + ISR |
| Backend | Supabase (PostgreSQL + RLS, acceso libre sin auth) |
| IA | Claude (pulido de veredictos y análisis, con fallback determinista) |
| Deploy | Vercel + GitHub Actions (crons de sync) |

---

## Qué hace

- **Predicciones verificables**: motor híbrido de 5 factores +
  Poisson/Dixon-Coles (fútbol) y ELO sin empates (NBA), con backtest
  walk-forward y calibración publicada en `/inteligencia`.
- **Detalle universal de partido**: cualquier partido de cualquier
  competición es clicable — predicción, veredicto post-partido,
  estadísticas del deporte que corresponda (timeline de eventos en
  fútbol, desglose por cuarto en NBA).
- **Smart Bets** (fútbol): recomendaciones con historial de aciertos
  público y aislamiento estricto por deporte.
- **Dominio NBA**: hub con standings por conferencia, calendario
  navegable, perfiles de franquicia, rankings, estadísticas de liga,
  tendencias y calibración del modelo — todo con datos reales.

## Arquitectura multi-deporte

- `lib/sports.ts` es el **registro único** de deportes y competiciones:
  la navegación raíz nunca crece; crece el registro.
- Cada deporte es un dominio aislado (`lib/nba/`, motores de fútbol en
  `lib/`): una regla ESLint (`no-restricted-imports`) impide que el
  código NBA importe motores o componentes de fútbol.
- **Regla de oro**: toda query a `matches`/`teams`/`team_statistics`/
  `predictions` filtra por competición; los procesos transversales usan
  `competitionIdsOfSport()` como lista blanca.

---

## Desarrollo local

```bash
git clone https://github.com/sepulvedayeison98-sys/world-cup-predictor-2026.git
cd world-cup-predictor-2026
npm install
cp .env.example .env.local   # rellenar claves (Supabase, APIs)
npm run dev                  # http://localhost:3000
```

**Base de datos**: aplicar `supabase/migrations/` en orden (001 → 050;
`032b` ordena entre 032 y 033). Verificar con
`supabase/verify_migrations.sql` (43 chequeos).

**Comandos**: `npm run build` (obligatorio antes de push) ·
`npm test` (189 unitarias) · `npm run test:e2e` (15 Playwright) ·
`npm run lint` · `npm run type-check` ·
`npm run verify:providers` (llama a las APIs reales; consume cuota).

---

## Fuentes de datos

Toda API externa entra por la capa `services/sports/`, que la traduce a modelos
internos antes de que nada de la aplicación la vea. La interfaz no conoce
proveedores: cambiar de fuente es mover una variable de entorno.

| Módulo | Primario | Respaldo | Coste |
|--------|----------|----------|-------|
| Fútbol | API-Football (Pro) | ESPN | de pago |
| NBA | ESPN | — | gratis |
| Tenis | ESPN (circuito actual) | Sackmann CSV (histórico) | gratis |
| Cuotas | The Odds API | — | de pago |
| Noticias | ESPN | — | gratis |

La NBA se sirve desde ESPN y no desde api-basketball porque esa cuenta sigue en
plan Free (100 req/día, sin temporada en curso). Detalle completo del stack, la
política de caché y cómo cambiar de proveedor: **`docs/API_ARCHITECTURE.md`**.

Los syncs corren por GitHub Actions y crons de Vercel, autenticados con
`CRON_SECRET`. Ninguna clave vive en el código.

`npm run verify:providers` llama a las APIs de verdad y comprueba que cada
adapter sigue funcionando hoy.

---

## Documentación

- `CLAUDE.md` / `CLAUDE_CONTEXT.md` — guía de trabajo y contexto maestro
- `SOFASCORE_PLAYBOOK.md` — **plan de producto prioritario** (patrones de
  retención/SEO/móvil adaptados de Sofascore, roadmap por fases)
- `docs/WEIGHT_TUNING_DESIGN.md` — diseño del ajuste automático de pesos del
  modelo por calibración (fases F0-F5, aún sin implementar)
- `docs/CACHE_STRATEGY.md` — estrategia de caché (ISR por tiers + revalidación
  por evento + cliente); capa 5 de frescura sin castigar rendimiento
- `docs/API_ARCHITECTURE.md` — **capa de proveedores deportivos**: stack de
  APIs y por qué cada una, modelos normalizados, caché por clase de dato,
  taxonomía de errores, cómo cambiar de proveedor y cómo añadir un deporte
- `docs/TENNIS_ARCHITECTURE.md` — dominio Tennis: modelo de datos aislado,
  barreras y plan de fases
- `PROGRESS_REPORT.md` — último plan ejecutado y su estado
- `AUDIT_REPORT.md` — auditoría técnica histórica (jun-2026)
