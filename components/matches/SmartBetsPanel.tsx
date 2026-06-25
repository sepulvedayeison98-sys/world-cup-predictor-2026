'use client'

import { useMemo } from 'react'
import { Sparkles, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  computeSmartBets,
  type SmartBetTier,
  type SmartBetCategory,
  type SmartBetRecommendation,
  type VolatilityLevel,
  type MatchFormEntry,
} from '@/lib/smartBetsEngine'

// ─── Configuración visual por tier ─────────────────────────────────────────────

const TIER: Record<SmartBetTier, { label: string; text: string; badge: string; border: string; stroke: string }> = {
  premium:    { label: 'Premium',    text: 'text-amber-400',   badge: 'bg-amber-500/15 border-amber-500/30',    border: 'border-amber-500/20',   stroke: '#f59e0b' },
  muy_fuerte: { label: 'Muy Fuerte', text: 'text-emerald-400', badge: 'bg-emerald-500/15 border-emerald-500/30', border: 'border-emerald-500/20', stroke: '#10b981' },
  fuerte:     { label: 'Fuerte',     text: 'text-blue-400',    badge: 'bg-blue-500/15 border-blue-500/30',      border: 'border-blue-500/20',    stroke: '#3b82f6' },
  moderada:   { label: 'Moderada',   text: 'text-zinc-400',    badge: 'bg-zinc-700/30 border-zinc-700',         border: 'border-zinc-700/30',    stroke: '#71717a' },
  evitar:     { label: 'Evitar',     text: 'text-red-500',     badge: 'bg-red-900/20 border-red-900/30',        border: 'border-red-900/20',     stroke: '#ef4444' },
}

const CATEGORY_LABEL: Record<SmartBetCategory, string> = {
  resultado:  'Resultado',
  goles:      'Goles',
  porteria:   'Portería',
  corners:    'Corners',
  tarjetas:   'Tarjetas',
  disparos:   'Disparos',
  combinada:  'Combinada',
}

const CATEGORY_COLOR: Record<SmartBetCategory, string> = {
  resultado:  'text-emerald-500 bg-emerald-500/10',
  goles:      'text-amber-500 bg-amber-500/10',
  porteria:   'text-cyan-500 bg-cyan-500/10',
  corners:    'text-blue-500 bg-blue-500/10',
  tarjetas:   'text-red-500 bg-red-500/10',
  disparos:   'text-violet-500 bg-violet-500/10',
  combinada:  'text-fuchsia-500 bg-fuchsia-500/10',
}

