import type { CalibrationBucket } from '@/lib/calibration'

interface Props {
  buckets: CalibrationBucket[]
}

/**
 * Curva de calibración (vitrina de transparencia). Eje X = lo que el modelo
 * "prometió" (probabilidad del favorito); eje Y = lo que realmente ocurrió.
 * La diagonal es la calibración perfecta: cuanto más cerca de ella, más
 * honestas son las probabilidades. Solo se dibujan tramos con datos reales.
 * SVG puro, sin dependencias — server-compatible.
 */
export function CalibrationCurve({ buckets }: Props) {
  const withData = buckets.filter((b) => b.total > 0)
  if (withData.length === 0) {
    return <p className="text-xs text-zinc-500">Aún no hay suficientes predicciones resueltas para trazar la curva.</p>
  }

  const W = 320, H = 320, pad = 34
  const x = (v: number) => pad + (v - 0.33) / (1 - 0.33) * (W - 2 * pad)
  const y = (v: number) => H - pad - v * (H - 2 * pad)
  const maxTotal = Math.max(...withData.map((b) => b.total))

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[320px]" role="img"
        aria-label="Curva de calibración: probabilidad prometida vs acierto observado">
        {/* Marco */}
        <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="none" stroke="#3f3f46" strokeWidth="1" />
        {/* Diagonal de calibración perfecta */}
        <line x1={x(0.33)} y1={y(0.33)} x2={x(1)} y2={y(1)} stroke="#52525b" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - pad} y={y(1) + 12} fill="#71717a" fontSize="8" textAnchor="end">calibración perfecta</text>
        {/* Puntos observados (tamaño ∝ muestra) */}
        {withData.map((b, i) => {
          const cx = x(b.midpoint), cy = y(b.observed)
          const r = 3 + (b.total / maxTotal) * 5
          const over = b.observed >= b.midpoint // por encima de la diagonal = infra-confiado
          return (
            <g key={i}>
              <line x1={cx} y1={y(b.midpoint)} x2={cx} y2={cy} stroke="#3f3f46" strokeWidth="1" />
              <circle cx={cx} cy={cy} r={r} fill={over ? '#10b981' : '#f59e0b'} opacity="0.85" />
              <text x={cx} y={H - pad + 12} fill="#71717a" fontSize="8" textAnchor="middle">{b.label}</text>
            </g>
          )
        })}
        {/* Ejes */}
        <text x={W / 2} y={H - 4} fill="#a1a1aa" fontSize="9" textAnchor="middle">Probabilidad prometida (favorito)</text>
        <text x={12} y={H / 2} fill="#a1a1aa" fontSize="9" textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`}>Acierto observado</text>
      </svg>
      <p className="max-w-md text-center text-[11px] text-zinc-600">
        Cada punto es un tramo de probabilidad; su tamaño refleja cuántas
        predicciones contiene. Sobre la diagonal = el modelo fue prudente
        (acertó más de lo prometido); por debajo = fue optimista.
      </p>
    </div>
  )
}
