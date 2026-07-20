# Dashboard & UX — Documento canónico (Fase 7)

> **Fecha:** 2026-07-19 · **Alcance:** experiencia de usuario, arquitectura de
> información y componentes de presentación. **No** toca el Prediction Engine ni
> el Smart Bets Engine (solo los consume).
>
> **Nota de entorno (honesta):** esta fase se ejecutó en un sandbox **sin render
> ni datos** (Supabase no disponible; el build falla en la fase de datos). Por
> eso: (a) la **auditoría** y la **arquitectura de información** se entregan como
> documentación verificada leyendo el código; (b) el trabajo de código se limita
> a piezas **puras/aditivas verificables** (tsc/lint/build/tests) que NO se
> cablean a rutas de producción para no arriesgar regresiones visuales que no se
> pueden validar aquí. Lo que exige render (rediseño visual, responsive real,
> auditoría axe, wiring a datos) queda listado como pendiente con entorno visual.

---

## 1. Auditoría del Dashboard

### 1.1 Estado general
El Dashboard está **maduro y bien estructurado**. El inicio (`app/dashboard`)
responde en orden a "¿qué pasa hoy? → ¿qué dice el motor? → ¿puedo confiar?",
con estados vacíos honestos y multideporte. El detalle de partido
(`app/matches/[id]`) es sport-aware y ya agrega casi todos los bloques exigidos.

### 1.2 Hallazgos

| # | Severidad | Hallazgo | Ubicación | Recomendación |
|---|-----------|----------|-----------|---------------|
| D1 | 🔴 Data First | **Badge `+18` hardcodeado** sin fuente en "Smart Bet destacada" | `app/dashboard/page.tsx:466` | Ligar a un dato real o eliminar. Viola "cero datos fabricados" (mismo tipo que el ROI que corrigió la auditoría de junio). **No se cambió aquí** (no se puede validar el render); se marca para corregir en entorno visual. |
| D2 | 🟡 Consistencia | Etiqueta de mercado traducida ad-hoc (`over_2_5 → 'Más de 2.5 goles'`) inline | `app/dashboard/page.tsx:474` | Centralizar con `getMarketLabel` (lib/valueBets) o el registro de mercados (lib/smartBets). |
| D3 | 🟡 Falta | No existe un **Smart Bets Dashboard** con filtros/orden/riesgo; hoy solo hay una "destacada" en inicio + `/value-bets` (tabla). | inicio + `/value-bets` | Panel dedicado que consuma el Smart Bets Engine (Fase 6). **Componente entregado** (§4). |
| D4 | 🟡 Falta | El **Prediction Center** (`/predictions`) no expone explícitamente pesos por factor + versión + fecha del modelo como panel didáctico. | `/predictions` | Panel que muestre variables, peso de cada factor (DEFAULT_WEIGHTS), comparación y versión (`MODEL_VERSION`). Requiere render. |
| D5 | 🟢 UX | El **Live** es inline (`LiveMatchRefresh` en el detalle); no hay una vista Live dedicada con cambios de probabilidad/Smart Bets. | `/matches/[id]` | Sección Live con cronología + delta de probabilidades. Requiere render + datos en vivo. |
| D6 | 🟢 A11y | Varios `<img>` sin `next/image` (warnings de lint heredados) en perfiles/goleadores. | `equipos/[id]`, `TopScorersPrediction` | Migrar a `next/image` o asegurar `alt`. Cambio visual → requiere render. |
| D7 | 🟢 Rendimiento | El inicio hace ~12 queries en `Promise.all` (correcto), pero algunas familias podrían moverse a vistas materializadas/KPIs. | `app/dashboard/page.tsx` | Ya usa ISR 60s + cliente estático. Optimización fina, no urgente. |

### 1.3 Lo que NO es un problema (ya resuelto)
- Estados vacíos honestos, ISR por tiers, `ProbBar1X2` como visualización firma,
  navegación raíz estable (registro multi-deporte), aislamiento por deporte.

---

## 2. Arquitectura de información (secciones)

Mapa de las secciones exigidas por la fase contra las rutas reales:

| Sección (brief) | Ruta actual | Estado | Responsabilidad |
|-----------------|-------------|--------|-----------------|
| Inicio | `/dashboard` | ✅ | Resumen: qué pasa hoy, confianza del motor, pick del día |
| Partidos | `/matches` | ✅ | Agenda navegable por fecha/competición |
| Detalle del partido | `/matches/[id]` | ✅ | Análisis completo sport-aware (§3) |
| Prediction Center | `/predictions` | 🟡 parcial | Cómo se generó la predicción (pendiente panel didáctico, D4) |
| Smart Bets | `/value-bets` | 🟡 parcial | Recomendaciones (pendiente panel con filtros, D3 — componente entregado) |
| Live Match | inline en detalle | 🟡 parcial | Seguimiento en vivo (pendiente vista dedicada, D5) |
| Estadísticas | `/nba/estadisticas`, perfiles | ✅ | Stats por dominio |
| Ranking | `/mundial/rankings`, `/tennis/ranking`, `/nba/rankings` | ✅ | Rankings por deporte |
| Historial | `/inteligencia`, `SmartBetsTrackRecord` | ✅ | Backtest + track record |
| Configuración | `/settings` | ✅ | Preferencias |
| Administración | `/admin` | ✅ | Operación/salud |

