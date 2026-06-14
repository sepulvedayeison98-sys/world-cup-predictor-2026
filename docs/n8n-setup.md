# Sync inteligente con n8n

Cómo conectar n8n para que los datos se actualicen **casi en vivo durante los
partidos** sin reventar la cuota gratis de The Odds API (500 créditos/mes).

## Idea

Cada llamada a The Odds API cuesta **~2 créditos**. Con 500/mes solo hay margen
para **~16 créditos/día**. En vez de sincronizar a ciegas cada 30 min las 24h
(que agota la cuota en días), n8n primero pregunta al **gatekeeper** —que NO
gasta créditos— y solo dispara los syncs caros cuando hay partido.

```
n8n (cada 5 min, gratis)
  └─ GET /api/sync/window   ← consulta nuestra DB, 0 créditos
       ├─ shouldSyncResults? → GET /api/sync/results   (2 créditos)
       └─ (workflow aparte, cada ~12h) GET /api/sync/odds → /api/sync/recalibrate
```

El tramo **DB → usuario ya es en vivo** (Supabase Realtime). El único costo es
**fuente → DB**, que es lo que el gatekeeper optimiza.

## Endpoints

Todos requieren el header `Authorization: Bearer <CRON_SECRET>` (el mismo valor
que pusiste en `.env.local` / Vercel).

| Endpoint | Costo Odds API | Qué hace |
|---|---|---|
| `GET /api/sync/window` | 0 | Dice si conviene sincronizar (lee solo la DB) |
| `GET /api/sync/results` | ~2 | Marcadores/estado (The Odds API /scores) |
| `GET /api/sync/odds` | ~2 | Cuotas → value bets |
| `GET /api/sync/recalibrate` | 0 | Mezcla predicciones con el mercado |

Respuesta de `/api/sync/window`:
```json
{
  "liveMatches": 2,
  "activeMatches": 2,
  "upcomingNext48h": 6,
  "nextKickoffInMin": 42,
  "shouldSyncResults": true,
  "shouldSyncOdds": true,
  "reason": "2 partido(s) en ventana de juego"
}
```

## Workflow A — Resultados (condicional, frecuente)

1. **Schedule Trigger** → cada **5 min**.
2. **HTTP Request** → `GET https://TU-APP/api/sync/window`
   - Header `Authorization: Bearer <CRON_SECRET>`.
3. **IF** → `{{ $json.shouldSyncResults }}` es `true`.
4. (rama true) **HTTP Request** → `GET https://TU-APP/api/sync/results` (mismo header).

Así los resultados solo se sincronizan cuando hay partido en ventana de juego.

## Workflow B — Cuotas + recalibración (periódico)

1. **Schedule Trigger** → cada **12 h** (o 2 veces/día).
2. **HTTP Request** → `GET /api/sync/odds` (header).
3. **HTTP Request** → `GET /api/sync/recalibrate` (header). *(recalibrar no gasta cuota)*

Opcional: antes del paso 2, un **IF** sobre `shouldSyncOdds` para saltar días sin
partidos próximos.

## Presupuesto de cuota (plan gratis, 500/mes)

| Escenario | Gasto aprox/mes |
|---|---|
| Resultados solo durante ventanas de partido (~6-8 syncs/día activos) | ~360–480 |
| Cuotas 2×/día | ~120 |
| Recalibración | 0 |

Queda ajustado pero **dentro de los 500**. La realidad honesta: en plan gratis
los marcadores se refrescan ~cada 5-10 min **durante** los partidos (no segundo a
segundo). Para algo más fino, plan pago de The Odds API o una fuente de scores
aparte.

## Importante

- **Elige UN solo agendador.** Si usas n8n, vacía los `crons` de `vercel.json`
  (o no configures el cron en Vercel) para no gastar el doble.
- El gatekeeper se puede revisar tan seguido como quieras (no cuesta créditos),
  pero `/api/sync/results` sí — por eso el IF.
- Para monitorear el gasto: las respuestas de The Odds API traen los headers
  `x-requests-remaining` / `x-requests-used`.
