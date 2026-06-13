'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts'

// ─── Mock data — replace with real query ─────────────────────
const ROI_DATA = [
  { date: 'Jun 11', roi: 0, cumulative: 0 },
  { date: 'Jun 12', roi: 12.5, cumulative: 12.5 },
  { date: 'Jun 13', roi: -5.2, cumulative: 7.3 },
  { date: 'Jun 14', roi: 18.1, cumulative: 25.4 },
  { date: 'Jun 15', roi: 8.4, cumulative: 33.8 },
]

const ACCURACY_DATA = [
  { phase: 'Grupos', accuracy: 72, sample: 18 },
  { phase: '1/16', accuracy: 68, sample: 0 },
  { phase: '1/4', accuracy: 75, sample: 0 },
  { phase: '1/2', accuracy: 80, sample: 0 },
  { phase: 'Final', accuracy: 0, sample: 0 },
]

// ─── Custom tooltip ───────────────────────────────────────────
function ROITooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
      <p className="mb-2 text-xs font-semibold text-zinc-300">{label}</p>
      <p className="text-xs text-zinc-400">
        ROI día:{' '}
        <span className={payload[0]?.value >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {payload[0]?.value >= 0 ? '+' : ''}{payload[0]?.value?.toFixed(1)}%
        </span>
      </p>
      <p className="text-xs text-zinc-400">
        ROI acumulado:{' '}
        <span className={payload[1]?.value >= 0 ? 'text-blue-400' : 'text-red-400'}>
          {payload[1]?.value >= 0 ? '+' : ''}{payload[1]?.value?.toFixed(1)}%
        </span>
      </p>
    </div>
  )
}

export function ROIChart() {
  return (
    <div className="card p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Evolución ROI</h3>
        <p className="text-[11px] text-zinc-500">Rendimiento acumulado de picks</p>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={ROI_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<ROITooltip />} />
          <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="4 2" />
          <Line
            type="monotone"
            dataKey="roi"
            stroke="#6366f1"
            strokeWidth={1.5}
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#6366f1' }}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded bg-violet-500" />
          <span className="text-[10px] text-zinc-500">ROI diario</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded bg-emerald-500" />
          <span className="text-[10px] text-zinc-500">Acumulado</span>
        </div>
      </div>
    </div>
  )
}

export function PredictionAccuracyChart() {
  return (
    <div className="card p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">Precisión por Fase</h3>
        <p className="text-[11px] text-zinc-500">% pronósticos correctos</p>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={ACCURACY_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="phase"
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#71717a', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const acc = payload[0]?.value as number
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                  <p className="text-xs font-semibold text-zinc-300">{label}</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Precisión:{' '}
                    <span className={acc >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                      {acc}%
                    </span>
                  </p>
                </div>
              )
            }}
          />
          <ReferenceLine y={70} stroke="#10b981" strokeDasharray="4 2" opacity={0.4} />
          <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
            {ACCURACY_DATA.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.accuracy === 0
                    ? '#27272a'
                    : entry.accuracy >= 70
                    ? '#10b981'
                    : '#f59e0b'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
