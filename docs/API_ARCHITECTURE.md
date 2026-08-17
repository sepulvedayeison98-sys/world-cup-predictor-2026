# Arquitectura de datos deportivos

Cómo entran los datos externos a Veredicto, cómo se normalizan y cómo se
cambia de proveedor sin reconstruir la aplicación.

Fecha de la última verificación en vivo: **17 de agosto de 2026**
(`npm run verify:providers`, 17/17 comprobaciones en verde).

---

## 1. El problema que resuelve

Antes de esta capa, cada fuente externa se consumía desde su propio proceso de
sincronización, con su cliente HTTP, su manejo de errores y su mapeo a filas de
Supabase. Funcionaba, pero tenía tres costes:

- **Cambiar de proveedor era reescribir el proceso**, no sustituir un módulo.
- **Cada sync trataba los fallos a su manera.** Una cuota agotada y una caída
  de red acababan en el mismo `catch`.
- **Ninguna fuente declaraba qué NO cubría**, así que un hueco de datos se
  parecía demasiado a un dato vacío.

La capa `services/sports/` corrige eso sin tocar lo que ya funciona: los procesos
de ingesta existentes siguen en `services/sync/` y se pueden migrar uno a uno.

## 2. El flujo

```
API externa
    ↓  cliente HTTP (timeout, reintentos, clasificación de errores)
Provider
    ↓  adapter (traduce la forma cruda de ESA API)
Modelo interno normalizado
    ↓  service (caché, cadena de respaldo, DataResult)
Ruta interna /api/*  o  Server Component
    ↓
Interfaz
```

La interfaz **nunca** conoce a un proveedor. Pide "las noticias de tenis" y
recibe un `DataResult`; quién las sirve hoy es una decisión de configuración.

## 3. Mapa de archivos

```
services/sports/
├── core/                    ← NEUTRO: no conoce deportes ni proveedores
│   ├── types.ts             modelos normalizados + DataResult
│   ├── errors.ts            taxonomía + mensajes en español + redacción de claves
│   ├── http.ts              fetch con timeout, backoff y clasificación
│   ├── cache.ts             TTL por clase de dato + memo en proceso
│   ├── ports.ts             contratos que cumple todo proveedor
│   ├── resolve.ts           ejecuta la cadena de proveedores
│   └── registry.ts          ÚNICO sitio que decide quién sirve qué
│
├── providers/               ← traductores, uno por fuente
│   ├── api-football/        client.ts · shapes.ts · football.provider.ts
│   ├── espn/                client.ts · shapes.ts · normalize.ts
│   │                        soccer|nba|tennis|news .provider.ts
│   └── the-odds-api/        odds.provider.ts
│
├── football/football.service.ts
├── nba/nba.service.ts
├── tennis/tennis.service.ts
├── odds/odds.service.ts
└── news/news.service.ts
```

## 4. Stack de proveedores

| Módulo | Primario | Respaldo | Coste | Estado |
|---|---|---|---|---|
| Fútbol | **API-Football** (Pro, 7.500/día) | ESPN | de pago | ✅ verificado |
| NBA | **ESPN** | — | gratis | ✅ verificado |
| Tenis | **ESPN** (circuito actual) | Sackmann CSV (histórico) | gratis | ✅ verificado |
| Cuotas | **The Odds API** | — | de pago | ⚪ sin clave en local |
| Noticias | **ESPN** | — | gratis | ✅ verificado |

### Por qué cada uno

**Fútbol → API-Football.** Es la única fuente evaluada que entrega plantillas,
partes de lesiones, alineaciones con formación y estadísticas por jugador. Sin
eso, un "perfil completo de equipo" es un listado de partidos con escudo. El
plan Pro ya está contratado y a 7.500 peticiones diarias la cuota no es la
restricción.

**NBA → ESPN, no api-basketball.** La misma cuenta de api-sports tiene Pro en
fútbol pero sigue en **Free en baloncesto**: 100 peticiones al día y sin acceso
a la temporada en curso. ESPN sirve calendario, marcadores por cuarto y
clasificación por conferencia sin clave y sin ese techo. La decisión desbloquea
la temporada actual sin comprar nada. Si algún día se contrata api-basketball,
se escribe su adapter contra el mismo puerto y se mueve `BASKETBALL_PROVIDER`.

**Tenis → ESPN.** `docs/TENNIS_ARCHITECTURE.md` daba el calendario, los
resultados y el ranking actuales por bloqueados a la espera de comprar una API
comercial. **No lo están.** ESPN publica los tres, con sets, tie-breaks, ronda y
ganador. Los CSV de Sackmann siguen siendo la base histórica del backtesting:
son necesidades distintas y conviene que sigan separadas.

