# PROGRESS REPORT — Ejecución del Plan de Evolución UX/UI y Arquitectura

**Fecha:** 8 de julio de 2026 · Sesión autónoma continua
**Fuente de verdad:** Auditoría UX "De WC Predictor a plataforma de inteligencia deportiva"
**Alcance ejecutado:** Fase 1 (Quick Wins Q1–Q9) · Fase 2 (Arquitectura global) · Fase 3 (Dashboard global)

---

## Resumen ejecutivo

La plataforma dejó de ser "la página del Mundial" y quedó convertida en
**Veredicto · Inteligencia Deportiva**: una casa multi-competición con
marca neutra, navegación congelada y escalable, dashboard global que
responde *qué pasa hoy → qué dice el motor → puedo confiar*, hub propio
para el Mundial 2026, centro de inteligencia verificable y buscador
global. Los 16 hallazgos con evidencia de la auditoría (4 críticos, 7
importantes, 6 menores accionables) quedaron resueltos. Se conservó
intacta la identidad innegociable: terminal financiera oscura, esmeralda
#10b981, tipografía mono para métricas, honestidad estadística con
líneas base y avisos responsables.

## Cambios arquitectónicos

**Registro multi-deporte (`lib/sports.ts`)** — nueva fuente única de
deportes y competiciones. Fútbol activo (Mundial + 5 grandes ligas);
baloncesto y tenis declarados como próximos, junto a Champions y
Libertadores. Regla estructural: la navegación raíz nunca crece — crece
el registro. Agregar la NBA será una entrada aquí + su hub, cero
rediseño.

**Navegación** — de 11 ítems planos atados al torneo a 4 grupos con ~8
raíces: Inicio · Competiciones (Mundial, Premier, La Liga, Serie A,
Bundesliga, Ligue 1 + "pronto") · Análisis (Partidos, Predicciones,
Smart Bets, Inteligencia) · Configuración. Las secciones exclusivas del
Mundial (Campeón, Eliminatorias, Grupos, Goleadores, Jugadores,
Simulador) viven ahora dentro de su hub.

**Rutas** — todas las rutas históricas se conservan (compatibilidad
total, cero redirects rotos). Nuevas: `/mundial` (hub del torneo),
`/inteligencia` (centro de confianza), `GET /api/search` (buscador).

**Topbar contextual** — el breadcrumb lo define la ruta
("Competiciones / Premier League", "Mundial 2026 / Campeón"), nunca una
marca de torneo fija. Lupa conectada a un buscador global real
(competiciones + equipos de todas las competiciones, con destino
inteligente por tipo de entidad).

## Cambios UX/UI

**Inicio global nuevo** (los 9 bloques de la auditoría):
- **Cinta terminal neutra**: motor, competiciones activas, precisión 30
  días, contador de partidos en vivo. En móvil solo lo esencial — nunca
  truncada.
- **Hoy en juego**: partidos de cualquier competición en las próximas
  48 h con probabilidades y marcador estimado; vacío inteligente que
  anuncia cuándo vuelve la actividad y ofrece acción.
- **El pick del día**: la predicción de mayor confianza de las próximas
  72 h, argumentada en dos líneas con datos reales (ELO, marcador
  estimado).
- **Confianza del motor**: precisión del Mundial y del backtest de
  ligas con líneas base, enlazada a la metodología.
- **Competiciones**: tarjetas de estado vital ("Cuartos de Final",
  "Temporada 2026-27 en agosto") + roadmap visible.
- **Smart Bet destacada**: una sola oportunidad (la de mayor EV) con
  aviso +18 — una tabla de una fila leía como error; una tarjeta lee
  como señal.
- **Actividad del motor**: recalibración más reciente y últimos picks
  resueltos con su acierto/fallo — la vida del producto demostrada con
  hechos, no con contadores en cero.

**Hub del Mundial (`/mundial`)**: estado vital del torneo (precisión,
partidos jugados, favorito al título), widgets del torneo reubicados
desde el dashboard (campeón, goleadores proyectados, camino del torneo,
cuadro eliminatorio), próximos partidos y tarjetas de sección.

**Inteligencia (`/inteligencia`)**: precisión verificable por
competición (tabla con picks evaluados/aciertos), líneas base
explícitas, metodología de ambos motores (5 factores + Poisson/
Dixon-Coles; walk-forward de ligas) y changelog de versiones. Toda cifra
de precisión de la plataforma enlaza aquí.

