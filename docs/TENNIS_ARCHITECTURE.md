# Arquitectura del dominio Tennis

> Documento de arquitectura (2026-07-12). Tennis es el **tercer dominio
> independiente** de la plataforma (Fútbol · NBA · Tennis), con aislamiento
> total garantizado por barreras de compilación. Este doc registra las
> decisiones de la fase inicial y el plan de las fases restantes.

---

## 1. Decisión de estructura (adaptación documentada)

La instrucción original proponía `src/modules/tennis/…`. El repo ya tiene una
decisión arquitectónica registrada (plan maestro 2026-07-09): **convenciones
App Router en vez de src/modules**, probada con el dominio NBA. Tennis sigue
el mismo patrón — el objetivo (aislamiento) es idéntico; cambia solo el layout:

| Concepto pedido (src/modules/tennis) | Ubicación real (patrón NBA) |
|---|---|
| `types`, `statistics`, motores | `lib/tennis/` (constants, types; engine/stats en Fase 7) |
| `api` | `app/api/tennis/` |
| `components`, `dashboards` | `components/tennis/` |
| páginas (dashboard, matches, players, rankings…) | `app/tennis/` |
| `services` (sync ATP/WTA) | `services/tennis/` |
| `smart-bets`, `predictions`, `backtesting`, `intelligence` | tablas propias + `lib/tennis/` + `/inteligencia` (sección tenis) |
| `hooks` | dentro de `components/tennis/` (patrón del repo) |

## 2. Aislamiento (Fase 11 — implementado YA, antes que la lógica)

Barreras `no-restricted-imports` en `.eslintrc.json`, verificadas con tests
negativos en las cuatro direcciones:

- **Tenis ↛ fútbol** (motores, componentes, modelos) ❌ compilación falla
- **Tenis ↛ NBA** (lib/nba, components/nba, nba.service) ❌
- **Fútbol ↛ tenis** (motores y componentes de fútbol) ❌
- **NBA ↛ tenis** (barrera NBA ampliada) ❌

Punto de integración neutral permitido: `lib/sports.ts` (registro) y módulos
neutros (`lib/utils`, `lib/calibration`, `components/ui`). Nota: el detalle
universal sport-aware (`components/matches/MatchAnalysisTabs`) compone vistas
NBA por diseño documentado; tenis tendrá las suyas del mismo modo.

## 3. Modelo de datos (migración 053 — aplicada a la BD viva)

**Cero reutilización** de `matches`/`teams`/`predictions` compartidas: el tenis
es 1-vs-1 con sets/superficies — encajarlo en tablas de equipos sería
contaminación estructural. Nueve tablas exclusivas, todas con RLS + lectura
`anon` (acceso libre) y escritura solo service-role:

`tennis_players` (mano, altura, país, nacimiento, ELO) · `tennis_rankings`
(serie temporal oficial) · `tennis_tournaments` (nivel, superficie, cuadro) ·
`tennis_matches` (best-of, ronda, marcador textual, retired/walkover) ·
`tennis_match_stats` (aces, dobles faltas, saque/resto por jugador) ·
`tennis_predictions` (p1_win_probability + `features` JSONB — feature store
desde el día 1, lección del tuning de fútbol) · `tennis_smart_bets`
(moneyline, over/under games/sets, hándicaps) · `tennis_backtests` ·
`tennis_model_metrics`.

Competiciones contenedor en `competitions` (solo registro, ids deterministas):
ATP `20000000-…-0020`, WTA `21000000-…-0021`, `sport_id=3`.

**Implicación asumida:** las páginas compartidas (dashboard, /matches) NO
muestran tenis automáticamente — el dominio tiene sus propias páginas
(Fase 8). Es el precio correcto del aislamiento total.

## 4. Registro en el ecosistema (Fase 2 — hecho)

`lib/sports.ts`: ATP Tour y WTA Tour registrados con sus ids reales de BD,
`sport: 'tenis'`, `href: '/tennis'`, `status: 'proximamente'` (nota
"Integración en curso"). **El flip a `activa` ocurre en la Fase 8**, cuando
exista el hub — así no hay enlaces rotos ni páginas placeholder (Data First).
Identidad visual definida en `lib/tennis/constants.ts` (acento lima #a3e635,
icono Activity). Los procesos transversales usan `competitionIdsOfSport()`:
mientras el estado sea `proximamente`, tenis NO entra en ninguna lista blanca
(aislamiento también operativo).

## 5. Fuente de datos (decisión honesta — bloqueo declarado)

- **Base histórica ATP** (jugadores, torneos, resultados, rankings
  observados): **TML-Database** (`github.com/Tennismylife/TML-Database`) —
  esquema Sackmann, actualizada a diario, linaje CC BY-NC-SA (atribución en
  el servicio). Los repos originales de Sackmann devolvían 404 desde
  producción al momento de la ingesta (verificado por 3 vías) — cambio de
  fuente documentado. **WTA: pendiente de fuente** — la ingesta la rechaza
  con error explícito; no se fabrica nada.
