import { CalendarDays, Radio, Layers, Target, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Resumen del día en la agenda. Deliberadamente NO son cinco tarjetas
 * idénticas: "Partidos del día" es la pieza principal (más grande, es el
 * número que responde "¿cuánto hay hoy?") y el resto son secundarias, del
 * mismo tamaño entre sí pero más compactas. Todos los números sacan de la
 * MISMA consulta que arma el radar — nada se calcula dos veces con criterios
 * distintos.
 */
export function DayKpiStrip({
  today,
  live,
  competitions,
  highConfidence,
  smartBets,
  dateLabel,
}: {
  today: number
  live: number
  competitions: number
  highConfidence: number
  smartBets: number
  /** Día que resume el panel — nunca "hoy" a secas: puede ser el próximo
   *  día con partidos si hoy no hay ninguno, y este panel no sigue la
   *  navegación de fecha de la tabla de abajo. */
  dateLabel: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
      {/* Pieza principal: ocupa el doble en móvil, mismo ancho que las
          demás desde sm — el peso visual viene del tamaño del número y el
          fondo con gradiente, no de ocupar más espacio en escritorio. */}
      <div className="relative col-span-2 overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-900 p-4 sm:col-span-1">
        <CalendarDays className="h-4 w-4 text-emerald-400" />
        <p className="mt-2 text-3xl font-black mono text-white">{today}</p>
        <p className="text-[11px] font-medium text-zinc-400">
          {today === 1 ? 'partido' : 'partidos'} · {dateLabel}
        </p>
      </div>

      <SecondaryKpi
        icon={Radio}
        value={live}
        label={live === 1 ? 'en vivo' : 'en vivo'}
        accent={live > 0 ? 'live' : 'zinc'}
        pulse={live > 0}
      />
      <SecondaryKpi icon={Layers} value={competitions} label={competitions === 1 ? 'competición' : 'competiciones'} accent="sky" />
      <SecondaryKpi icon={Target} value={highConfidence} label="alta confianza" accent="amber" />
      <SecondaryKpi icon={Zap} value={smartBets} label="smart bets" accent="purple" />
    </div>
  )
}

const ACCENT = {
  zinc:   { icon: 'text-zinc-400', ring: '' },
  live:   { icon: 'text-red-400', ring: 'border-red-500/20' },
  sky:    { icon: 'text-sky-400', ring: '' },
  amber:  { icon: 'text-amber-400', ring: '' },
  purple: { icon: 'text-violet-400', ring: '' },
} as const

function SecondaryKpi({
  icon: Icon,
  value,
  label,
  accent,
  pulse,
}: {
  icon: typeof Radio
  value: number
  label: string
  accent: keyof typeof ACCENT
  pulse?: boolean
}) {
  const a = ACCENT[accent]
  return (
    <div className={cn('rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3', a.ring)}>
      <span className="relative inline-flex">
        <Icon className={cn('h-3.5 w-3.5', a.icon)} />
        {pulse && (
          <span className="absolute -right-1 -top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
        )}
      </span>
      <p className="mt-1.5 text-xl font-black mono text-white">{value}</p>
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  )
}
