# 🔍 Auditoría Técnica — World Cup Predictor 2026

> Revisión pre-producción · Fecha: 2026-06-14 · Alcance: `app/`, `components/`, `services/`, `hooks/`, `lib/`, `types/`, `supabase/migrations/`

---

## 1. Resumen ejecutivo

El proyecto está **sorprendentemente completo para su etapa**: arquitectura Next.js 15 sensata (Server Components para fetch inicial, Client Components para interactividad), esquema de base de datos rico y bien indexado, datos reales del Mundial, motor de predicción calibrado con el mercado, sync de datos en vivo y deploy funcionando. Es **usable hoy**.

Pero **no está listo para producción seria**. Hay un dato fabricado en la página principal (ROI), tipado prácticamente inexistente (`any` en todo el acceso a datos), varias consultas que **no escalarán** cuando se carguen las plantillas completas (~1200 jugadores), código muerto heredado del modelo con auth, y manejo de errores ausente que ya ocultó un bug grave esta semana.

**Nivel de madurez: BETA avanzada.** Funciona y se ve profesional, pero tiene deuda técnica que escalará mal y un par de cosas que afectan la credibilidad del producto. Con 2-3 lotes de arreglos enfocados queda listo para producción.

| Severidad | Cantidad |
|---|---|
| 🔴 Crítico | 2 |
| 🟡 Importante | 11 |
| 🟢 Menor | 9 |

---

## 2. Hallazgos por severidad

### 🔴 CRÍTICO

---

#### 🔴-1 · ROI fabricado en el dashboard
- **Archivo:** `app/dashboard/page.tsx:51`
- **Problema:** El KPI de ROI está hardcodeado: `roi: 8.4, // Will be computed from bet history`. La página principal muestra **"+8.4%"** como rendimiento del modelo, pero no hay ningún historial de apuestas resueltas que lo respalde (de hecho `value_bets_won = 0`).
- **Impacto:** Es un dato **falso presentado como real** en la cara más visible de una app pública de predicción/apuestas. Mina por completo la credibilidad y roza lo engañoso para un producto de esta naturaleza.
- **Solución:** Calcular el ROI real a partir de `value_bets` con `result IN ('won','lost')`, o mostrar **"—"** / "Sin datos" mientras no haya apuestas resueltas. Lo mismo aplica a `value_bets_won: 0` y la precisión.

---

#### 🔴-2 · La "forma" (W/D/L) de los standings se calcula mal ordenada
- **Archivo:** `supabase/migrations/001_initial_schema.sql:607`
- **Problema:** `array_agg(result ORDER BY result)` ordena la racha **alfabéticamente por el enum** (D, L, W), no cronológicamente. La "forma reciente" que se muestra en las tablas de grupos queda agrupada y sin sentido temporal (p. ej. siempre `[D, L, W, W]` ordenado), no la secuencia real de los últimos partidos.
- **Impacto:** Dato incorrecto visible en las tablas de grupos. Pequeño en superficie, pero es información engañosa.
- **Solución:** Ordenar por fecha del partido: `array_agg(result ORDER BY m.kickoff_time)` (requiere arrastrar `kickoff_time` en el CTE `match_results`), y opcionalmente limitar a los últimos 5.

---

### 🟡 IMPORTANTE

---

#### 🟡-3 · Tipado `any` en todo el acceso a datos
- **Archivo:** `types/database.ts` (completo)
- **Problema:** `Database` define `Row: Record<string, any>` para todas las tablas. El tipado es efectivamente `any`, por eso hay casts `(x as any)` y `: any` por todo el código (servicios, rutas, componentes). TypeScript no protege contra typos de columnas ni cambios de schema.
- **Impacto:** Cero seguridad de tipos en la capa de datos; los bugs de datos llegan a runtime. Deuda que crece con cada feature.
- **Solución:** Regenerar el tipado real: `npx supabase gen types typescript --project-id jruanwjjsygcmmvwxexh > types/database.ts` y tipar los clientes Supabase con `<Database>`. Luego ir quitando los `as any`.

---

#### 🟡-4 · Consultas que NO escalan con las plantillas (~1200 jugadores)
- **Archivos:** `services/teams.service.ts:83` (`playersService.getPlayers`) · `app/players/page.tsx:21` (agregado de stats)
- **Problema:** `getPlayers` hace `select('*, team:teams(*), player_statistics(*)')` **sin `limit` ni paginación**, ordenado por nombre. La página de Jugadores los pinta todos. El agregado de KPIs trae **todas** las filas de `player_statistics` para sumarlas en JS. Hoy con ~150 jugadores va bien; con los ~1200 de la migración 008 (pendiente) será una consulta y un render pesadísimos.
- **Impacto:** La página de Jugadores se volverá lenta justo cuando se complete el dato más esperado.
- **Solución:** Paginar `getPlayers` (server-side, p. ej. 30/pág con `.range()`), seleccionar solo columnas necesarias, y mover los KPIs a un agregado SQL (`sum()`/RPC) en vez de traer todo.

