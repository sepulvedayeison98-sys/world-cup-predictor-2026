import { createAdminClient } from '@/lib/supabase/admin'
import { TENNIS_MODEL_VERSION, TENNIS_WEIGHTS, type Tour } from '@/lib/tennis/constants'
import {
  ELO_COUNTABLE, advanceWalkState, createWalkState, extractFactors,
  predictTennisMatch, sortChronologically, type TEngineMatch,
} from '@/lib/tennis/engine'

/**
 * DOMINIO TENNIS — backtest walk-forward del motor tennis-1.0 (Fase 7).
 *
 * Recorre TODO el histórico real importado en orden cronológico estricto:
 * para cada partido primero PREDICE con lo conocido hasta ese momento y
 * después incorpora el resultado (jamás ve el futuro). Métricas de dos
 * clases: Brier (azar = 0.5), log-loss (azar = ln2 ≈ 0.693) y precisión,
 * comparadas contra la línea base "gana el mejor clasificado" sobre el
 * MISMO subconjunto de partidos (comparación justa).
 *
 * El resultado se persiste en tennis_backtests (histórico de corridas) y
 * tennis_model_metrics (última foto por ventana). Cero datos fabricados:
 * los partidos sin ningún factor disponible (dos debutantes) se cuentan
 * como "sin veredicto", no se rellenan con 50/50.
 */

export interface TennisBacktestResult {
  ok: boolean
  modelVersion: string
  tour: Tour
  dateFrom: string | null
  dateTo: string | null
  totalMatches: number
  predicted: number          // con veredicto del modelo
  noVerdict: number          // sin ningún factor (Data First: no se predice)
  accuracy: number | null
  brier: number | null       // 2 clases; azar = 0.5
  logLoss: number | null     // 2 clases; azar ≈ 0.693
  baseline: {
    // "gana el mejor clasificado" — mismo subconjunto con ambos rankings
    sample: number
    accuracy: number | null
    modelAccuracyOnSample: number | null
  }
  warmedUp: {
    // ambos jugadores con ≥5 partidos previos vistos (señal madura)
    sample: number
    accuracy: number | null
    brier: number | null
  }
  duration_ms: number
}

const BRIER_CHANCE_2CLASS = 0.5
const dateKey = (iso: string | null) => (iso ?? '').slice(0, 10)