- **Rankings**: la fuente no publica archivo de rankings; cada fila de
  partido trae el ranking real del jugador a la fecha del torneo → la serie
  se construye de esas OBSERVACIONES (etiquetado así). DOB no se publica
  (solo edad decimal) → `birthdate` queda NULL declarado.
- **Calendario en vivo + cuotas**: api-sports (nuestro proveedor actual) NO
  cubre tenis. Requiere decisión de compra del dueño (candidatas: API-Tennis,
  Sportradar, Tennis-Data). **Sin esa clave no habrá partidos en vivo ni
  Smart Bets con mercado real — y no se fabricará nada mientras tanto.**

Contratos de sync tipados en `services/tennis/contracts.ts` (SyncPlayers,
SyncRankings, SyncTournaments, SyncMatches, ValidateIntegrity con invariantes
de integridad post-ingesta).

## 6. Motor tennis-1.0 (Fase 7 — implementado y medido)

`lib/tennis/engine.ts` + `lib/tennis/stats.ts` (Fase 5). Pesos aprobados
(en `constants.ts`): **35%** ranking+ELO · **25%** forma · **20%**
superficie · **10%** H2H · **10%** mercado. Salidas: probabilidad de
victoria p1, favorito, confianza. Regla de honestidad: todo factor ausente
(sin historial, sin H2H, sin cuota) **renormaliza** los pesos presentes en
vez de estimar; si no hay ningún factor, no hay veredicto. Feature store
nativo (`tennis_predictions.features`) desde el día 1. Calibración con
`lib/calibration.ts` (módulo NEUTRO: Brier/log-loss para 2 clases).

**ELO walk-forward**: rating global + rating por superficie, K=32, inicial
1500, solo `finished`/`retired` (walkover no mueve nada). Orden cronológico:
fecha del torneo → ronda → match_num. Predecir-luego-incorporar garantiza
cero fuga de resultado.

### Backtest medido sobre histórico real (ATP, 2024-01-01 → 2026-01-17)

`GET /api/tennis/sync?step=backtest&tour=ATP` recorre los 5.636 partidos
jugados y persiste en `tennis_backtests` + `tennis_model_metrics`
(`window_label='backtest'`). Números **medidos, no prometidos**:

| Métrica | tennis-1.0 | Referencia |
|---|---|---|
| Partidos con veredicto | 5.556 | 80 sin veredicto (debutantes) → no se rellenan |
| Precisión | **63,75 %** | azar 50 % |
| Brier (2 clases) | **0,442** | azar 0,50 |
| Log-loss | **0,632** | azar 0,693 (ln 2) |
| Precisión (jugadores maduros ≥5) | 63,54 % | muestra 4.270 |

**Hallazgo honesto (1.0):** sobre el mismo subconjunto donde ambos jugadores
tienen ranking oficial (5.518 partidos), la línea base "gana el mejor
clasificado" acierta **64,19 %** y el motor **63,88 %** — 1.0 NO superaba al
ranking puro en precisión cruda (−0,3 pp), aunque sí batía al azar en Brier y
log-loss.

### tennis-1.1 (producción) — siembra de ELO por ranking (cold-start)

Diagnóstico: el ELO arrancaba a todos en 1500 y con solo 2 temporadas no
"calentaba" a tiempo. Hipótesis única (sin overfitting): sembrar el ELO de
cada debutante desde su ranking de entrada (`rankToSeedElo`, priores a
priori: refRank 50, 180 pts/década). Un solo cambio; el resto es idéntico a
1.0. Backtest comparativo pareado (misma ventana, walk-forward):

| Métrica | tennis-1.0 | **tennis-1.1** | Δ |
|---|---|---|---|
| Precisión | 63,75 % | **63,95 %** | +0,20 pp |
| Brier (2 clases) | 0,4420 | **0,4400** | −0,0020 |
| Log-loss | 0,6316 | **0,6293** | −0,0023 |
| Precisión vs. ranking (subset) | 63,88 % | **64,21 %** | iguala/roza la base (64,19 %) |

1.1 mejora a 1.0 en **las tres métricas** y cierra la brecha con el ranking.
El avance de precisión es pequeño (dentro del ruido de ~1 partido); el avance
**sólido y consistente es probabilístico** (Brier/log-loss), que es lo que
importa para valor esperado. Promovido a producción
(`TENNIS_MODEL_VERSION='tennis-1.1'`); 1.0 se conserva para comparación
(`?step=backtest&variant=tennis-1.0`). Queda declarado, no maquillado.