---

#### 🟡-5 · N+1 + doble fetch en el widget de próximos partidos
- **Archivo:** `components/dashboard/UpcomingMatchesWidget.tsx:124`
- **Problema:** `getUpcomingMatches(6)` **ya trae** la predicción embebida (`predictions(*)`, ver `services/matches.service.ts:102`), pero cada `MatchCard` lanza **otra** query por partido: `predictionsService.getPredictionByMatchId(match.id)`. Son 6 queries extra redundantes en el dashboard, además de la del propio widget.
- **Impacto:** N+1 clásico + datos pedidos dos veces. Latencia y carga innecesaria en la página más visitada.
- **Solución:** Usar la predicción que ya viene embebida en `match` (manejando que PostgREST la devuelve como objeto por `UNIQUE(match_id)`); eliminar el `useQuery` por tarjeta.

---

#### 🟡-6 · Funciones `SECURITY DEFINER` sin `search_path` fijo
- **Archivos:** `001_initial_schema.sql:563` (`recalculate_group_standings`), `003_realtime_and_sync.sql:62` (`notify_value_bet`), `003:89` (`notify_injury`)
- **Problema:** Tres funciones `SECURITY DEFINER` (corren con privilegios del owner) no fijan `search_path`. Es el patrón que el propio linter de Supabase marca como riesgo de *search_path injection* / escalada de privilegios.
- **Impacto:** Hardening de seguridad. Explotabilidad baja en este setup gestionado, pero es una mala práctica real que conviene cerrar antes de producción.
- **Solución:** Añadir `SET search_path = public, pg_catalog` a cada función (o `SECURITY INVOKER` donde aplique).

---

#### 🟡-7 · Rutas API muertas/engañosas (heredadas del modelo con auth)
- **Archivos:** `app/api/predictions/route.ts:62`, `app/api/odds/route.ts:63`, `app/api/simulation/route.ts:11`
- **Problema:** Las tres rutas POST exigen usuario autenticado (`if (!user) 401`), pero la app es de **acceso libre sin auth** → **siempre devuelven 401** y son inalcanzables. El motor real corre por SQL (migración 006) y por los `/api/sync/*` con service-role. Estas rutas son código muerto que aparenta ser el camino "oficial".
- **Impacto:** Confusión de mantenimiento; un dev nuevo asume que ese es el flujo. El simulador "Guardar escenario" parece que usa `/api/simulation` pero no lo hace (ver 🟢-17).
- **Solución:** Decidir por feature: (a) eliminarlas, o (b) reescribirlas para que el motor sea invocable desde un panel admin protegido por `CRON_SECRET`/service-role en vez de auth de usuario. **Requiere decisión de producto** (¿habrá panel admin?).

---

#### 🟡-8 · La tabla `odds` crece sin límite (sin retención)
- **Archivos:** `services/sync/odds.ts` (inserta ~4.485 filas por corrida) · `001:351` (sin TTL)
- **Problema:** Cada sync de cuotas inserta miles de filas en `odds` y **nada las limpia**. La vista de consenso (migración 011) filtra a 48h, pero las filas crudas quedan para siempre. En semanas de torneo serán cientos de miles de filas.
- **Impacto:** Crecimiento de almacenamiento y degradación de queries sobre `odds` con el tiempo.
- **Solución:** Job de retención (purgar `odds` con `recorded_at < now() - interval '7 days'`), o guardar solo un snapshot agregado por partido/mercado en vez de cada cuota de cada casa.

---

#### 🟡-9 · El sync de value bets no es transaccional (ventana de pérdida de datos)
- **Archivo:** `services/sync/odds.ts` (delete + insert)
- **Problema:** El sync **borra todos** los `value_bets` de los partidos y luego inserta los nuevos, sin transacción. Si el insert falla a mitad (error de red, datos inválidos), la tabla queda **vacía** hasta el próximo sync exitoso.
- **Impacto:** La página de Apuestas de Valor puede quedar en blanco tras un fallo parcial de sync.
- **Solución:** Envolver delete+insert en una función RPC transaccional de Postgres, o solo borrar tras un insert exitoso (insertar a tabla temporal y hacer swap).