**Noticias → ESPN.** El módulo no tenía fuente. Las alternativas con clave
(NewsAPI, GNews) devuelven prensa generalista filtrada por palabra clave. ESPN
publica un feed atado a cada liga y circuito, que para una plataforma que
contextualiza partidos concretos vale bastante más.

### Proveedores evaluados y descartados

| Candidato | Por qué no |
|---|---|
| **sportsdataverse-js** (MIT, 80★, TS) | El repositorio más sólido del sector, y del que salen los patrones de endpoints ESPN de esta capa. **No se instala**: arrastra `cheerio`, `tabletojson`, `papaparse` y `@tidyjs/tidy` para hacer scraping que aquí no se usa, es ESM-only y añade peso de arranque a funciones serverless. Se extrajeron los conceptos, no el paquete. |
| **BallDontLie** | Solo NBA, y su SDK de TypeScript tiene 9 estrellas y poco mantenimiento. ESPN cubre lo mismo sin dependencia. |
| **Sportmonks** | Buena API de fútbol, pero duplicaría lo que API-Football ya cubre y ya está pagado. Los dos SDK de TS que existen tienen 1 estrella y uno está archivado. |
| **SportsDataIO** | Cobertura fuerte en deportes de EE. UU.; precio y contrato desproporcionados para lo que falta. |
| **TheSportsDB** | Útil para escudos y metadatos, pero sin estadísticas serias ni garantías de actualización. |
| **api-basketball** | Se mantiene como opción; hoy el plan Free lo deja fuera de la temporada en curso. |

Regla que se siguió: **no usar dos APIs para el mismo dato salvo razón técnica
clara.** La única redundancia es ESPN como respaldo de fútbol, y existe porque
API-Football tiene cuota diaria y ESPN no.

## 5. Modelos normalizados

Definidos en `core/types.ts`. Dos principios los gobiernan:

**Data First.** Un campo que la fuente no entrega es `null`, nunca un cero de
relleno. Por eso casi todo es opcional: la ausencia es información. Ejemplos
concretos que están en el código:

- `Standing.drawn` y `Standing.points` son `null` en la NBA — allí no hay
  empates y no se ordena por puntos. Un `0` afirmaría algo falso.
- `TennisMatch.surface` es `'unknown'` con ESPN: no publica la superficie en el
  marcador, y estimarla por el nombre del torneo sería inventarla.
- `Team.honours` y `Team.founded` son `null` en ESPN y `founded` llega relleno
  con API-Football.
- `TeamStats.metrics` es un mapa: una métrica ausente **no aparece**, que es
  distinto de aparecer con valor 0.

**Aislamiento.** Los deportes con estructura distinta tienen tipos distintos.
Un partido de tenis no es un `Fixture` con dos "equipos" de un jugador: es un
`TennisMatch`, con `sets`, `tiebreak` y `round`.

Cada payload viaja con su `Provenance` (`provider`, `endpoint`, `fetchedAt`),
que es lo que permite responder "¿de dónde salió este número?".

## 6. Los tres estados de una respuesta

`DataResult<T>` obliga a distinguir lo que antes se confundía:

```ts
{ status: 'ok', data, provenance, stale }
{ status: 'unsupported', reason, provider }   // ninguna fuente lo cubre
{ status: 'error', reason, retryable, provider }
```

`unsupported` es la pieza que impide mentir. Si el proveedor activo no publica
lesiones, la sección **se oculta**; no se pinta una lista vacía que el usuario
leería como "este equipo no tiene bajas".

Cada proveedor declara sus `capabilities` y el servicio las consulta antes de
gastar red.

## 7. Caché

Política por clase de dato en `core/cache.ts`, no un TTL único:

| Clase | TTL | Qué cubre |
|---|---|---|
| `live` | 30 s | marcadores en vivo |
| `odds` | 5 min | cuotas |
| `lineups` | 10 min | alineaciones |
| `standings` | 15 min | clasificaciones |
| `news` | 15 min | noticias |
| `schedule` | 30 min | calendario |
| `seasonStats`, `injuries` | 1 h | estadísticas de temporada, partes médicos |
| `roster` | 6 h | plantillas |
| `catalog` | 12 h | competiciones, temporadas |
| `static` | 24 h | estadios, escudos, fundación |
| `historical` | 7 d | resultados cerrados (inmutables) |

Dos niveles: el `revalidate` de Next (caché compartida, es la que ahorra cuota
de verdad) y un memo en proceso que evita que varios componentes de la misma
petición repitan la llamada. El memo guarda la **promesa**, así que tres
llamadas concurrentes comparten una sola petición de red; un fallo nunca se
cachea.

## 8. Errores

Taxonomía en `core/errors.ts`: `config`, `auth`, `rate_limit`, `not_found`,
`timeout`, `unavailable`, `parse`, `upstream`.

Solo son reintentables `rate_limit`, `timeout` y `unavailable`. Reintentar un
`auth` o un `parse` es quemar cuota sin ninguna posibilidad de éxito.

