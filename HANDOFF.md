# HANDOFF — Veredicto · Inteligencia Deportiva

> Documento de traspaso. **Última actualización: 2026-08-17.**
> Pensado para retomar el proyecto en una sesión nueva sin leer el historial.
>
> Complementos: `CLAUDE.md` (reglas del repo) · `CLAUDE_CONTEXT.md` (contexto largo)
> · `docs/TENNIS_ARCHITECTURE.md` (decisiones del dominio tenis, incluida la
> ablación del motor) · `UX_AUDIT_REPORT.md` (auditoría de experiencia)
> · `PROGRESS_REPORT.md` (bitácora de entregas).

---

## 1. Qué es y a dónde va

Plataforma web pública de **predicción e inteligencia deportiva** (Next.js 15 +
TypeScript + Tailwind + Supabase, sin autenticación, desplegada en Vercel).

Tres dominios **estrictamente aislados**: **Fútbol** · **NBA** · **Tenis**.

El norte: competir con SofaScore/FlashScore desde una propuesta propia —
**predicción explicable con métricas medidas y verificables**, no promesas.

### Reglas innegociables (aplican a todo)

1. **Data First** — si la fuente no lo da, no existe en la UI. Nada se estima
   ni se rellena; lo bloqueado se declara abiertamente.
2. **Medido, no prometido** — ningún cambio del motor se promueve sin backtest
   comparativo que lo justifique. **Los rechazos se documentan** (hay tres).
3. **Aislamiento de dominios** — barreras ESLint en las cuatro direcciones
   (tenis↛fútbol, tenis↛NBA, fútbol↛tenis, NBA↛tenis). Lo compartido va a
   módulos neutros (`lib/utils`, `lib/sports`, `lib/calibration`).
4. **Gates antes de cada push** — `type-check`, `test`, `lint`, `build`.
5. **Migraciones numeradas** en `supabase/migrations/` (siguiente: **057**) +
   registrar el chequeo en `supabase/verify_migrations.sql`.
6. **Secretos jamás en el repo ni en el chat.** `.env.local` está gitignoreado.

---

## 2. Estado actual

> Verificado contra la BD el 2026-08-04; partidos y equipos recontados el
> 2026-08-17.

Producción: `https://world-cup-predictor-2026-flax.vercel.app`
Rama de trabajo: `claude/page-data-refresh-63yioa` (se mantiene en FF-sync con
`main`; ambas apuntan al mismo commit tras cada entrega). Ojo: alguna sesión
remota puede abrirla con sufijo (`…-vbibxn`) — es la misma rama de trabajo con
otro nombre en el remoto, conviene consolidar al entregar.

### Métricas del motor (reales, sin truncar)

| Dominio | Predicciones resueltas | Precisión | Línea base |
|---|---|---|---|
| **Ligas de fútbol** | 2.058 | **50,5 %** | azar 33 % |
| **NBA** | 1.302 | **65,3 %** | azar 50 % |
| **Tenis ATP** (backtest) | 5.556 | **64,0 %** | azar 50 % · **bate al ranking** |
| Mundial 2026 *(histórico)* | 91 | 83,5 % | azar 33 % |

### Competiciones

- **Fútbol: 14 competiciones, 6 activas.** Seis ligas en temporada en curso
  (Premier, La Liga, Serie A, Bundesliga, Ligue 1 en **2026-27**; Liga BetPlay
  en **2026**) + sus seis temporadas 2024-25/2024 como histórico + Mundial 2026
  y Amistosos, ambos ya inactivos.
- **1.894 partidos programados** (recontado contra la BD el 2026-08-17), todos
  con predicción.
- **NBA:** temporada 2024-25 (la actual está bloqueada, ver §6).
- **Tenis:** 581 jugadores · 5.676 partidos · 11 corridas de backtest.

---

## 3. Arquitectura

### Dominios (patrón App Router, replicado por deporte)

```
lib/<dominio>/       motores y lógica pura (sin I/O)
services/<dominio>/  acceso a datos y sincronización
app/<dominio>/       páginas
components/<dominio>/ componentes
app/api/<dominio>/   endpoints
```

Barreras en `.eslintrc.json` (`no-restricted-imports`), verificadas con tests
negativos. Punto de integración neutral: **`lib/sports.ts`**.