const VOLATILITY: Record<VolatilityLevel, { label: string; text: string; bg: string }> = {
  LOW_VOLATILITY:    { label: 'Baja volatilidad',  text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  MEDIUM_VOLATILITY: { label: 'Vol. media',        text: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'    },
  HIGH_VOLATILITY:   { label: 'Alta volatilidad',  text: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20'        },
}

// ─── Cálculo de cuotas de referencia ─────────────────────────────────────────

function poissonCDF(lambda: number, n: number): number {
  if (lambda <= 0) return n >= 0 ? 1 : 0
  let cum = 0, term = Math.exp(-Math.min(lambda, 30))
  for (let i = 0; i <= n; i++) { cum += term; term *= lambda / (i + 1) }
  return Math.min(1, cum)
}

function computeFairProbs(
  prediction: any,
  homeStats: any,
  awayStats: any,
  match: any,
): Record<string, number> {
  const lH = Math.max(0.1, prediction.predicted_home_score ?? 1.2)
  const lA = Math.max(0.1, prediction.predicted_away_score ?? 0.9)

  const isKo = ['round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place']
    .includes(match?.phase ?? '')
  const gm = isKo ? 0.88 : 1.0
  const aH = lH * gm
  const aA = lA * gm
  const lt = aH + aA

  const lCorners = ((homeStats?.avg_corners ?? 4.5) + (awayStats?.avg_corners ?? 4.0)) * (isKo ? 0.93 : 1.0)
  const lCards   = (homeStats?.avg_yellow_cards ?? 1.8) + (awayStats?.avg_yellow_cards ?? 1.8) + (isKo ? 0.5 : 0)
  const lShots   = (homeStats?.avg_shots_on_target ?? 3.5) + (awayStats?.avg_shots_on_target ?? 3.2)

  return {
    home_win:           prediction.home_win_probability ?? 0.33,
    draw:               prediction.draw_probability     ?? 0.33,
    away_win:           prediction.away_win_probability ?? 0.33,
    dc_1x:              1 - (prediction.away_win_probability ?? 0.33),
    dc_x2:              1 - (prediction.home_win_probability ?? 0.33),
    over_0_5:           1 - poissonCDF(lt, 0),
    over_1_5:           1 - poissonCDF(lt, 1),
    over_2_5:           1 - poissonCDF(lt, 2),
    over_3_5:           1 - poissonCDF(lt, 3),
    btts_yes:           (1 - Math.exp(-aH)) * (1 - Math.exp(-aA)),
    btts_no:            1 - (1 - Math.exp(-aH)) * (1 - Math.exp(-aA)),
    clean_sheet_home:   Math.exp(-aA),
    clean_sheet_away:   Math.exp(-aH),
    corners_8_5:        1 - poissonCDF(lCorners, 8),
    corners_9_5:        1 - poissonCDF(lCorners, 9),
    corners_10_5:       1 - poissonCDF(lCorners, 10),
    cards_2_5:          1 - poissonCDF(lCards, 2),
    cards_3_5:          1 - poissonCDF(lCards, 3),
    cards_4_5:          1 - poissonCDF(lCards, 4),
    shots_ot_5_5:       1 - poissonCDF(lShots, 5),
    shots_ot_7_5:       1 - poissonCDF(lShots, 7),
  }
}

type MarketClass = '3way' | '2way' | 'secondary'

const BOOK_MARGINS: Record<string, Record<MarketClass, number>> = {
  Betplay: { '3way': 0.075, '2way': 0.090, secondary: 0.110 },
  Wplay:   { '3way': 0.065, '2way': 0.080, secondary: 0.100 },
  Betson:  { '3way': 0.085, '2way': 0.095, secondary: 0.120 },
}

function getMarketClass(marketId: string): MarketClass {
  if (['home_win', 'draw', 'away_win'].includes(marketId)) return '3way'
  if (marketId.startsWith('corners_') || marketId.startsWith('cards_') || marketId.startsWith('shots_ot_'))
    return 'secondary'
  return '2way'
}

function calcRefOdd(fairProb: number, bookmaker: string, marketId: string): number | null {
  if (fairProb <= 0.05 || fairProb >= 0.90) return null
  const margins = BOOK_MARGINS[bookmaker]
  if (!margins) return null
  const margin = margins[getMarketClass(marketId)]
  const impliedProb = fairProb * (1 + margin)
  if (impliedProb >= 1) return null
  const odd = Math.round((1 / impliedProb) * 100) / 100
  if (odd < 1.10) return null
  return odd
}

const REC_TO_MARKET: Record<string, string> = {
  home_win: 'home_win', draw: 'draw', away_win: 'away_win',
  dc_1x: 'dc_1x', dc_x2: 'dc_x2',
  over_0_5: 'over_0_5', over_1_5: 'over_1_5', over_2_5: 'over_2_5', over_3_5: 'over_3_5',
  btts_yes: 'btts_yes', btts_no: 'btts_no',
  cs_home: 'clean_sheet_home', cs_away: 'clean_sheet_away',
  corners_8_5: 'corners_8_5', corners_9_5: 'corners_9_5', corners_10_5: 'corners_10_5',
  cards_2_5: 'cards_2_5', cards_3_5: 'cards_3_5', cards_4_5: 'cards_4_5',
  shots_ot_5_5: 'shots_ot_5_5', shots_ot_7_5: 'shots_ot_7_5',
}

const CO_BOOKS = ['Betplay', 'Wplay', 'Betson'] as const

// ─── Gauge circular SVG ────────────────────────────────────────────────────────

const R   = 38
const C   = 2 * Math.PI * R
const ARC = C * 0.75

function ConfidenceGauge({ confidence, tier }: { confidence: number; tier: SmartBetTier }) {
  const progress = ARC * (confidence / 100)
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[135deg]">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#27272a" strokeWidth="9"
          strokeDasharray={`${ARC} ${C - ARC}`} strokeLinecap="round" />
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9"
          stroke={TIER[tier].stroke}
          strokeDasharray={`${progress} ${C - progress}`}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-[17px] font-bold mono leading-none', TIER[tier].text)}>
          {confidence}%
        </span>
        <span className="text-[8px] text-zinc-600 mt-0.5 uppercase tracking-widest">conf.</span>
      </div>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

interface Props {
  prediction:         any | null
  homeStats:          any | null
  awayStats:          any | null
  match:              any
  injuries:           any[]
  odds?:              any[]
  homeRecentMatches?: MatchFormEntry[]
  awayRecentMatches?: MatchFormEntry[]
}

export function SmartBetsPanel({
  prediction, homeStats, awayStats, match, injuries, odds,
  homeRecentMatches, awayRecentMatches,
}: Props) {
  const homeTeam = match?.home_team
  const awayTeam = match?.away_team

  const recs = useMemo(
    () => computeSmartBets(
      prediction, homeStats, awayStats, homeTeam, awayTeam, injuries,
      match, odds, homeRecentMatches, awayRecentMatches,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prediction?.id, homeStats, awayStats, homeTeam?.id, awayTeam?.id, match?.id, injuries, odds, homeRecentMatches, awayRecentMatches],
  )

  const fairProbsMap = useMemo(
    () => prediction ? computeFairProbs(prediction, homeStats, awayStats, match) : {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prediction?.id, homeStats, awayStats, match?.id],
  )

  const volatility = recs[0]?.volatility
  const consensus  = recs[0]?.consensusScore
  const mce        = recs[0]?.mcEvidence

  // Context chips
  const phase        = match?.phase ?? ''
  const isKnockout   = ['round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place'].includes(phase)
  const phaseLabel: Record<string, string> = {
    round_of_16: 'Octavos', quarter_final: 'Cuartos',
    semi_final: 'Semifinal', final: 'Final', third_place: '3er puesto',
  }
  const weatherRaw   = (match?.weather_condition ?? '').toLowerCase()
  const isBadWeather = /rain|wet|storm|wind|drizzle/i.test(weatherRaw)
  const tempC        = match?.weather_temp_celsius
  const isHot        = tempC != null && tempC > 32
  const homeRest     = match?.home_rest_days
  const awayRest     = match?.away_rest_days

  if (!prediction) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3">
        <Sparkles className="h-8 w-8 text-zinc-700" />
        <p className="text-sm font-medium text-zinc-500">Sin predicción disponible</p>
        <p className="text-xs text-center max-w-xs text-zinc-600">
          El motor necesita una predicción generada para calcular las recomendaciones.
        </p>
      </div>
    )
  }

  if (recs.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3">
        <Sparkles className="h-8 w-8 text-zinc-700" />
        <p className="text-sm font-medium text-zinc-500">Sin recomendaciones con suficiente confianza</p>
        <p className="text-xs text-center max-w-xs text-zinc-600">
          Ningún mercado supera el umbral mínimo de confianza para este partido.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Smart Bets AI · Motor de Forma</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {mce ? `Últimos ${mce.simulations} partidos analizados` : 'Análisis basado en forma reciente'} ·
              top {recs.length} mercados
            </p>
          </div>
        </div>

        {/* Chips de resumen */}
        {mce && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {volatility && (
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5', VOLATILITY[volatility].text, VOLATILITY[volatility].bg)}>
                <Activity className="h-2.5 w-2.5" />
                {VOLATILITY[volatility].label}
              </span>
            )}
            <span className="text-[10px] text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 rounded-full px-2 py-0.5">
              Consenso {consensus}/100
            </span>
            <span className="text-[10px] text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 rounded-full px-2 py-0.5">
              Local {mce.p50Goals}g · Visitante {mce.p80Goals}g
            </span>
          </div>
        )}
      </div>

      {/* Context chips */}
      {(isKnockout || isBadWeather || isHot || (homeRest != null && homeRest < 3) || (awayRest != null && awayRest < 3)) && (
        <div className="flex flex-wrap gap-1.5">
          {isKnockout && (
            <span className="text-[11px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-0.5">
              {phaseLabel[phase] ?? 'Eliminatoria'} — ajuste defensivo aplicado
            </span>
          )}
          {isBadWeather && (
            <span className="text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-0.5">
              {match.weather_condition} — ajuste de goles aplicado
            </span>
          )}
          {isHot && (
            <span className="text-[11px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-0.5">
              {tempC}°C — calor extremo reduce intensidad
            </span>
          )}
          {homeRest != null && homeRest < 3 && (
            <span className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5">
              Local: solo {homeRest}d descanso
            </span>
          )}
          {awayRest != null && awayRest < 3 && (
            <span className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5">
              Visitante: solo {awayRest}d descanso
            </span>
          )}
        </div>
      )}

      {/* Recommendation cards */}
      {recs.map((rec) => (
        <BetCard key={rec.id} rec={rec} fairProbsMap={fairProbsMap} odds={odds} />
      ))}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500/60 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Recomendaciones basadas en forma reciente y estadísticas del modelo — no garantizan el resultado
          ni constituyen asesoramiento financiero. Apuesta responsablemente. +18.
        </p>
      </div>
    </div>
  )
}

// ─── Tarjeta individual ────────────────────────────────────────────────────────

function BetCard({
  rec,
  fairProbsMap,
  odds,
}: {
  rec: SmartBetRecommendation
  fairProbsMap: Record<string, number>
  odds?: any[]
}) {
  const cfg = TIER[rec.tier]

  const marketId = REC_TO_MARKET[rec.id]

  // Preferir cuotas reales de BD (derivadas de Pinnacle) sobre el cálculo Poisson
  const coOdds = CO_BOOKS.map((bk) => {
    if (marketId && odds?.length) {
      const dbOdd = odds.find(
        (o: any) => o.market === marketId && o.bookmaker === bk && o.odds_value > 1.05,
      )
      if (dbOdd?.odds_value) return { bk, val: Number(dbOdd.odds_value), fromDb: true }
    }
    const fairProb = marketId != null ? (fairProbsMap[marketId] ?? null) : null
    const val = fairProb != null ? calcRefOdd(fairProb, bk, marketId!) : null
    return { bk, val, fromDb: false }
  })

  const bestVal    = coOdds.reduce((max, x) => (x.val != null && x.val > max ? x.val : max), 0)
  const hasCoOdds  = coOdds.some((x) => x.val != null)
  const hasRealOdds = coOdds.some((x) => x.fromDb)

  return (
    <div className={cn('card overflow-hidden border', cfg.border)}>
      {/* Barra de color superior */}
      <div className="h-0.5 w-full" style={{ backgroundColor: cfg.stroke }} />

      <div className="p-4 space-y-3">

        {/* Fila superior: rank · categoría · nombre · tier badge · edge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono font-bold text-zinc-600 shrink-0">#{rec.rank}</span>
          <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5', CATEGORY_COLOR[rec.category])}>
            {CATEGORY_LABEL[rec.category]}
          </span>
          <span className="text-sm font-bold text-white leading-tight">{rec.label}</span>
          <span className={cn('ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border', cfg.badge, cfg.text)}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.stroke }} />
            {cfg.label}
          </span>
          {rec.edge != null && (
            <span className={cn(
              'shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 border',
              rec.edge > 0
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                : 'text-zinc-500 bg-zinc-800/40 border-zinc-700/40',
            )}>
              Ventaja {rec.edge > 0 ? '+' : ''}{rec.edge.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Gauge + justificación */}
        <div className="flex items-start gap-4">
          <ConfidenceGauge confidence={rec.confidence} tier={rec.tier} />
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-xs text-zinc-300 leading-relaxed">{rec.justification}</p>
          </div>
        </div>

        {/* Evidencia de forma */}
        <div className="grid grid-cols-4 gap-px rounded-lg overflow-hidden bg-zinc-800/40 border border-zinc-800/60 text-center">
          <div className="bg-zinc-900/70 px-2 py-1.5">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Goles L.</p>
            <p className="text-xs font-bold text-zinc-300 mt-0.5">{rec.mcEvidence.p50Goals}/p</p>
          </div>
          <div className="bg-zinc-900/70 px-2 py-1.5">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Goles V.</p>
            <p className="text-xs font-bold text-zinc-300 mt-0.5">{rec.mcEvidence.p80Goals}/p</p>
          </div>
          <div className="bg-zinc-900/70 px-2 py-1.5">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Goles Tot.</p>
            <p className="text-xs font-bold text-zinc-300 mt-0.5">{rec.mcEvidence.p95Goals}/p</p>
          </div>
          <div className="bg-zinc-900/70 px-2 py-1.5">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Resultado</p>
            <p className="text-xs font-bold text-zinc-300 mt-0.5">
              {rec.mcEvidence.topScore}
              <span className="text-zinc-600 font-normal text-[9px] ml-0.5">({rec.mcEvidence.topScoreFreq}%)</span>
            </p>
          </div>
        </div>

        {/* Factores */}
        {(rec.factors.for.length > 0 || rec.factors.against.length > 0) && (
          <div className="space-y-1.5 border-t border-zinc-800/60 pt-2.5">
            {rec.factors.for.map((f, j) => (
              <div key={`f${j}`} className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-300 leading-snug">{f}</span>
              </div>
            ))}
            {rec.factors.against.map((f, j) => (
              <div key={`a${j}`} className="flex items-start gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-400 leading-snug">{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* Frecuencia de forma */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider shrink-0 w-20">Frec. forma</span>
          <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${rec.mcFrequency}%`, backgroundColor: cfg.stroke }} />
          </div>
          <span className={cn('text-[10px] font-bold mono shrink-0', cfg.text)}>{rec.mcFrequency}%</span>
        </div>

        {/* Cuotas Colombia — reales (Pinnacle) cuando están disponibles, estimadas como fallback */}
        {hasCoOdds && (
          <div className="border-t border-zinc-800/50 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider">
                {hasRealOdds ? 'Cuotas Colombia' : 'Cuotas ref. Colombia'}
              </p>
              <p className="text-[8px] text-zinc-700 italic">
                {hasRealOdds ? 'Pinnacle → margen real' : 'modelo Poisson · verificar'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {coOdds.map(({ bk, val }) => {
                const isBest = val != null && val === bestVal
                return (
                  <div
                    key={bk}
                    className={cn(
                      'rounded-lg px-2 py-2 text-center border',
                      isBest
                        ? 'bg-emerald-500/8 border-emerald-500/25'
                        : 'bg-zinc-900/50 border-zinc-800/50',
                    )}
                  >
                    <p className="text-[9px] font-semibold text-zinc-500 truncate">{bk}</p>
                    <p className={cn('text-base font-bold mono mt-0.5 leading-tight', isBest ? 'text-emerald-400' : 'text-zinc-300')}>
                      {val != null ? val.toFixed(2) : '—'}
                    </p>
                    {isBest && <p className="text-[8px] text-emerald-600 font-medium mt-0.5">mayor cuota</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
