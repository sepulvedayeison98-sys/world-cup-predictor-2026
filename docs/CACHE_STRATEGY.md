# Estrategia de caché — Veredicto · Inteligencia Deportiva

> Documento de estrategia (2026-07-10). Cómo cachear toda la plataforma para
> que sea **rápida en el pico de la final** sin sacrificar frescura, y sin
> castigar a Supabase. Refleja el estado real del código + la pieza que falta
> (revalidación por evento).

---

## 0. Principio rector

**La app es 100% pública y sin autenticación → TODO es cacheable.** No hay datos
por-usuario que impidan servir HTML compartido. Es una ventaja enorme: podemos
cachear agresivo y proteger la base de datos bajo carga.

Regla de oro de caché:

> **Cachear por volatilidad del dato + purgar por evento.**
> El `revalidate` es el *peor caso* de frescura (staleness máxima). Los eventos
> (resultado de partido, recalibración) **purgan al instante** para que la
> frescura no dependa de esperar la ventana.

---

## 1. Las 5 capas

| # | Capa | Qué cachea | Control |
|---|------|-----------|---------|
| 1 | **Edge / CDN (Vercel)** | Output ISR/estático servido desde el edge | Automático |
| 2 | **ISR (servidor, por página)** | HTML de cada página, regenerado por ventana | `export const revalidate` |
| 3 | **On-demand revalidation** ✅ | Purga puntual cuando cambian los datos | `revalidatePath()` en el sync (lib/revalidate.ts) |
| 4 | **API route cache-control** | Respuestas JSON de `/api/*` | `Cache-Control: s-maxage` |
| 5 | **Cliente (React Query)** | Fetches de componentes cliente | `staleTime` + refetch en foco |

La capa 3 es la que **falta hoy** y la que elimina el desfase que se percibe
tras un resultado.

---

## 2. Tiers de ISR (por volatilidad del dato)

| Tier | `revalidate` | Páginas | Por qué |
|------|------------|---------|---------|
| **Vivo** | 60s | `dashboard`, `matches`, `matches/[id]` | marcadores y estados en vivo |
| **Jornada** | 120s | `mundial`, `groups`, `bracket`, `champion`(*), `predictions`, `value-bets`, `mundial/rankings` | cambian al cerrar cada partido |
| **Lento** | 300s | `ligas/*`, `nba/*`, `equipos/[id]`, `players/*`, `scorers`, `inteligencia`, `mundial/balance`, `simulation` | casi estáticos entre syncs |
| **Dinámico** | — | `admin`, `settings` | interactivos; nunca se cachean |

(*) `champion` está hoy en 300s; se puede bajar a 120s si se quiere que las
probabilidades de título refresquen más rápido tras cada partido. El resto del
config actual ya coincide con estos tiers.

**Frescura vs carga:** con ISR, 1.000 visitas simultáneas a `/matches` son
**1-2 queries por ventana**, no 1.000. Ese es el objetivo del pico de la final.

---

## 3. La pieza que falta: revalidación por evento (on-demand)

**Problema actual:** solo hay revalidación por tiempo. Cuando termina un partido,
el resultado entra a la BD enseguida, pero la página sigue sirviendo la copia
cacheada hasta que expira su ventana (60-120s), con *stale-while-revalidate*
(la primera visita tras expirar ve lo viejo mientras se regenera en segundo
plano). En sitio de bajo tráfico eso se siente "pegado" unos minutos.

**Solución:** que los procesos que cambian datos **purguen el caché al instante**.

- En `runPostResultChain` (tras resolver un partido) → `revalidatePath` de:
  `/`, `/dashboard`, `/matches`, `/matches/[id]` (el partido), `/predictions`,
  `/value-bets`, `/mundial`, `/mundial/balance`, `/mundial/rankings`, `/groups`,
  `/bracket`, `/champion`, `/inteligencia`, y `/equipos/[local]` + `/equipos/[visita]`.
- En `recalibratePredictions` → purgar `/predictions`, `/matches`, `/dashboard`,
  `/value-bets` (las que muestran probabilidades).
- Endpoint `/api/revalidate` (protegido con `CRON_SECRET`) para purga manual
  puntual cuando haga falta.

Efecto: el resultado aparece **en cuanto el sync lo procesa**, sin esperar la
ventana — y el resto del tiempo se mantiene el rendimiento del ISR.

**Nota técnica:** las páginas leen Supabase con el cliente propio (no el `fetch`
de Next), así que la herramienta correcta es `revalidatePath(path)`
(y `revalidatePath('/matches/[id]', 'page')` para el segmento dinámico), no
`revalidateTag` sobre `fetch`.

---

## 4. Rutas API (capa 4)

Ya configuradas con `s-maxage` + `stale-while-revalidate`:

| Ruta | Cache-Control | Comentario |
|------|--------------|-----------|
| `/api/matches/[id]/verdict` | `s-maxage=3600, swr=86400` | veredicto permanente |
| `/api/matches/[id]/events` | `s-maxage=300, swr=600` | línea de tiempo |
| `/api/matches/[id]/periods` | `s-maxage=300, swr=600` | cuartos NBA |
| `/api/nba/games` | `s-maxage=300, swr=1800` | calendario NBA |

Los `/api/sync/*` y `/api/admin/*` son `dynamic` y **no** se cachean (correcto).

---

## 5. Cliente (React Query, capa 5)

`staleTime` actual por componente, alineado con los tiers:

| Componente | staleTime | Alineación |
|-----------|-----------|-----------|
| Global (`QueryProvider`) | 60s | base |
| `MatchesTable` | 30s | vivo |
| `MyTeamsStrip`, `ProbabilityHistoryChart` | 60s | jornada |
| `PlayersTable`, `LineupDisplay` | 120s | lento |
| `AISmartBetsPanel` | 30 min | muy estable pre-partido |

**Mejora sugerida:** activar `refetchOnWindowFocus` en las queries sensibles a lo
vivo (matches, dashboard), para que al volver a la pestaña se refresque solo.

---

## 6. Partidos en vivo (caso especial)

El detalle de partido ya usa `LiveMatchRefresh` (client) que refetchea mientras
el partido está `live`. Patrón correcto: **la página ISR sirve el cascarón
cacheado y la frescura en vivo la aporta el cliente**. No se toca.

---

## 7. Qué implementar (orden)

1. ✅ **On-demand revalidation** (capa 3, hecho) — `revalidateAfterResults()`
   en `runPostResultChain` + `revalidatePredictionPaths()` en `recalibrate` +
   endpoint `POST /api/revalidate` (CRON_SECRET) para purga manual.
2. `refetchOnWindowFocus` en queries de vivo. Quick win.
3. (Opcional) bajar `champion` a 120s.

---

## 8. Qué NO hacer

- **No bajar todos los `revalidate` a segundos** — mataría el beneficio del ISR
  y golpearía Supabase en el pico. La frescura se gana con el evento (capa 3),
  no acortando ventanas a lo bruto.
- **No cachear `admin`/`settings`** ni las rutas `sync`/`admin`.
- **No cachear nada por-usuario** — no existe (sin auth), pero si algún día se
  agrega, ese contenido sale del caché compartido.