### Modelo de temporadas (decisión clave, 2026-08)

Cada par **(liga, temporada)** es su propia fila en `competitions`. Antes había
una fila por liga con la temporada como etiqueta; al llegar 2026-27 eso habría
mezclado dos campañas en la misma tabla (el constraint
`(competition_id, match_number)` lo impidió — hizo su trabajo).

- `LEAGUE_SEASON_COMPETITIONS` (liga → temporada → id) es la **fuente única**.
- `LEAGUE_COMPETITION_IDS` = **la temporada en curso** (lo que consumen páginas,
  ingesta y calibración).
- `ALL_LEAGUE_COMPETITION_IDS` / `leagueAllCompetitionIds()` = todas las
  temporadas (backtest y listas blancas).
- UUID determinista: `{apiFootballId}{año}-0000-4000-8000-{apiFootballId}`.
- Etiqueta: europeas `"2026-27"`, año calendario (Colombia) `"2026"`.

**Añadir una temporada** = una entrada en `LEAGUE_SEASON_COMPETITIONS` +
migración que inserte la fila + ingesta + calibración.

### Estados de competición (`lib/sports.ts`)

| Estado | Significado |
|---|---|
| `activa` | Se está jugando: va en la navegación principal |
| `proximamente` | Prometida, sin datos: se muestra como promesa, sin enlace |
| `historica` | Terminada: **fuera de la nav, datos conservados** (Mundial 2026) |

`competitionIdsOfSport()` incluye activas **e** históricas: responde "¿qué es
este deporte?" (barrera de seguridad), no "¿qué se muestra".

---

## 4. Motores: historial completo (todo medido walk-forward)

### Tenis — `tennis-2.0` en producción

| Versión | Cambio | Resultado | Decisión |
|---|---|---|---|
| 1.0 | base (ELO 1500, factores 35/25/20/10/10) | 63,75 % / 0,4420 | superada |
| 1.1 | + siembra de ELO por ranking | 63,95 % / 0,4400 | superada |
| 1.2 | mapeo logElo del ranking | 63,43 % — **peor** | ❌ **rechazada** |
| 2.0 espec. original | superficie 30 % + fatiga | 62,89 % — **peor** | ❌ **rechazada** |
| **2.0 final** | rankingElo 40 % · superficie 15 % · forma 15 % · **saque/resto 15 %** · H2H 10 % | **64,00 % / 0,4375** | ✅ **producción** |

Elegida por **ablación pareada** con regla de promoción **pre-declarada**
(batir a 1.1 en las 3 métricas globales **y** en Brier de ventana tardía).
Por primera vez **supera al ranking puro** (64,26 % vs 64,19 %).
Advertencia honesta documentada: selección in-sample entre pocas variantes.

**Fatiga excluida**: el proxy con granularidad "fecha de inicio de torneo"
midió **dañino**. `lib/tennis/fatigue.ts` queda como módulo puro para cuando
la fuente tenga fechas/minutos por partido (TML sí publica `minutes`).

### Fútbol — `liga-1.0` · NBA — `nba-1.0`
Estables. Football está **congelado** salvo correcciones críticas.

**Siembra de ELO entre temporadas — ❌ RECHAZADA (2026-08-17).** Cuarto
experimento rechazado. Al pasar a una competición por temporada, los equipos
de 2026-27 arrancan todos en ELO 1500: Premier, Serie A, Bundesliga y Ligue 1
dan **la misma predicción en sus 380/306 partidos**. Se probó heredar el ELO
final de la temporada anterior, encogido hacia la media
(`seasonSeedElo`, emparejando por `api_football_id`).

| Variante | Precisión | Brier | Ventana temprana (Brier) |
|---|---|---|---|
| base (todos en 1500) | **48,21 %** | 0,6273 | 0,6167 |
| k=0,50 | 47,02 % | 0,6262 | 0,6135 |
| **k=0,75** (primario) | 47,62 % | **0,6257** | **0,6119** |
| k=1,00 | 48,21 % | 0,6253 | 0,6105 |