---

#### 🟡-10 · Tormenta de invalidaciones Realtime durante el sync
- **Archivo:** `hooks/useRealtimeMatches.ts:81` (+ trigger `notify_value_bet`)
- **Problema:** El sync de cuotas hace delete+insert de ~363 `value_bets` → eso dispara ~363 eventos Realtime `INSERT` → **363 invalidaciones de caché** en cada cliente que esté viendo la app (y 363 ejecuciones del trigger `notify_value_bet`). La recalibración actualiza 67 predicciones → 67 eventos más. Sin *debounce*.
- **Impacto:** Tirones/refetch en masa en los clientes justo cuando corre un sync.
- **Solución:** *Debounce* de las invalidaciones (agrupar en una sola tras N ms), o emitir un único evento de "sync completado" por un canal de broadcast en vez de por fila.

---

#### 🟡-11 · Manejo de errores ausente en los Server Components
- **Archivos:** `app/dashboard/page.tsx`, `app/groups/page.tsx`, `app/predictions/page.tsx`, `app/value-bets/page.tsx`, `app/players/page.tsx`
- **Problema:** Todas las páginas server hacen `const { data } = await supabase...` e **ignoran el campo `error`**. Si la query falla, renderizan vacío en silencio. **Exactamente este patrón ocultó el bug de los GRANT** esta semana (la app salía vacía sin ningún error). No hay `app/error.tsx`.
- **Impacto:** Fallos invisibles; depuración a ciegas; mala UX (página en blanco en vez de "algo salió mal").
- **Solución:** Capturar `error` y registrar/mostrar un estado de error; añadir `app/error.tsx` (error boundary global) y un estado de "sin datos" explícito.

---

#### 🟡-12 · Lógica duplicada: Kelly/EV (×3) y motor de predicción (×3)
- **Archivos:** Kelly/EV en `lib/utils.ts:47`, `lib/valueBets.ts:21`, `app/api/odds/route.ts:21` · Motor en `app/api/predictions/route.ts`, `lib/predictionEngine.ts`, `services/predictions.service.ts:132`
- **Problema:** Hay **tres** copias de `kellyFraction`/`expectedValue`/`gradeEV` y **tres** implementaciones distintas del motor de predicción (con fórmulas ligeramente diferentes entre sí). Es fácil arreglar una y dejar las otras desincronizadas.
- **Impacto:** Inconsistencias sutiles, doble mantenimiento, bugs difíciles de rastrear.
- **Solución:** Consolidar en `lib/valueBets.ts` y `lib/predictionEngine.ts` como única fuente de verdad; que las rutas y servicios importen de ahí. Borrar `predictions.service.ts:computePrediction` y los duplicados de `utils.ts` si no se usan.

---

#### 🟡-13 · Tablas no responsive en móvil
- **Archivos:** `components/matches/MatchesTable.tsx`, `components/predictions/PredictionsTable.tsx`, `components/predictions/ValueBetsFullTable.tsx`, `components/players/PlayersTable.tsx`
- **Problema:** Son tablas anchas (10-12 columnas) dentro de `overflow-x-auto`. En móvil obligan a scroll horizontal y muchas columnas quedan cortadas. (El layout/sidebar ya se arregló esta semana; las tablas no.)
- **Impacto:** UX móvil pobre en las vistas con más datos, en una app que debe verse bien en celular.
- **Solución:** En pantallas chicas, renderizar tarjetas apiladas (1 partido/predicción por card) en vez de filas de tabla; o priorizar 3-4 columnas clave y ocultar el resto tras un "ver más".

---

### 🟢 MENOR

---

- **🟢-14 · "Modelo v1.0.0" hardcodeado** en `app/dashboard/page.tsx:72` y `app/predictions/page.tsx:36`, cuando las predicciones reales ya son `v1.1.0` (calibradas). Inconsistente. → Leer el `model_version` real o centralizar la constante.

- **🟢-15 · GroupStandingsWidget fijo al grupo "C"** en `app/dashboard/page.tsx:94` (`groupLetter="C"`). El dashboard solo muestra ese grupo. → Mostrar el grupo del próximo partido o rotar.

- **🟢-16 · Botones inertes en el Topbar** — Buscar (`components/layout/Topbar.tsx:43`) y Notificaciones (`:49`) no tienen `onClick` (no hacen nada). El avatar "A" está hardcodeado. → Implementarlos o quitarlos para no prometer funciones que no existen.