### tennis-1.2 (rechazado) — mapeo logarítmico del ranking

Hipótesis: `rank2/(rank1+rank2)` está mal calibrado en los extremos;
sustituirlo por `eloExpected(rankToSeedElo(r1), rankToSeedElo(r2))` (misma
escala Elo) debería mejorar. **Medición (walk-forward, misma ventana):
empeoró 1.1 en las tres métricas** — precisión 63,95→63,43 %, Brier
0,4400→0,4427, log-loss 0,6293→0,6324. **Rechazado**, no se promueve. El
código queda tras `variant=tennis-1.2` solo para reproducir. Aprendizaje:
ajustar más sobre 2 temporadas rinde poco y arriesga overfitting; la mejora
real pide más datos o un split train/validación.

### tennis-2.0 (PRODUCCIÓN) — saque/devolución + composición por ablación

Del plan maestro del motor de tenis. Auditoría de datos primero: cobertura
de stats de saque/resto = **100 %** de los partidos jugados (verificado
paginado); sin cuotas, lesiones, minutos, WTA/Challenger/ITF ni "indoor"
(declarados bloqueados, no fabricados).

**La especificación original midió PEOR y se descartó con números**: pesos
"superficie 30 % dominante + fatiga 10 %" dieron 62,89 % / 0,4500 / 0,6409
(vs 1.1: 63,95 % / 0,4400 / 0,6293). La ablación pareada (una pasada, mismo
estado, variantes simultáneas) localizó las causas: el ELO de superficie solo
es más ruidoso que el ancla ranking+ELO; el proxy de fatiga (fecha de inicio
de torneo, sin minutos) resta señal; **saque/devolución SÍ suma** (quitarlo
empeora). Regla de promoción pre-declarada antes de mirar refinamientos:
batir a 1.1 en las 3 métricas globales Y en el Brier de ventana tardía
(≥2025-07-01), como guard de sobreajuste.

Composición ganadora (pesos finales en `TENNIS2_WEIGHTS`): **40 %**
ranking+ELO (ancla 1.1) · **15 %** superficie (con respaldo jerárquico:
superficie → ELO global → ranking) · **15 %** forma · **15 %**
saque/devolución (hold%+break% acumulados walk-forward, K=2,7 a priori,
mínimo 3 partidos con stats) · **10 %** H2H · **5 %** mercado (sin fuente →
renormaliza). Fatiga EXCLUIDA (medida dañina; `lib/tennis/fatigue.ts` queda
como módulo puro para cuando la fuente tenga fechas/minutos por partido).

| Métrica | tennis-1.1 | **tennis-2.0** | Δ |
|---|---|---|---|
| Precisión | 63,95 % | **64,00 %** | +0,05 pp |
| Brier (2 clases) | 0,4400 | **0,4375** | −0,0025 |
| Log-loss | 0,6293 | **0,6264** | −0,0029 |
| Brier ventana tardía | 0,4529 | **0,4507** | −0,0022 |
| Precisión vs. ranking (subset) | 64,21 % | **64,26 %** | **BATE la base (64,19 %) por primera vez** |

Advertencia honesta: la composición se eligió entre pocas variantes sobre el
mismo histórico (selección in-sample); el guard tardío mitiga pero no
elimina el riesgo. **Resuelta el 2026-07-17 con la re-validación de abajo.**
`variant=tennis-1.0/1.1/1.2` reproducen las versiones anteriores.

### Re-validación anti-overfitting (2026-07-17) — split temporal 2020-2026

Ejecutada localmente desde los CSV de TML-Database 2020-2026 (la MISMA
fuente y transformación de la ingesta; 16.270 partidos), replicando la
lógica exacta de `services/tennis/backtest.ts`. La ventana 2020-2023 es
**out-of-sample real**: esos años no participaron en ninguna decisión de
diseño del 2.0 (que se eligió solo con 2024-2026).

| Ventana | Métrica | tennis-1.1 | tennis-2.0 | Baseline ranking |
|---|---|---|---|---|
| 2020-2023 (out-of-sample, n=9.950) | Precisión | 65,04 % | 64,85 % | 63,97 % |
| | Brier | 0,4319 | **0,4299** | — |
| | Log-loss | 0,6201 | **0,6177** | — |
| 2024-2026 (selección, n=6.059) | Precisión | 64,33 % | 64,20 % | 62,89 % |
| | Brier | 0,4381 | **0,4368** | — |
| | Log-loss | 0,6269 | **0,6255** | — |