Banco: Liga BetPlay 2024 → 2026, 168 partidos evaluados, 18/20 equipos con
ELO heredable. El Brier mejora con toda la rejilla y en la ventana temprana
mejoran **las dos** métricas (precisión 45,00 % → 46,67 %) — el efecto va en
la dirección esperada justo donde debía. Pero la regla pre-declarada exigía
mejorar también la precisión de temporada completa, y no lo hace. **Se
rechaza sin regatear la regla.**

Tres limitaciones que invalidarían la promoción aunque hubiera pasado: una
sola liga; falta 2025 en medio (herencia con un año de desfase); y el
calentamiento de 5 partidos **excluye de la evaluación justo los partidos
donde el arranque en frío más daña**. `seasonSeedElo` y el parámetro
`seedElo` de `runLeagueBacktest` quedan como módulo puro y probado (igual
que `lib/tennis/fatigue.ts`) para cuando las europeas 2026-27 den un banco
de pruebas limpio.

---

## 5. Accesos (dónde viven; **nunca** en el repo)

| Secreto | Dónde | Notas |
|---|---|---|
| `SPORTS_API_KEY` | Vercel + `.env.local` | api-sports.io, **plan Pro** hasta 17-sep-2026, 7.500 req/día |
| `FOOTBALL_API_SEASON` | Vercel (`2026`) | Único knob para cambiar de temporada |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | Recuperable vía API de gestión de Supabase |
| `NEXT_PUBLIC_SUPABASE_*` | Vercel + `.env.local` | Públicas |
| `CRON_SECRET` | Vercel + `.env.local` | Protege todos los `/api/sync/*` |

- Supabase project: `jruanwjjsygcmmvwxexh` · Vercel: `world-cup-predictor-2026`
  (equipo `kodrefe-s-projects`, **plan Hobby** → funciones máx. **60 s**).
- **El contenedor efímero borra `.env.local` y `node_modules` sin avisar.** Ya
  pasó cuatro veces. Si falta: `npm ci` y recuperar las claves de Supabase con
  el token de gestión (`/v1/projects/{ref}/api-keys?reveal=true`). Las públicas
  (URL + anon) bastan para que `npm run build` pase; la de service role solo
  hace falta para escribir desde los `/api/sync/*`.

---

## 6. Bloqueado por fuente de datos (**no fabricar**)

| Qué | Por qué | Para desbloquear |
|---|---|---|
| **NBA temporada actual** | `api-basketball` sigue en plan **Free** (2022-2024) | Contratar **api-basketball aparte** — el Pro de fútbol **NO** lo cubre (verificado) |
| **Cuotas de tenis / Smart Bets tenis** | api-sports no cubre tenis | Comprar fuente (API-Tennis, Sportradar, Tennis-Data) |
| **WTA / Challenger / ITF** | Sin fuente verificable | Encontrar fuente |
| Lesiones, clima, minutos, "indoor" | La fuente no los trae | — |

---

## 7. Operativa

```bash
# Gates (SIEMPRE antes de push)
npm run type-check && npm test && npm run lint
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run build

# E2E
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test

# Entrega: commit → push rama → checkout main → merge --ff-only → push main → volver
# Después: esperar el deploy y hacer smoke de las URLs públicas.
```

### Endpoints (todos con `Authorization: Bearer <CRON_SECRET>`)

```
GET /api/sync/leagues?probe=<apiFootballId>&seasons=2025,2026   # sonda de cobertura
GET /api/sync/leagues/ingest?season=2026&league=liga_betplay    # 2 req por liga
GET /api/sync/leagues/calibrate?league=premier_league           # acotar o da 504
GET /api/tennis/sync?step=backtest&variant=tennis-2.0           # variants 1.0/1.1/1.2
GET /api/sync/smart-bets[?league=premier_league,la_liga]        # lectura en lote
```

**Regla de oro:** acotar siempre por liga. Cada liga cuesta 2 peticiones; correr
las seis a ciegas en bucle **agota la cuota diaria** (ya pasó).

---

## 8. Trampas conocidas (no repetir)

1. **Tope de 1.000 filas de PostgREST.** Ha mordido **cinco veces**; la
   penúltima falseando las precisiones del dashboard (mostraba `518/1000`
   cuando lo real era `1.039/2.058`) y la última dejando **894 de 1.894**
   partidos programados sin snapshot de Smart Bets, en silencio. Si ves un
   número redondo terminado en `/1000`, es esto.
   → Usar `count: 'exact', head: true` o `fetchAllRows`.
