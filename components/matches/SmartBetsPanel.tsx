'use client'

import { useState } from 'react'
import { Sparkles, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  computeSmartBets,
  type SmartBetTier,
  type SmartBetCategory,
  type SmartBetRecommendation,
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

const MEDALS = ['🥇', '🥈', '🥉']

// ─── Gauge circular SVG ────────────────────────────────────────────────────────

const R   = 38
const C   = 2 * Math.PI * R          // ≈ 238.76
const ARC = C * 0.75                  // 270° de arco útil

function ConfidenceGauge({ confidence, tier }: { confidence: number; tier: SmartBetTier }) {
  const progress = ARC * (confidence / 100)
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      {/* SVG rotado para que el hueco quede abajo */}
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[135deg]">
        {/* Pista gris */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="#27272a" strokeWidth="9"
          strokeDasharray={`${ARC} ${C - ARC}`} strokeLinecap="round" />
        {/* Progreso coloreado */}
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9"
          stroke={TIER[tier].stroke}
          strokeDasharray={`${progress} ${C - progress}`}
          strokeLinecap="round" />
      </svg>
      {/* Texto centrado (no rotado) */}
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
  prediction: any | null
  homeStats:  any | null
  awayStats:  any | null
  match:      any
  injuries:   any[]
}

export function SmartBetsPanel({ prediction, homeStats, awayStats, match, injuries }: Props) {
  const [showOthers, setShowOthers] = useState(false)

  const homeTeam = match?.home_team
  const awayTeam = match?.away_team

  const all = computeSmartBets(prediction, homeStats, awayStats, homeTeam, awayTeam, injuries, match)

  // Top-3: máximo 1 recomendación por familia de mercado para garantizar diversidad.
  // Variantes del mismo umbral (over_1.5 + over_2.5, corners 8.5 + 9.5, etc.)
  // no ocupan dos slots — la segunda va al apartado "otros".
  function getFamily(id: string): string {
    if (id.startsWith('over_'))     return 'over_goals'
    if (id.startsWith('corners_'))  return 'corners'
    if (id.startsWith('cards_'))    return 'cards'
    if (id.startsWith('shots_ot_')) return 'shots_ot'
    return id
  }
  const seenFamilies = new Set<string>()
  const top: typeof all = []
  for (const rec of all) {
    if (top.length >= 3) break
    const fam = getFamily(rec.id)
    if (!seenFamilies.has(fam)) { seenFamilies.add(fam); top.push(rec) }
  }
  const others = all.filter(r => !top.includes(r))

  // ── Context chips (fase, clima, bajas) ──────────────────────────────────────
  const phase      = match?.phase ?? ''
  const isKnockout = ['round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place'].includes(phase)
  const phaseLabel: Record<string, string> = {
    round_of_16:   'Octavos de final', quarter_final: 'Cuartos de final',
    semi_final:    'Semifinal',        final:         'Final',
    third_place:   'Tercer puesto',
  }
  const weatherRaw  = (match?.weather_condition ?? '').toLowerCase()
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

  if (top.length === 0) {
    return (
      <div className="card p-10 flex flex-col items-center gap-3">
        <Sparkles className="h-8 w-8 text-zinc-700" />
        <p className="text-sm font-medium text-zinc-500">Sin recomendaciones con suficiente confianza</p>
        <p className="text-xs text-center max-w-xs text-zinc-600">
          Ningún mercado supera el umbral mínimo de confianza (60%) para este partido.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Smart Bets AI</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {all.length} mercados evaluados · mostrando los {top.length} con mayor confianza
            </p>
          </div>
        </div>
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
              ☁ {match.weather_condition} — ajuste de goles aplicado
            </span>
          )}
          {isHot && (
            <span className="text-[11px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-0.5">
              🌡 {tempC}°C — calor extremo reduce intensidad
            </span>
          )}
          {homeRest != null && homeRest < 3 && (
            <span className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5">
              ⚡ Local: solo {homeRest}d descanso
            </span>
          )}
          {awayRest != null && awayRest < 3 && (
            <span className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-0.5">
              ⚡ Visitante: solo {awayRest}d descanso
            </span>
          )}
        </div>
      )}

      {/* Top 3 cards */}
      {top.map((rec, i) => (
        <BetCard key={rec.id} rec={rec} rank={i} />
      ))}

      {/* Otros mercados — colapsable */}
      {others.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowOthers(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span className="font-medium">
              {showOthers ? 'Ocultar' : 'Ver'} {others.length} mercado{others.length !== 1 ? 's' : ''} más analizados
            </span>
            {showOthers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showOthers && (
            <div className="border-t border-zinc-800 divide-y divide-zinc-800/60">
              {others.map((rec) => {
                const cfg = TIER[rec.tier]
                const barW = Math.max(2, ARC * (rec.confidence / 100) / ARC * 100)
                return (
                  <div key={rec.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={cn('text-[10px] font-semibold border rounded px-1.5 py-0.5 shrink-0', cfg.badge, cfg.text)}>
                      {cfg.label}
                    </span>
                    <span className="flex-1 text-xs text-zinc-400 min-w-0 truncate">{rec.label}</span>
                    <span className={cn('text-xs mono font-bold shrink-0', cfg.text)}>{rec.confidence}%</span>
                    <div className="w-14 h-1 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: cfg.stroke }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500/60 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Predicciones estadísticas del motor — no garantizan el resultado ni constituyen
          asesoramiento financiero. Apuesta responsablemente. +18.
        </p>
      </div>
    </div>
  )
}

// ─── Tarjeta individual ────────────────────────────────────────────────────────

function BetCard({ rec, rank }: { rec: SmartBetRecommendation; rank: number }) {
  const cfg = TIER[rec.tier]

  return (
    <div className={cn('card overflow-hidden border', cfg.border)}>
      {/* Barra de color superior */}
      <div className="h-0.5 w-full" style={{ backgroundColor: cfg.stroke }} />

      <div className="p-4 space-y-3">
        {/* Fila superior: medalla + categoría chip + nombre del mercado + tier badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base leading-none">{MEDALS[rank] ?? `#${rank + 1}`}</span>
          <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5', CATEGORY_COLOR[rec.category])}>
            {CATEGORY_LABEL[rec.category]}
          </span>
          <span className="text-sm font-bold text-white leading-tight">{rec.label}</span>
          <span className={cn('ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border', cfg.badge, cfg.text)}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.stroke }} />
            {cfg.label}
          </span>
        </div>

        {/* Gauge + justificación */}
        <div className="flex items-start gap-4">
          <ConfidenceGauge confidence={rec.confidence} tier={rec.tier} />
          <div className="flex-1 min-w-0 space-y-2 pt-1">
            <p className="text-xs text-zinc-300 leading-relaxed">{rec.justification}</p>
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
      </div>
    </div>
  )
}
