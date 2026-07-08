# Informe de progreso — Fase 4 y Etapa 5: Ligas de clubes

**Fecha:** 8 de julio de 2026 (dos sesiones autónomas el mismo día)

---

## ETAPA 5 (segunda sesión) — Las 5 grandes ligas + motor en vivo

### Fase 1 — Expansión a las 5 grandes ligas

Serie A, Bundesliga y Ligue 1 se sumaron a Premier League y La Liga
(migración 045, ingesta y calibración en producción). Verificación
contra la realidad de la 2024-25 — los cuatro campeones reproducidos
exactamente: Liverpool 84, Barcelona 88, **Napoli 82, Bayern München 82
y PSG 84 puntos**.

Hallazgo corregido durante la prueba: API-Football incluye los
**playoffs de descenso** de Bundesliga y Ligue 1 (2 partidos extra y un
rival de segunda división). Se filtró todo a temporada regular
(`round IS NOT NULL`): posiciones, calendario, ELO y backtest quedan
limpios (18 equipos exactos en ambas ligas).

### Fase 2 — Motor pre-partido y automatización

- `leagueEngine` ahora también predice **partidos programados o en
  vivo** con el estado final del modelo (`upcoming`): al conectar la
  temporada 2026-27, cada corrida de calibración deja lista la
  predicción de la siguiente jornada automáticamente. En pretemporada
  el encogimiento lleva las probabilidades a la media de la liga —
  honesto, sin inventar datos.
- La calibración protege la pretemporada (no pisa ELO/estadísticas de
  equipos sin partidos) y publica las predicciones pre-partido
  (`was_correct` NULL hasta que el partido termina).
- **Workflow `sync-leagues.yml`**: ingesta + calibración automáticas
  lunes y viernes 03:00 UTC (10 requests de cuota por corrida).

### Fase 3 — Revisión y métricas de las 5 ligas

Backtest 2024-25 completo (1,512 partidos evaluados en total):

| Liga | Acierto 1X2 | Brier | Log-loss |
|------|------------|-------|----------|
| Premier League | 49.4% | 0.608 | 1.016 |
| La Liga | 50.3% | 0.604 | 1.010 |
| Serie A | 51.8% | 0.591 | 0.989 |
| Bundesliga | 47.9% | 0.641 | 1.069 |
| Ligue 1 | 56.3% | 0.600 | 1.011 |

Coherencia futbolística: Ligue 1 es la más predecible (dominio del
PSG) y la Bundesliga la más volátil — igual que en la literatura de
modelos de fútbol. Pruebas: 31/31 unitarias, 6/6 e2e (Bundesliga con
18 filas verificadas), 37/37 migraciones, lint 0 errores.

---

# Informe original — Fase 4 (primera sesión)

**Fecha:** 8 de julio de 2026
**Alcance:** sesión autónoma de tres fases sobre la expansión a ligas
(Premier League + La Liga, opción A aprobada por el dueño del proyecto).
**Estado final:** las tres fases completas, desplegadas y verificadas en
producción (`world-cup-predictor-2026-flax.vercel.app`).

---

## Resumen ejecutivo

La plataforma dejó de ser solo del Mundial: ahora tiene una sección de
ligas de clubes con datos 100% reales de API-Football (temporada 2024-25
completa), un motor de predicción propio para ligas calibrado con
backtest honesto, y páginas públicas con tabla de posiciones, calendario
por jornada y las probabilidades del modelo partido a partido. Todo sin
tocar un solo dato del Mundial en curso, que quedó blindado por
competición en cada consulta.

---

## Fase 1 — Motor de predicción para ligas

**Implementado**

- `lib/leagueEngine.ts` — motor puro (sin I/O, testeable): ELO de clubes
  (K=20, multiplicador por diferencia de goles, ventaja de local de 60
  puntos) + fuerzas de ataque/defensa con promedios móviles de 10
  partidos y encogimiento hacia la media de la liga, resuelto sobre la
  misma rejilla Poisson + Dixon-Coles del motor del Mundial.
- Backtest **walk-forward honesto**: cada partido se predice únicamente
  con información anterior a su disputa; las primeras 5 jornadas por
  equipo son calentamiento y no se evalúan.
- `services/sync/league-calibrate.ts` + `GET /api/sync/leagues/calibrate`
  (protegida por CRON_SECRET): persiste ELO final por club,
  `team_statistics` de temporada y las 660 predicciones evaluadas
  (`model_version: liga-1.0`). No consume cuota de API-Football.
