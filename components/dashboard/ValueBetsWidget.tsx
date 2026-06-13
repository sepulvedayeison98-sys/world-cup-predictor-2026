'use client'

import { Zap, ChevronRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ValueBet } from '@/types'

const MARKET_LABELS: Record<string, string> = {
  home_win: 'Victoria Local',
  draw: 'Empate',
  away_win: 'Victoria Visitante',
  over_2_5: 'Más de 2.5 goles',
  over_1_5: 'Más de 1.5 goles',
  btts_yes: 'Ambos marcan: Sí',
  btts_no: 'Ambos marcan: No',
  clean_sheet_home: 'Portería a 0 Local',
  clean_sheet_away: 'Portería a 0 Visitante',
}

const GRADE_CONFIG = {
  high:   { label: 'ALTO VALOR',  className: 'grade-high' },
  medium: { label: 'VALOR MEDIO', className: 'grade-medium' },
  low:    { label: 'BAJO VALOR',  className: 'grade-low' },
  none:   { label: 'SIN VALOR',   className: 'grade-none' },
}

interface Props {
  bets: ValueBet[]
}

export function ValueBetsWidget({ bets }: Props) {
  const activeBets = bets.filter((b) => b.grade !== 'none').slice(0, 4)

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-violet-400" />
            Apuestas de Valor
          </h2>
          <p className="text-[11px] text-zinc-500">EV positivo detectado</p>
        </div>
        <Link
          href="/value-bets"
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Ver todas <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {activeBets.length === 0 ? (
        <div className="py-8 text-center">
          <Zap className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">Sin apuestas activas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeBets.map((bet) => {
            const grade = GRADE_CONFIG[bet.grade] ?? GRADE_CONFIG.none
            const ev = bet.expected_value
            const edge = (bet.edge * 100).toFixed(1)

            return (
              <Link
                key={bet.id}
                href={`/matches/${bet.match_id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 hover:border-zinc-700 transition-colors"
              >
                {/* Grade badge */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border',
                      grade.className
                    )}
                  >
                    {grade.label}
                  </span>
                  <span className="text-[10px] text-zinc-500">{bet.bookmaker}</span>
                </div>

                {/* Match + market */}
                {bet.match && (
                  <p className="text-xs font-medium text-zinc-300 mb-0.5">
                    {(bet.match as any).home_team?.code} vs {(bet.match as any).away_team?.code}
                  </p>
                )}
                <p className="text-[11px] text-zinc-400 mb-2">
                  {MARKET_LABELS[bet.market] ?? bet.market}
                </p>

                {/* Odds + EV */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[9px] text-zinc-600">Cuota</p>
                      <p className="text-sm font-bold mono text-white">
                        {bet.odds_value.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-600">Modelo</p>
                      <p className="text-xs font-semibold mono text-emerald-400">
                        {(bet.model_probability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-600">Implícita</p>
                      <p className="text-xs font-semibold mono text-zinc-400">
                        {(bet.implied_probability * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-zinc-600">EV</p>
                    <p
                      className={cn(
                        'text-sm font-bold mono flex items-center gap-0.5',
                        ev > 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      <TrendingUp className="h-3 w-3" />
                      {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
