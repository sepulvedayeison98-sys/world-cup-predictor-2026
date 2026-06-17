/**
 * Versión en tiempo real del componente ValueBetsWidget.
 * Muestra las apuestas de valor de PRÓXIMOS partidos, ordenadas por mejor EV,
 * con banderas, cuándo se juega y el stake sugerido (Kelly).
 */

'use client'

import Link from 'next/link'
import { Zap, TrendingUp, Radio, ChevronRight } from 'lucide-react'
import { format, differenceInHours, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Flag } from '@/components/ui/Flag'
import { useRealtimeValueBets } from '@/hooks/useRealtimeValueBets'

const MARKET_LABELS: Record<string, string> = {
  home_win: 'Victoria Local',
  draw: 'Empate',
  away_win: 'Victoria Visitante',
  over_0_5: 'Más de 0.5 goles',
  over_1_5: 'Más de 1.5 goles',
  over_2_5: 'Más de 2.5 goles',
  over_3_5: 'Más de 3.5 goles',
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

/** "en 3 h" si es pronto, "Hoy 19:00", "Mañana 14:00", o "18 jun · 16:00". */
function formatKickoff(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hrs = differenceInHours(d, new Date())
  const hhmm = format(d, 'HH:mm')
  if (hrs >= 0 && hrs < 12) return `en ${Math.max(1, hrs)} h`
  if (isToday(d)) return `Hoy ${hhmm}`
  if (isTomorrow(d)) return `Mañana ${hhmm}`
  return format(d, "d MMM · HH:mm", { locale: es })
}

export function ValueBetsWidgetRealtime() {
  const { valueBets: bets, totalUpcoming, isLive, isLoading } = useRealtimeValueBets({ limit: 5 })
  const activeBets = bets.filter((b) => b.grade !== 'none').slice(0, 4)

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Apuestas de Valor</CardTitle>
        <div className="flex items-center gap-2">
          {totalUpcoming > 0 && (
            <Link
              href="/value-bets"
              className="flex items-center gap-0.5 text-[11px] text-emerald-400 hover:text-emerald-300"
            >
              {activeBets.length} de {totalUpcoming} · Ver todas
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
          <span title={isLive ? 'Datos en tiempo real conectados' : 'Sin conexión en tiempo real'}>
            <Radio className={cn('h-3 w-3', isLive ? 'text-emerald-400 animate-pulse' : 'text-zinc-600')} />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full mb-2" />
          ))
        ) : activeBets.length === 0 ? (
          <div className="py-8 text-center">
            <Zap className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">Sin apuestas de valor para próximos partidos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeBets.map((bet) => {
              const grade = GRADE_CONFIG[bet.grade] ?? GRADE_CONFIG.none
              const ev = bet.expected_value ?? 0
              const edge = (bet as any).edge ?? (bet.model_probability - bet.implied_probability)
              const stake = (bet as any).stake_suggestion_percent as number | undefined
              const match = bet.match as any
              return (
                <Link
                  key={bet.id}
                  href={`/matches/${bet.match_id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 hover:border-zinc-700 transition-colors"
                >
                  {/* Grado + cuándo juega */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border',
                        grade.className
                      )}
                    >
                      {grade.label}
                    </span>
                    {match?.kickoff_time && (
                      <span className="text-[10px] font-medium text-zinc-400">
                        {formatKickoff(match.kickoff_time)}
                      </span>
                    )}
                  </div>

                  {/* Partido con banderas */}
                  {match && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 mb-0.5">
                      <Flag code={match.home_team?.code} />
                      {match.home_team?.code} vs {match.away_team?.code}
                      <Flag code={match.away_team?.code} />
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-400 mb-2">
                    {MARKET_LABELS[bet.market] ?? bet.market}
                    <span className="text-zinc-600"> · {bet.bookmaker}</span>
                  </p>

                  {/* Cuota · EV · Stake sugerido */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] text-zinc-600">Cuota</p>
                      <p className="text-sm font-bold mono text-white">{bet.odds_value.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-600">EV</p>
                      <p className={cn('text-sm font-bold mono flex items-center gap-0.5', ev > 0 ? 'text-emerald-400' : 'text-red-400')}>
                        <TrendingUp className="h-3 w-3" />
                        {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-zinc-600">Apostar</p>
                      <p className="text-sm font-bold mono text-violet-400">
                        {stake && stake > 0 ? `${stake.toFixed(1)}%` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Edge: modelo vs implícita, con mini-barra */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-0.5">
                      <span>Modelo {(bet.model_probability * 100).toFixed(0)}% vs implícita {(bet.implied_probability * 100).toFixed(0)}%</span>
                      <span className={cn('font-semibold', edge > 0 ? 'text-emerald-400' : 'text-red-400')}>
                        edge {edge > 0 ? '+' : ''}{(edge * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', edge > 0 ? 'bg-emerald-500' : 'bg-red-500')}
                        style={{ width: `${Math.min(100, Math.abs(edge) * 100 * 4)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