Conclusión: la ventaja **probabilística** del 2.0 (Brier y log-loss)
replica fuera de muestra — sin señal de overfitting; la ventaja de
precisión publicada es marginal (las diferencias de precisión entre 1.1 y
2.0 quedan dentro del ruido muestral, <0,2 pp). Ambos baten al ranking
puro en la muestra común. **tennis-2.0 se mantiene en producción.**
Nota: la ingesta de 2020-2023 a la BD viva queda PENDIENTE (requiere
service key/CRON_SECRET, acción del dueño); al ingestarse, el backtest
remoto reproducirá estos números. Hallazgo de fuente: TML publica
`minutes` por partido (no la fecha exacta) — la fatiga 2.0 podría
reintentarse con carga por minutos, sigue en backlog.

### Simulador Monte Carlo de mercados (2026-07-17, `lib/tennis/monteCarlo.ts`)

Punto→juego→set→partido, puro y determinista por semilla. Entrada: % REAL
de puntos ganados al saque y al resto por jugador (cobertura 100 %). La
prob. de punto al saque combina saque propio y resto del rival con el
ajuste Barnett–Clarke: `spwA − (rpwB − rpwMedia)`, con la media del
circuito MEDIDA (0,3594 sobre 10.848 filas). El paso punto→juego usa la
cadena cerrada del juego con ventaja; tiebreak, set y partido se simulan.
Publica: marcador en sets (2-0/2-1/…), over/under de juegos y hándicap de
juegos — SIN cuotas (el EV llega con la Fase 9).

**Validación contra frecuencias reales antes de UI** (walk-forward sin
fuga, n=3.704 Bo3 con perfil): el modelo iid puro predijo 54,8 % de
partidos a dos sets vs 64,0 % reales (los promedios subestiman la
variabilidad día a día). Se añadió un **choque de rendimiento por
simulación** (`PERFORMANCE_SIGMA`), calibrado por rejilla contra el
histórico: con σ=0,065 → 2-0 64,11 % (real 63,96 %), juegos totales 23,59
(real 23,61), over 22,5 46,92 % (real 46,60 %). Expuesto en la UI del H2H
(`MarketsPanel`, `fetchTennisMatchupSim`) como partido hipotético hoy;
si un jugador no llega al mínimo de partidos con stats, se declara — no
se estima.

## 7. Plan de fases restantes

| Fase | Entregable | Bloqueo | Estimación |
|---|---|---|---|
| 4 · Datos base ✅ | HECHO (2026-07-12): ATP 2024-2026 desde TML — **581 jugadores · 362 torneos · 5.676 partidos · 11.352 stats · 6.508 rankings observados**, integridad 0/0/0/0, ingesta idempotente re-corrible (`/api/tennis/sync`). WTA bloqueada por fuente | WTA: fuente pendiente | hecho |
| 5 · Jugadores ✅ | `lib/tennis/stats.ts` (núcleo) + página `/tennis/jugadores/[id]` (Fase 8): Win% global/superficie, forma, Hold%/Break%, aces/DF — todo real | Fase 4 | hecho |
| 6 · Partidos ✅ | `/tennis/partidos` (navegador de resultados con filtro por superficie + paginación) y `/tennis/h2h` (cara a cara real entre dos jugadores, balance global y por superficie). Sin "próximos partidos": la fuente es histórica, no se inventa calendario | Fase 4 | hecho |
| 7 · Motor 1.0 ✅ | `lib/tennis/engine.ts` (ELO walk-forward global+superficie) + `services/tennis/backtest.ts` medido sobre 5.636 partidos ATP: **precisión 63,75 %, Brier 0,442, log-loss 0,632**; aún −0,3 pp vs. ranking puro (línea de trabajo 1.1). 19 pruebas | Fase 4 | hecho |
| 8 · Dashboard ✅ | Hub `/tennis` + `/tennis/ranking` + `/tennis/jugadores/[id]` + `/tennis/inteligencia`; **registro ATP → `activa`** (WTA sigue promesa). `services/tennis/queries.ts` (lectura anon/ISR), `components/tennis/*`. Icono propio en el sidebar | Fases 5-7 | hecho (v1) |
| 9 · Smart Bets | Motor de mercados propio; requiere fuente de cuotas de tenis | **Decisión de compra** | 2-3 d tras la clave |
| 10 · Inteligencia | `/inteligencia` sección tenis (accuracy, Brier, log-loss, ROI, yield, calibración) con `lib/calibration` | Fase 7 | 1 d |
| 11 · Barreras | ✅ HECHO en esta fase inicial (antes que la lógica, a propósito) | — | — |

## 8. Reglas permanentes del dominio

1. Nada de datos ficticios: si la fuente no lo da, no existe en la UI.
2. Toda tabla nueva del dominio: prefijo `tennis_`, RLS + lectura anon.
3. Ningún archivo de tenis importa fútbol/NBA (la compilación lo impide).
4. Métricas propias del tenis (Hold%, Break%) — jamás copiar xG/posesión.
5. El registro (`lib/sports.ts`) es el ÚNICO punto donde los tres dominios
   coexisten.