- **🟢-17 · "Guardar escenario" del simulador es solo local** — `components/simulation/SimulationEngine.tsx:277` guarda en `useState` (se pierde al recargar); no persiste. `/api/simulation` es código muerto (y requiere auth). → Decidir si se persiste (requiere repensar sin auth) o aclarar en UI que es temporal.

- **🟢-18 · `kellyFraction` sin guardia de división por cero** en `lib/utils.ts:47` (con `odds=1`, `b=0` → `NaN`). `lib/valueBets.ts:30` sí la tiene. → Añadir `if (b <= 0) return 0` (o eliminar el duplicado, ver 🟡-12).

- **🟢-19 · El enum `match_phase` no contempla `round_of_32`** (`001:13`). El Mundial de 48 equipos arranca eliminatorias en **dieciseisavos**, que hoy no se pueden modelar. → Añadir `round_of_32` al enum antes de cargar la fase final.

- **🟢-20 · Contraste/accesibilidad** — abundante texto `text-[9px]`/`text-[10px]` en `zinc-600` sobre `zinc-900/950` (bajo contraste, difícil de leer). Algunos controles sin `<label>` asociado. → Subir tamaños/contraste mínimos y asociar labels.

- **🟢-21 · `prediction_history` crece sin límite** — el trigger `snapshot_prediction` (`001:660`) inserta una fila por cada cambio de probabilidad; cada recalibración actualiza ~67 predicciones → ~67 filas/corrida. → Retención o snapshot menos frecuente.

- **🟢-22 · Código muerto** — `matches.service.ts:getValueBets` (cliente) no se usa (la página de value-bets usa query server). → Eliminar.

---

## 3. Plan de acción priorizado

**Lote 1 — Credibilidad y robustez (rápido, alto impacto):**
1. 🔴-1 ROI real (o "—") + quitar métricas fabricadas del dashboard.
2. 🔴-2 Arreglar el orden de la `form` en standings (migración nueva).
3. 🟡-11 Manejo de errores + `app/error.tsx`.
4. 🟢-14 Unificar la versión del modelo.

**Lote 2 — Escalabilidad (ANTES de cargar las plantillas 008):**
5. 🟡-4 Paginar/limitar Jugadores + KPIs por agregado SQL.
6. 🟡-5 Quitar el N+1 del widget de próximos partidos.
7. 🟡-8 Retención de `odds`.
8. 🟡-9 Sync de value bets transaccional.

**Lote 3 — Seguridad y limpieza:**
9. 🟡-6 `search_path` en funciones `SECURITY DEFINER`.
10. 🟡-7 Resolver las rutas API muertas (decisión de producto).
11. 🟡-12 Deduplicar Kelly/EV y motor de predicción.
12. 🟡-10 Debounce de invalidaciones Realtime.

**Lote 4 — Pulido y UX:**
13. 🟡-13 Tablas responsive (tarjetas en móvil).
14. 🟢 16/17/18/19/20/21/22 (botones, simulador, accesibilidad, enum, retención, código muerto).

---

## 4. Recomendaciones de potenciación (siguiente nivel)

1. **Resolver predicciones automáticamente** — tras cada partido finalizado, computar `was_correct`/`actual_outcome` y el resultado de los `value_bets`. Esto **desbloquea ROI, precisión y backtesting reales** (hoy todo es 0/fabricado) y le da sentido al historial. Es la mejora con más retorno para la credibilidad del producto.
2. **Tipado real de Supabase** (🟡-3) + endurecer las API: base para todo lo demás.
3. **Tests** — hoy no hay ninguno. Al menos unit del motor (`predictionEngine`), `teamMapping` y `valueBets`, que son lógica pura y crítica. Y un par de e2e de las páginas clave.
4. **Caché / ISR** — las páginas server le pegan a Supabase en cada request. `revalidate` o el Runtime Cache de Vercel reducirían latencia y carga de DB notablemente.
5. **Fase de eliminatorias** — añadir `round_of_32` y auto-poblar cruces a partir de los standings finales (el schema ya soporta las fases siguientes).
6. **Panel de estado del sistema** — explotar `sync_logs` (que ya se está llenando) en una vista interna: última sincronización, cuota de The Odds API restante, partidos sin match, etc.
7. **Observabilidad de errores** — integrar Sentry o similar; hoy los errores se tragan en silencio.
8. **Mejorar el motor** — el ELO/stats son estimados a mano; conectar una fuente real de ratings (o pesar más el mercado) elevaría la calidad de predicciones y value bets de golpe.

---

*Fin del informe. No se ha modificado código. Esperando tu aprobación sobre qué lotes/hallazgos atacar antes de tocar nada.*
