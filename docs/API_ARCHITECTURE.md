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

## 13. Ingesta de plantillas, lesiones y alineaciones

`services/sync/football-roster.ts` es el primer proceso de sincronización que
consume esta capa en vez de hablar con la API directamente. Pide "la plantilla
del equipo 33" y recibe un `DataResult`; no sabe que existe API-Football.

```
GET /api/sync/roster?entity=squads|injuries|lineups&league=premier_league
```

Una entidad por corrida, y por un motivo concreto: las plantillas cuestan una
petición **por equipo** (120 para las seis ligas) y las alineaciones una **por
partido**. Encadenarlas se comería el techo de 60 s de Vercel Hobby. El proceso
lleva presupuesto de tiempo propio y, si se queda corto, responde
`truncated: true` en vez de morir a medias; como todo son upserts por clave
natural, basta con volver a llamar.

**El orden importa**: `squads` antes que `injuries` y `lineups`, que
referencian jugadores.

### Lo que la migración 057 tuvo que cambiar, y por qué

El esquema venía del Mundial, con 48 selecciones cargadas a mano: exigía
dorsal, nacionalidad, fecha de nacimiento y posición exacta de cada jugador.
API-Football no da nada de eso en el endpoint de plantillas. Cuando el esquema
pide un dato que la fuente no tiene, solo hay dos salidas — inventarlo o
relajar la columna. Se relajó.

La decisión de más peso fue `injuries.impact_score`. Era `NOT NULL DEFAULT 5`
y la columna **alimenta al motor**: `recalibrate.ts` suma el impacto de las
lesiones activas por equipo. Ingestar con el valor por defecto habría metido
decenas de cifras inventadas directamente en las predicciones. Ahora es
nullable y se ingesta en `NULL`: la lesión se ve en la ficha porque es cierta,
y no mueve el modelo porque su impacto no lo sabemos.

En la misma línea, `position` solo se rellena para `Goalkeeper → GK`, que es la
única equivalencia exacta. "Defender" no se convierte en "CB": el texto de la
fuente se guarda entero en `position_raw`.

### Resultado de la primera corrida (17 ago 2026)

| Tabla | Antes | Después |
|---|---|---|
| `players` | 78 (solo Mundial) | **3.761** |
| `injuries` | 3 | **34** (19 activas, 31 sin impacto declarado) |
| `lineups` | 2 | **10** |
| `lineup_players` | 32 | **211** |

Tres cosas que solo aparecieron al correrlo de verdad:

- **El índice único no podía ser parcial.** PostgREST resuelve el upsert con
  `ON CONFLICT (team_id, api_football_id)` y Postgres no empareja esa cláusula
  con un índice parcial. Fallaba con "no unique or exclusion constraint
  matching the ON CONFLICT specification".
- **La cuota que se agota es la de POR MINUTO, no la diaria** — saltó con la
  diaria en 61 de 7.500. Perseguirla destapó dos fallos propios, uno de
  ellos serio: se estaban cacheando las respuestas de error. Está en §14,
  porque la lección vale para cualquier proveedor que se añada después.
- **La fuente omite jugadores de la plantilla.** 11 de 31 lesionados de La
  Liga y 19 de 179 fichas de un once no aparecían en `/players/squads`
  (lesionados de larga duración, canteranos convocados, fichajes recién
  inscritos). Descartarlos dejaba fuera justo las lesiones que más pesan. El
  propio parte trae id, nombre y equipo, así que se crea la ficha mínima con
  eso —dato de la fuente— y el resto de campos en `null`. Tras el cambio:
  0 descartes en ambos casos.

### Cobertura por liga, hoy

Las lesiones de la temporada 2026-27 todavía no están en la fuente para todas
las ligas: La Liga publica 31 partes, Premier League y Liga BetPlay ninguno.
No es un fallo de la ingesta — es que la fuente aún no los tiene. Se verá
crecer conforme avance la temporada.

## 14. El fallo que costó tres diagnósticos

Merece quedar escrito porque las dos primeras explicaciones eran razonables
y las dos estaban mal.

**Síntoma.** La ingesta de plantillas perdía siempre los mismos equipos, con
las mismas cifras exactas —585, 484, 494, 576— corrida tras corrida. El error
era `{"rateLimit":"Too many requests…"}` con la cuota **diaria intacta** (61
de 7.500).

**Lo que se descartó, midiendo:**

| Hipótesis | Prueba | Resultado |
|---|---|---|
| Volumen por minuto | 60 peticiones seguidas | 0 rechazos |
| Concurrencia | 8 a la vez, tres rondas | 0 rechazos |
| Ráfaga acumulada | 45 s de pausa entre ligas | seguía fallando |
| Equipos concretos rotos | los 3 que fallaban, uno a uno | los 3 responden |

La pista buena fue el **determinismo**. Un límite de ráfaga produce fallos
que se mueven; estos caían siempre en los mismos equipos y devolvían la misma
cifra al milímetro. Eso no es un límite: es algo guardado.

**Las dos causas reales**, y la segunda escondía a la primera:

1. **El reintento no se ejecutaba nunca.** api-sports responde **200 con
   `errors` poblado**, así que la comprobación vivía después del `await`,
   fuera del bucle de reintentos. El backoff de `rate_limit` era código
   muerto. Se arregla con el callback `validate` de `core/http.ts`, que corre
   **dentro** del bucle. Tiene test de regresión.

2. **La caché de datos de Next estaba guardando las respuestas de error.**
   Para Next, un 200 es un 200: cacheó el rechazo puntual y lo sirvió durante
   las seis horas del TTL. De ahí el determinismo perfecto, y de ahí que el
   mismo código ejecutado fuera de Next trajera las seis ligas completas.
   **Cachear una API que reporta errores en cuerpos 200 es cachear sus
   fallos.** api-football ya no usa la caché HTTP; el ahorro de llamadas lo
   da el `memo` de la capa de servicios, que sí distingue error de dato
   porque vive por encima de `validate`.

**Lo que quedó montado**, tres capas que se cubren entre ellas:

- Sin caché HTTP en api-football — elimina la causa que envenenaba.
- Reintento con backoff de 2/4/8 s para `rate_limit` — reacciona al rechazo.
- `core/rateLimit.ts` a 30/min (`FOOTBALL_API_RPM`) más 45 s entre ligas en
  el workflow — freno de mano. El techo real no está caracterizado, así que
  el número es conservador, no medido.

**Verificado**: seis ligas por HTTP contra el build de producción, 3.652
jugadores, 0 problemas.

Lección transferible para el siguiente proveedor que se añada: **si una API
señala errores dentro de cuerpos 200, no la pongas detrás de una caché por
URL**, y comprueba el cuerpo dentro del bucle de reintentos, no después.

## 15. Lo que todavía no hace

- **El resto de procesos de ingesta siguen en `services/sync/`** con sus
  clientes propios. Migrarlos uno a uno, empezando por el de menos riesgo.
- **La interfaz aún no pinta plantillas, lesiones ni alineaciones.** Los datos
  ya están en base; falta la capa visual en el perfil de equipo y en la ficha
  de partido.
- **Falta enriquecer la ficha del jugador**: nacionalidad, fecha de nacimiento
  y altura viven en otro endpoint de API-Football, no en el de plantillas.
- **`impact_score` sigue sin fuente.** Cuantificar cuánto pesa una baja es un
  problema de modelo, no de ingesta, y merece su propio diseño con backtest.
- **Búsqueda global**: cubre equipos y tenistas. Ahora que hay 3.761 fichas de
  fútbol, incluir jugadores es el siguiente paso natural.
