# Registro de cambios

Cambios relevantes del proyecto, más reciente primero. Este archivo se inicia en
la Fase 3 de consolidación; el historial anterior vive en el log de git y en
`PROGRESS_REPORT.md` / `HANDOFF.md`.

## 2026-07-19 · Fase 3 — Consolidación de la arquitectura

Consolidación técnica sin cambios de comportamiento. Todo verificado con
`tsc --noEmit` (0 errores), `next lint` (0 errores), `npm test` (155/155) y build
(compila y empaqueta todas las páginas; solo falla en fase de datos por ausencia
de credenciales Supabase en el sandbox — no relacionado con estos cambios).

### Limpieza de deuda técnica segura
- Eliminados **imports no usados** en 14 archivos (iconos lucide, hooks de React,
  utilidades y tipos muertos). Cambio puramente de higiene: ningún símbolo
  eliminado se referenciaba. Sin efecto en runtime, tipos ni resultados.
  - `app/dashboard/page.tsx` (`competitionHref`), `app/sitemap.ts`
    (`COMPETITION_ID`), `components/champion/ChampionProbabilityBracket.tsx`
    (`Medal`), `components/charts/TeamComparisonRadar.tsx` (`Legend`),
    `components/digital-twin/MatchDigitalTwin.tsx` (`TacticalProfile`),
    `components/intelligence/MonteCarloPanel.tsx` (`formToScore`),
    `components/matches/AISmartBetsPanel.tsx` (10 iconos + `cn` +
    `SmartBetRecommendation`), `components/matches/MatchesTable.tsx`
    (`useCallback`, `formatProbability`),
    `components/matches/smart-bets/sections.tsx` (`useMemo`, `useQuery`,
    `computeSmartBets`, `generateFallbackAnalysis`, `AnalysisContext`,
    `GroupContext`), `components/nba/NbaSchedule.tsx` (`cn`),
    `components/search/GlobalSearch.tsx` (`cn`),
    `components/simulation/SimulationEngine.tsx` (`useMutation`, `Play`),
    `lib/agents/riskAssessmentAgent.ts` (`Probabilities`),
    `services/matches.service.ts` (`Lineup`).

### Documentación sincronizada con el estado real
- `README.md`, `CLAUDE_CONTEXT.md`: cifras corregidas — migraciones **050 → 054**,
  verify_migrations **43 → 47** chequeos, tests unitarios **68/72 → 155**, e2e
  **15/17 → 28**.
- `CLAUDE.md`: próxima migración **054 → 055**.
- Nuevo `docs/CAPA_ANALITICA_VS_PRODUCCION.md`: declara la frontera entre el motor
  de producción (autoritativo) y la capa analítica V3 (realiza ADR-004).
- `docs/FASE1_*` y `docs/FASE2_*`: cifra de tests alineada a 155 (conteo en
  ejecución) para coherencia entre entregables.

### No modificado a propósito (hallazgos documentados, no tocados)
- **Variables/parámetros locales sin uso** (~30 casos): pueden ocultar un efecto
  colateral o cambiar una firma; requieren análisis caso por caso. Se dejan para
  una revisión dirigida, no para una limpieza masiva.
- **Warnings heredados de lint** (`<img>` vs `next/image`, `react-hooks/
  exhaustive-deps`): cambiarlos altera comportamiento (memoización, carga de
  imágenes). Fuera del alcance "cambio seguro".
- **Migraciones `012` duplicadas en número**: renumerar una migración ya aplicada
  en producción es riesgoso; se documenta como deuda opcional.
- **Tabla `jobs` y tablas de monitoreo sin escritores**: son primitivas que las
  Fases B–C deben *activar*, no eliminar.