2. **Límite de 60 s en Vercel Hobby.** No ampliable. Toda operación masiva debe
   ser acotable por parámetro.
3. **Acceso por fila en bucle.** `syncSmartBetTracking` lanzaba ~5 consultas
   por partido programado (~9.470 en total): **449 s medidos**, imposible
   dentro de los 60 s. Resuelto en 2026-08 leyendo en lote — el número de
   consultas ahora depende de las **competiciones**, no de los partidos
   (19 consultas · 2,3 s medidos). Si un proceso nuevo recorre partidos uno a
   uno, este es el patrón a evitar.
4. **React inserta `<!-- -->`** entre texto estático y dinámico (`ATP #<!-- -->5`).
   Ha causado **dos falsas alarmas** en smokes. Limpiar comentarios antes del match.
5. **`tsx` en scripts sueltos no admite top-level await** → envolver en `main()`.
6. **Verificar la rama antes de commitear** (`git branch --show-current`): un
   commit se fue directo a `main` por un checkout olvidado.
7. **Ranking de tenis**: `tennis_rankings` **no** es foto semanal, son
   observaciones por partido. "La última fecha" ≠ "el ranking actual".
8. **Los smokes E2E asumen temporada empezada.** Cuatro de ellos van a la
   tabla de posiciones de la Premier, clican el primer equipo y esperan
   récord, forma y timeline. En 2026-27 la Premier, la Serie A, la
   Bundesliga y la Ligue 1 tienen **0 partidos finalizados**: la tabla sale
   vacía, no hay nada que clicar y los cuatro fallan. **No es una
   regresión** — comprobado el 2026-08-17 corriendo la misma suite contra el
   commit anterior: fallan idénticos. Antes de culpar a un cambio por un
   fallo de E2E, correr la línea base.

---

## 9. Pendientes priorizados

### Sin bloqueo (se puede hacer ya)
1. **Borrar `TournamentPathTracker`** — componente huérfano (0 usos).
2. **`is_active` en BD**: NBA y ATP están en `false` aunque el registro los
   trata como activos. Cosmético (la nav usa `lib/sports.ts`), pero conviene
   alinear.
3. **Validación anti-overfitting de tenis-2.0**: ingestar 2020-2023 a la BD y
   re-validar con split temporal real.
4. **Revisar los 343 usos de `text-[10px]`** (bajo el mínimo recomendado).
5. **`axe-core` en CI** para que la accesibilidad no vuelva a degradarse.
6. **Arreglar los 4 smokes E2E que asumen temporada empezada** (trampa §8.8):
   deberían saltarse solos, o apuntar a una temporada con partidos jugados,
   en vez de fallar cada vez que arranca una campaña nueva.
7. **Correr `/api/sync/smart-bets` en producción** y confirmar el tiempo real
   de extremo a extremo. La optimización se midió del lado de LECTURA (19
   consultas, 2,3 s); la escritura de picks no se pudo medir en el contenedor
   por no tener a mano la clave de service role.

### Requieren decisión o compra
8. **api-basketball Pro** → NBA temporada actual.
9. **Fuente de cuotas de tenis** → Fase 9 (Smart Bets tenis; el schema ya existe).
10. **¿Borrar el Mundial de verdad?** Hoy está archivado (datos intactos). Si se
   borra se pierden 91 predicciones resueltas al 83,5 % — el mejor historial
   del motor. **Recomendación: no borrarlo.**

---

## 10. Cómo retomar en un chat nuevo

Pega esto como primer mensaje:

> Proyecto **Veredicto · Inteligencia Deportiva** (`world-cup-predictor-2026`).
> Lee `HANDOFF.md` en la raíz: tiene objetivo, estado verificado, arquitectura,
> historial de motores, accesos, trampas conocidas y pendientes priorizados.
> Trabaja en la rama `claude/page-data-refresh-63yioa` y respeta las reglas
> innegociables de la §1 (Data First; medido, no prometido; aislamiento de
> dominios; gates antes de cada push).
> Empieza por: **\<tu tarea\>**.

Si `.env.local` o `node_modules` no existen (el contenedor los borra), ver §5.