Cada tipo tiene una frase en español lista para pintar, **sin código HTTP, sin
nombre de proveedor y sin ruta**. Hay un test que lo verifica para los ocho
tipos.

Dos particularidades que la capa absorbe:

- **API-Football responde 200 con el campo `errors` poblado** cuando falla de
  verdad. Un cliente normal lo daría por bueno; el nuestro lo inspecciona y
  distingue cuota agotada de plan insuficiente.
- **The Odds API manda la clave en el query string.** `redactUrl()` la borra
  antes de cualquier log.

### Política de la cadena

1. Un proveedor que no declara la capacidad se salta sin gastar red.
2. Un `not_found` **no** cae al respaldo: el recurso no existe y preguntar a
   otra fuente sería tratarlo como avería.
3. Cualquier otro fallo cae al siguiente de la cadena.
4. Si todos fallan, se devuelve el error del **primario**, que explica mejor.

## 9. Variables de entorno

Todas en `.env.example`. Ninguna lleva `NEXT_PUBLIC_` y ninguna debe llevarlo:
se leen solo en servidor.

| Variable | Módulo | Obligatoria |
|---|---|---|
| `SPORTS_API_KEY` | fútbol (API-Football) | sí, para fútbol |
| `SPORTS_API_HOST` | fútbol | no (defecto `v3.football.api-sports.io`) |
| `FOOTBALL_API_SEASON` | fútbol | no (defecto 2024) |
| `ODDS_API_KEY` | cuotas | sí, para cuotas |
| `FOOTBALL_PROVIDER` | selección de fuente | no |
| `BASKETBALL_PROVIDER` | selección de fuente | no |
| `TENNIS_PROVIDER` | selección de fuente | no |
| `ODDS_PROVIDER` | selección de fuente | no |
| `NEWS_PROVIDER` | selección de fuente | no |

ESPN no necesita ninguna.

## 10. Cómo cambiar de proveedor

1. Escribe el adapter en `providers/<nombre>/`, cumpliendo el puerto de
   `core/ports.ts` y declarando solo las capacidades que **de verdad** cubre.
2. Registra el adapter en el catálogo correspondiente de `core/registry.ts`.
3. Cambia la variable de entorno del módulo. Admite cadena:
   `FOOTBALL_PROVIDER=espn,api-football` invierte la preferencia.

No se toca ningún servicio, ninguna ruta y ningún componente. Hay un test que
lo garantiza: si un `.service.ts` importa un proveedor concreto, falla.

## 11. Cómo añadir otro deporte

1. Añade el `SportKey` en `core/types.ts` y, si su estructura es distinta de
   equipo-contra-equipo, su tipo de partido propio.
2. Define su puerto en `core/ports.ts`.
3. Escribe el adapter y regístralo.
4. Crea `services/sports/<deporte>/<deporte>.service.ts`.
5. Añade el deporte a la matriz de `tests/sportsArchitecture.test.ts` y al
   override de `.eslintrc.json`, para que nazca con las barreras puestas.

## 12. Verificación

```bash
npm run type-check          # TypeScript
npm test                    # 34 tests offline de esta capa (+ los del resto)
npm run lint                # incluye las barreras de aislamiento
npm run verify:providers    # llama a las APIs de verdad
npm run build
```

`verify:providers` es el que responde "¿sigue funcionando hoy?". Los adapters
pueden compilar y pasar todos los tests con la fuente rota: ninguna de estas
APIs publica un contrato estable. Consume unas 6 peticiones de API-Football y
1 de The Odds API; ESPN no tiene cuota.

La última corrida encontró dos defectos reales que ningún test offline habría
visto: ESPN devuelve `flag` como string en el ranking y como objeto en el
marcador (el país salía `null` la mitad de las veces), y el calendario de
torneos sin rango de fechas devolvía solo el día de hoy (1 torneo en vez de 60).
Ambos están corregidos y cubiertos por test.

## 13. Lo que esta capa todavía no hace

Honestidad sobre el alcance:

- **Los procesos de ingesta siguen en `services/sync/`** con sus clientes
  propios. La capa nueva no los reemplaza todavía; están pensados para migrar
  uno a uno, empezando por el que menos riesgo tenga.
- **La interfaz aún no consume estos servicios** salvo `/api/news`. Las páginas
  siguen leyendo de Supabase, que es lo correcto para datos ya ingestados.
- **Faltan datos, no código**, en varios módulos: 78 jugadores de fútbol en
  base, 3 lesiones, 2 alineaciones. El adapter ya sabe traerlos; hace falta el
  proceso de ingesta que los persista.
- **Búsqueda global**: cubre equipos y tenistas. Jugadores de fútbol y NBA
  entrarán cuando haya datos que buscar.