**Conclusión:** la estructura ya existe casi completa. Los gaps reales son **D3
(Smart Bets Dashboard)**, **D4 (Prediction Center didáctico)** y **D5 (Live
dedicado)** — los tres requieren render/datos para completarse con seguridad.

---

## 3. Dashboard del Partido (`/matches/[id]`) — cobertura

El detalle ya renderiza (verificado en imports): `MatchHeader`, `LiveMatchRefresh`,
`MarketMovementPanel`, `MatchAnalysisTabs` (agrega predicción, factores, forma,
comparativa, H2H, lesiones, alineaciones, stats), `MatchTimeline`, `VerdictPanel`
(IA explicativa), `HeadToHead`, `QuarterBreakdown` (NBA), `ProbBar`.

| Bloque exigido | Componente | Estado |
|----------------|-----------|--------|
| Información general / estado | `MatchHeader`, `LiveMatchRefresh` | ✅ |
| Probabilidades / predicción / confianza | `MatchAnalysisTabs` + `ProbBar` | ✅ |
| Factores relevantes / forma / comparativa | `MatchAnalysisTabs` | ✅ |
| Historial / lesiones / alineaciones | `HeadToHead`, `MatchAnalysisTabs` | ✅ |
| Smart Bets | `AISmartBetsPanel` (fútbol) | ✅ (form-based) |
| Explicación IA | `VerdictPanel` | ✅ |
| Cronología / eventos | `MatchTimeline` | ✅ |
| Noticias relevantes | — | ❌ (sin fuente de noticias; Data First: no fabricar) |
| Movimiento de mercado | `MarketMovementPanel` | ✅ |

**Gap honesto:** "noticias relevantes" no tiene fuente de datos → no se inventa
(queda en backlog hasta tener proveedor). El resto de bloques ya existen.

---

## 4. Smart Bets Dashboard — entregado (componente reutilizable)

Puente Fase 6 → Dashboard (D3), construido como **capa de presentación pura**
sobre el Smart Bets Engine:

- `components/smart-bets/present.ts` — lógica pura testeable: `filterAndSort`
  (por riesgo + orden score/EV/cuota, determinista), formateo y tokens de tema
  centralizados (`RISK_TONE`/`TIER_TONE`). 6 pruebas.
- `components/smart-bets/SmartBetsBoard.tsx` — panel presentacional (client) que
  muestra **recomendación, confianza (score), EV, riesgo, mercado, probabilidad,
  cuota, justificación, estado (tier)** + **filtros** (riesgo) y **ordenamiento**.
  Accesible (botones con `aria-pressed`, `<select>` etiquetado, `role="group"`,
  estado vacío honesto). **Puro** (recibe `SmartBetRecommendation[]` por props;
  no hace fetch ni calcula nada).

**No se cableó a una ruta de producción** para no arriesgar regresiones visuales
sin poder validarlas. Wiring propuesto (entorno con render): una página
`/smart-bets` (o el panel del detalle) que obtenga `predictions` + `odds` reales,
llame a `generateSmartBets` (lib/smartBets) y pase el resultado a `SmartBetsBoard`.

---

## 5. Componentes reutilizables y estilos

- **Tokens de tema centralizados** para Smart Bets en `present.ts` (riesgo/tier),
  evitando duplicar clases Tailwind por tarjeta.
- **Reutilización:** `SmartBetsBoard` reutiliza el motor (Fase 6) y las etiquetas;
  no duplica el motor form-based existente (`AISmartBetsPanel`), que permanece.
- **Deuda de consistencia documentada (D2):** unificar etiquetas de mercado.

---

## 6. Responsive, accesibilidad y rendimiento (pendiente de entorno visual)

Estas tareas del brief **requieren render** y no se pueden validar en el sandbox:
- **Responsive** (desktop/tablet/móvil): el componente entregado usa utilidades
  responsive (`flex-wrap`, `min-w-0`, `truncate`), pero la verificación de "ninguna
  pantalla rota" exige navegador.
- **Accesibilidad** (contraste, teclado, lectores, axe): el componente sigue
  buenas prácticas (roles, `aria-*`, foco por defecto de `<button>`/`<select>`),
  pero una auditoría real necesita render.
- **Rendimiento** (LCP, lazy loading, renders): D7 y D6 requieren medición en un
  entorno con datos.

Se dejan como el trabajo natural de la siguiente iteración **con entorno visual**.

---

## 7. Registro de cambios de esta fase

- Nuevos: `components/smart-bets/present.ts`, `components/smart-bets/SmartBetsBoard.tsx`,
  `tests/smartBetsPresentation.test.ts`, este documento.
- Sin cambios en el Prediction Engine, el Smart Bets Engine ni rutas existentes.
- Gates: tsc 0 · lint 0 · npm test 185/185 · build compila.