async function fetchAllPages(query: (from: number) => any): Promise<any[]> {
  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

export interface TennisBacktestOptions {
  /** Versión bajo la que se persiste (default tennis-1.0). */
  modelVersion?: string
  /** Sembrar el ELO de los debutantes desde su ranking (experimento 1.1). */
  seedFromRanking?: boolean
}

export async function runTennisBacktest(
  tour: Tour, opts: TennisBacktestOptions = {},
): Promise<TennisBacktestResult> {
  const started = Date.now()
  const modelVersion = opts.modelVersion ?? TENNIS_MODEL_VERSION
  // Por defecto el modelo de producción (tennis-1.1) siembra ELO por ranking;
  // solo se corre sin siembra cuando se pide explícitamente la versión previa.
  const seedFromRanking = opts.seedFromRanking ?? (modelVersion === TENNIS_MODEL_VERSION)
  const supabase = createAdminClient() as any

  // Partidos del tour (join con torneos; paginado con orden estable)
  const matches: TEngineMatch[] = (await fetchAllPages((from) =>
    supabase.from('tennis_matches')
      .select('id, p1_id, p2_id, winner_id, surface, status, scheduled_at, round, external_id, tennis_tournaments!inner(tour)')
      .eq('tennis_tournaments.tour', tour)
      .order('id')
      .range(from, from + 999),
  )).map(({ tennis_tournaments: _t, ...m }: any) => m)

  // Rankings observados → posición por (jugador, fecha del torneo)
  const rankRows = await fetchAllPages((from) =>
    supabase.from('tennis_rankings')
      .select('player_id, ranking_date, position')
      .order('id')
      .range(from, from + 999),
  )
  const rankAt = new Map<string, number>(
    rankRows.map((r: any) => [`${r.player_id}|${r.ranking_date}`, r.position]))

  // Walk-forward estricto
  const state = createWalkState()
  let predicted = 0, noVerdict = 0, correct = 0, brierSum = 0, llSum = 0
  let baseSample = 0, baseCorrect = 0, baseModelCorrect = 0
  let warmSample = 0, warmCorrect = 0, warmBrier = 0
  let dateFrom: string | null = null, dateTo: string | null = null
  const eps = 1e-12

  for (const m of sortChronologically(matches)) {
    if (!m.p1_id || !m.p2_id || !m.winner_id || !ELO_COUNTABLE.has(m.status)) continue
    const dk = dateKey(m.scheduled_at)
    if (!dateFrom) dateFrom = dk
    dateTo = dk

    const rank1 = rankAt.get(`${m.p1_id}|${dk}`) ?? null
    const rank2 = rankAt.get(`${m.p2_id}|${dk}`) ?? null
    const prevP1 = state.played.get(m.p1_id) ?? 0
    const prevP2 = state.played.get(m.p2_id) ?? 0

    const f = extractFactors(state, m, rank1, rank2, null)
    const pred = f ? predictTennisMatch(f) : null
    if (pred) {
      predicted++
      const y1 = m.winner_id === m.p1_id ? 1 : 0
      const p = pred.p1Probability
      const hit = (p >= 0.5 ? 1 : 0) === y1
      if (hit) correct++
      const b = 2 * (p - y1) ** 2
      brierSum += b
      llSum += -Math.log(Math.max(eps, y1 ? p : 1 - p))

      if (rank1 != null && rank2 != null && rank1 !== rank2) {
        baseSample++
        if ((rank1 < rank2 ? m.p1_id : m.p2_id) === m.winner_id) baseCorrect++
        if (hit) baseModelCorrect++
      }
      if (prevP1 >= 5 && prevP2 >= 5) {
        warmSample++
        if (hit) warmCorrect++
        warmBrier += b
      }
    } else {
      noVerdict++
    }
    advanceWalkState(state, m, seedFromRanking ? { seedRank1: rank1, seedRank2: rank2 } : undefined)
  }

  const result: TennisBacktestResult = {
    ok: true, modelVersion, tour,
    dateFrom, dateTo,
    totalMatches: predicted + noVerdict,
    predicted, noVerdict,
    accuracy: predicted ? correct / predicted : null,
    brier: predicted ? brierSum / predicted : null,
    logLoss: predicted ? llSum / predicted : null,
    baseline: {
      sample: baseSample,
      accuracy: baseSample ? baseCorrect / baseSample : null,
      modelAccuracyOnSample: baseSample ? baseModelCorrect / baseSample : null,
    },
    warmedUp: {
      sample: warmSample,
      accuracy: warmSample ? warmCorrect / warmSample : null,
      brier: warmSample ? warmBrier / warmSample : null,
    },
    duration_ms: Date.now() - started,
  }

  // Persistencia: corrida histórica + foto por ventana (upsert por UNIQUE)
  const { error: btErr } = await supabase.from('tennis_backtests').insert({
    model_version: result.modelVersion, tour,
    date_from: dateFrom, date_to: dateTo,
    sample_size: predicted,
    accuracy: result.accuracy, brier_score: result.brier, log_loss: result.logLoss,
    roi: null, yield: null, // sin cuotas reales de tenis todavía (Fase 9): no se fabrica ROI
    metadata: {
      weights: TENNIS_WEIGHTS,
      no_verdict: noVerdict,
      brier_chance: BRIER_CHANCE_2CLASS,
      seed_from_ranking: seedFromRanking,
      baseline: result.baseline,
      warmed_up: result.warmedUp,
    },
  })
  if (btErr) throw new Error(`tennis_backtests: ${btErr.message}`)

  const { error: mmErr } = await supabase.from('tennis_model_metrics').upsert({
    model_version: result.modelVersion, tour, window_label: 'backtest',
    sample_size: predicted,
    accuracy: result.accuracy, brier_score: result.brier, log_loss: result.logLoss,
    computed_at: new Date().toISOString(),
  }, { onConflict: 'model_version,tour,window_label' })
  if (mmErr) throw new Error(`tennis_model_metrics: ${mmErr.message}`)

  return result
}