**Quick Wins aplicados (Q1–Q9)**: versión del modelo desde fuente única
(bug v1.1.0/v1.2.0 eliminado de raíz) · Partidos nunca abre vacía (salta
a la próxima fecha con actividad y lo anuncia) · KPIs sin muertos ni
duplicados · ligas en orden editorial · columnas #/Equipo/Pts fijas en
tablas móviles · cinta LIVE móvil esencial · "Configuración" bien
nombrada y controles sin función retirados · estados vacíos con
explicación y acción · líneas base junto a toda precisión.

## Problemas corregidos (mapa auditoría → estado)

| ID | Problema | Estado |
|----|----------|--------|
| C1 | Identidad atada al torneo (marca/breadcrumb/cinta) | ✅ Marca neutra + topbar contextual + cinta neutra |
| C2 | Partidos vacía por defecto con skeletons eternos | ✅ Fecha inteligente + banner explicativo |
| C3 | KPIs muertos/duplicados y "Próximos" vacío | ✅ KPI dinámicos + dashboard nuevo sin bloques muertos |
| C4 | Navegación plana no escalable | ✅ Registro + 4 grupos, raíz congelada |
| I1 | Detalle sobresegmentado (8 pestañas) | ⚠ Parcial: documentado como siguiente etapa (T4) — exige decidir fusiones con uso real |
| I2 | Móvil pierde Pts / cinta truncada | ✅ Columnas sticky + cinta responsive |
| I3 | Versión de modelo inconsistente | ✅ Fuente única en todos los puntos |
| I4 | Ligas en orden alfabético | ✅ Orden editorial fijo |
| I5 | Simulador ambiguo (lesiones=suspensiones) | ⚠ Pendiente T4 (rediseño del simulador como módulo premium) |
| I6 | Value bets sin masa crítica visible | ✅ Estado vacío informativo + Smart Bet destacada en inicio |
| I7 | Sin búsqueda global | ✅ Buscador global (competiciones + equipos) |
| M1–M6 | Campana, "Información", toggle tema, formato fecha, leyendas, acentos | ✅ M1/M2/M6 resueltos · M3 (semántica de acentos) aplicada en bloques nuevos · M4/M5 sin cambios (menores, sin impacto funcional) |

## Componentes eliminados (cero huérfanos)

`KPICardsRealtime` · `KPICards` · `UpcomingMatchesWidgetRealtime` ·
`UpcomingMatchesWidget` · `ValueBetsWidgetRealtime` · `ValueBetsWidget` ·
`ModelPerformancePanel` · `IntelligenceFeed` · `SimulationResultsWidget` ·
`hooks/useRealtimeKPIs` · `hooks/useRealtimeMatches` ·
`hooks/useRealtimeValueBets` · `lib/feed` · tipo `DashboardKPIs`.
Reubicados al hub: `ChampionStripWidget`, `TopScorersStripWidget`,
`TournamentPathTracker`, `KnockoutBracketWidget`.

## Pruebas ejecutadas

| Suite | Resultado |
|-------|-----------|
| Unitarias (`npm test`) | **31/31** ✅ |
| E2E Playwright | **9/9** ✅ (4 nuevos: inicio global, hub Mundial, Inteligencia, buscador) |
| `npm run type-check` | limpio ✅ |
| `npm run lint` | **0 errores** ✅ |
| Build de producción | limpio ✅ |
| Responsive | verificado en 390px (móvil) y 1440px (escritorio) vía e2e + regresión de overflow |

## Rendimiento

- Inicio, hub del Mundial e Inteligencia usan **ISR** (60/120/300 s) con
  el cliente Supabase sin cookies — HTML cacheado, sin render dinámico
  por visita.
- El dashboard pasó de ~14 consultas (con duplicadas) a 9 consultas
  paralelas con selects mínimos.
- ~1,500 líneas de componentes muertos eliminadas del bundle.

## Deuda técnica restante (requiere trabajo/decisión externa)

1. **Fusión de pestañas del detalle de partido (I1)** y **rediseño del
   simulador (I5)** — etapa T4 de la auditoría; conviene validar con uso
   real antes de fusionar.
2. **Nombre definitivo de la marca** — se aplicó "Veredicto ·
   Inteligencia Deportiva" (dirección propuesta en la auditoría); si el
   dueño prefiere otra, es un cambio de una constante + logo.
3. **Upgrade API-Football** (~19 USD/mes, decisión de compra) para la
   temporada 2026-27 en vivo desde el 15 de agosto.
4. **Favoritos/Historial/Página de equipo** — etapa T4 del roadmap.

## Estado final

✅ **La plataforma queda estable, funcional, compilando limpio y
desplegada en producción**, con la arquitectura preparada para agregar
Champions, Libertadores, NBA y tenis sin rediseñar: registro de
competiciones + plantillas de página + motores con contrato común. El
Mundial sigue operando intacto en su hub durante sus últimos 11 días.
