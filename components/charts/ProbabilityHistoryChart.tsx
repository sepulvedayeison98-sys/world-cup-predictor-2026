'use client'

import { useQuery } from '@tanstack/react-query'
import { matchesService } from '@/services/matches.service'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  matchId: string
}

export function ProbabilityHistoryChart({ matchId }: Props) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['prediction-history', matchId],
    queryFn: () => matchesService.getPredictionHistory(matchId),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="mb-3 h-4 w-48 animate-pulse rounded bg-zinc-800" />
        <div className="h-40 animate-pulse rounded-lg bg-zinc-800" />
      </div>
    )
  }

  if (!history || history.length === 0) {
    return null
  }

  const chartData = history.map((h: any) => ({
    time: format(new Date(h.snapshot_at), "d MMM HH:mm", { locale: es }),
    local: Math.round(h.home_win_probability * 100),
    empate: Math.round(h.draw_probability * 100),
    visitante: Math.round(h.away_win_probability * 100),
    trigger: h.trigger,
  }))

  return (
    <div className="card p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Evolución de Probabilidades</h3>
        <p className="text-[11px] text-zinc-500">Cómo han cambiado las probabilidades antes del partido</p>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: '#71717a', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#71717a', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(value: number, name: string) => [`${value}%`, name]}
          />
          <ReferenceLine y={33} stroke="#3f3f46" strokeDasharray="4 2" opacity={0.5} />
          <Line
            type="monotone" dataKey="local"
            stroke="#10b981" strokeWidth={2}
            dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            name="Local"
          />
          <Line
            type="monotone" dataKey="empate"
            stroke="#f59e0b" strokeWidth={2}
            dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
            name="Empate"
          />
          <Line
            type="monotone" dataKey="visitante"
            stroke="#ef4444" strokeWidth={2}
            dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
            name="Visitante"
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#71717a', paddingTop: 8 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Trigger labels */}
      <div className="mt-2 flex flex-wrap gap-1">
        {chartData.map((d: any, i: number) => {
          const triggerMap: Record<string, string> = {
            lineup_update: '📋 Alineación',
            injury_update: '🏥 Lesión',
            odds_movement: '📈 Cuotas',
            manual: '✏️ Manual',
            scheduled: '🕒 Auto',
          }
          return d.trigger !== 'scheduled' ? (
            <span key={i} className="rounded px-1.5 py-0.5 text-[9px] bg-zinc-800 text-zinc-500 border border-zinc-700">
              {d.time}: {triggerMap[d.trigger] ?? d.trigger}
            </span>
          ) : null
        })}
      </div>
    </div>
  )
}
