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

## 6. Motor tennis-1.0 (Fase 7 — especificado, no implementado)

`lib/tennis/engine.ts` (futuro). Pesos aprobados (en `constants.ts`):
**35%** ranking+ELO · **25%** forma · **20%** superficie · **10%** H2H ·
**10%** mercado. Salidas: probabilidad de victoria p1, favorito, confianza.
Feature store nativo (`tennis_predictions.features`) para el tuning fiel
desde el primer día. Calibración con `lib/calibration.ts` (módulo NEUTRO ya
existente: Brier/log-loss/curva sirven para cualquier deporte de 2 clases).

## 7. Plan de fases restantes

| Fase | Entregable | Bloqueo | Estimación |
|---|---|---|---|
| 4 · Datos base ✅ | HECHO (2026-07-12): ATP 2024-2026 desde TML — **581 jugadores · 362 torneos · 5.676 partidos · 11.352 stats · 6.508 rankings observados**, integridad 0/0/0/0, ingesta idempotente re-corrible (`/api/tennis/sync`). WTA bloqueada por fuente | WTA: fuente pendiente | hecho |
| 5 · Jugadores | `/tennis/jugadores/[id]`: perfil + Win%, Hold%, Break%, aces, DF, ELO — todo derivado de partidos reales importados | Fase 4 | 1-2 d |
| 6 · Partidos | `/tennis/partidos`: calendario/resultados/H2H/superficie | Fase 4 | 1-2 d |
| 7 · Motor 1.0 | `lib/tennis/engine.ts` + ELO walk-forward por superficie + backtest sobre histórico real | Fase 4 | 2-3 d |
| 8 · Dashboard | Hub `/tennis` + 6 páginas; **flip a `activa` en el registro** | Fases 5-7 | 2 d |
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