- **Blindaje multi-competición (Regla #2 del plan):** dashboard,
  `/predictions` y `GET /api/predictions` ahora filtran por competición
  con `matches!inner`; se eliminó `getDashboardKPIs` (código muerto sin
  filtro). Nueva "regla de oro" documentada en CLAUDE.md.

**Resultados del backtest (producción, 660 partidos evaluados)**

| Liga | Acierto 1X2 | Brier | Log-loss |
|------|------------|-------|----------|
| Premier League | 49.4% (163/330) | 0.608 | 1.016 |
| La Liga | 50.3% (166/330) | 0.604 | 1.010 |

Referencias: azar = 33% / 0.667 / 1.099; apostar siempre local ≈ 44%.
El modelo supera claramente ambas líneas base usando solo resultados
(sin xG ni cuotas todavía). ELO final coherente con la realidad:
Liverpool (1651) lidera la Premier y Barcelona (1700) La Liga — los
campeones reales de la 2024-25 con 84 y 88 puntos respectivamente,
reproducidos exactamente por la tabla calculada.

## Fase 2 — Páginas de detalle por liga

**Implementado**

- Migración **044** (aplicada): columna `matches.round` con la jornada
  real de API-Football + índice parcial; la ingesta la rellena
  (38 jornadas × 10 partidos verificadas por liga).
- `/ligas/[slug]` (`premier-league`, `la-liga`), prerenderizadas con ISR:
  tarjetas de resumen (líder, mejor ataque, mejor defensa, precisión del
  modelo), tabla de posiciones completa y **calendario navegable por
  jornada** con marcador real, barra de probabilidades 1X2 del modelo y
  el acierto/fallo de cada pick.
- `StandingsTable` extraído como componente compartido; `/ligas` enlaza
  al detalle de cada liga.

**Corrección importante encontrada al probar:** las páginas usaban el
cliente Supabase con `cookies()`, lo que rompía el prerender estático
(el detalle quedaba horneado como 404). Se cambió al cliente estático
sin cookies (mismo patrón del dashboard) → ISR real con revalidación de
5 minutos.

## Fase 3 — Revisión integral y calidad

- **ESLint configurado por primera vez** (`next/core-web-vitals`): 7
  errores corregidos (comillas sin escapar en 5 componentes) → **0
  errores**. Quedan warnings heredados (deps de hooks, `<img>`) que no
  bloquean y están fuera del alcance de esta sesión.
- **`verify_migrations.sql` auditado contra la base viva: 36/36 en
  verde.** Dos firmas estaban desactualizadas y se corrigieron: la 029
  (los seeds de cuotas fueron reemplazados por el pipeline real de
  Pinnacle) y la 035 (ESPN corrige los kickoffs con horarios reales).
- Descubrimiento de entorno documentado en CLAUDE.md: el `fetch` de Node
  en el sandbox necesita `NODE_USE_ENV_PROXY=1` + el CA bundle para
  llegar a Supabase (curl sí pasaba por el proxy; el build/e2e local no).
- `CLAUDE_CONTEXT.md` actualizado (estado actual y próximos pasos
  reales); tipos de Supabase regenerados tras las migraciones.

## Pruebas ejecutadas (todas en verde)

| Suite | Resultado |
|-------|-----------|
| Unitarias (`npm test`) | 29/29 — motores del Mundial + 9 nuevas de ligas (standings, backtest, ELO) |
| E2E Playwright | 6/6 — 4 de humo existentes + 2 nuevas (overview con pestañas y 20 filas; detalle con jornadas y modelo) |
| `npm run type-check` | limpio |
| `npm run lint` | 0 errores |
| Build de producción | limpio (`/ligas` ISR, `/ligas/[slug]` prerender × 2) |
| Migraciones en BD viva | 36/36 verificadas |
| Producción (post-deploy) | `/ligas`, `/ligas/premier-league`, `/ligas/la-liga` con datos; `/dashboard` y `/predictions` sin contaminación de clubes (0 menciones) |

## Verificaciones de integridad del Mundial

- 48 selecciones y 100 partidos del Mundial intactos (conteo exacto).
- ELO de selecciones sin tocar (Colombia 1855).
- Dashboard y página de predicciones del Mundial verificados sin datos
  de clubes tras insertar las 660 predicciones de liga.

## Pendientes (bloqueos externos, no resolubles en esta sesión)

1. **Upgrade del plan de API-Football** (~19 USD/mes, decisión de
   compra del dueño): el plan Free solo llega a la temporada 2024;
   necesario hacia el 15 de agosto para la 2026-27 en vivo. Toda la
   tubería ya está probada de punta a punta con la 2024-25.
2. **Sistema de usuarios / polla**: pospuesto explícitamente por el
   dueño; no se tocó.

## Cómo operar lo nuevo

```bash
# Re-ingestar calendario/equipos (idempotente, ~4 requests de cuota)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://world-cup-predictor-2026-flax.vercel.app/api/sync/leagues/ingest

# Recalibrar el motor de ligas (0 requests de cuota)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://world-cup-predictor-2026-flax.vercel.app/api/sync/leagues/calibrate

# Validar credenciales/cuota de API-Football
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://world-cup-predictor-2026-flax.vercel.app/api/sync/leagues
```

Para agregar una liga nueva: entrada en `TARGET_LEAGUES`
(`services/sync/api-football.ts`) + `LEAGUE_COMPETITION_IDS` y
`LEAGUE_SLUGS` (`lib/constants.ts`) + fila en `competitions`/`seasons`
(migración), y correr ingest + calibrate. El resto (páginas, motor,
tests) es genérico.
