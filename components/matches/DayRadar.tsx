import Link from 'next/link'
import { Swords, TrendingUp, Scale, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RadarPick { m: any; p: any }

/**
 * Radar del día: cuatro lecturas del mismo lote de partidos, cada una con
 * un criterio REAL y verificable — nunca "destacado" a ojo:
 *   - Partido destacado: mayor ELO medio de los dos equipos (el cruce de
 *     mejor nivel, con el dato que sí existe; no hay señal de popularidad
 *     real que usar).
 *   - Mayor confianza: mayor confidence_score del modelo.
 *   - Más equilibrado: menor margen entre el resultado favorito y el
 *     segundo — lo más parecido a una moneda al aire.
 *   - Smart Bet del día: el pick sin resolver de mayor confianza, si hay
 *     alguno — si no hay, la tarjeta no aparece, no se inventa una.
 *
 * Los tres primeros solo se calculan sobre partidos con base real (ambos
 * equipos ya calentaron) — nunca sobre el prior de arranque. Si nadie
 * calentó todavía (arranque de temporada) esas tres tarjetas no llegan
 * (undefined desde la página) y sencillamente no se dibujan — sin sección
 * vacía ni destacado inventado. Con la temporada recién empezada, ver el
 * radar reducido a solo el Smart Bet (o directamente ausente) es correcto.
 */
export function DayRadar({
  featured,
  mostConfident,
  mostBalanced,
  smartBet,
  competitionName,
}: {
  featured?: RadarPick
  mostConfident?: RadarPick
  mostBalanced?: RadarPick
  smartBet?: { match: any; label: string; confidence: number } | null
  competitionName: (id: string) => string
}) {
  if (!featured && !mostConfident && !mostBalanced && !smartBet) return null

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-bold text-white">Radar del día</h2>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Lecturas del motor sobre los partidos de hoy, no una selección editorial.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {featured && (
            <RadarCard
              icon={Swords} accent="sky" title="Partido destacado"
              detail="mayor nivel combinado (ELO)"
              pick={featured} competitionName={competitionName}
            />
          )}
          {mostConfident && (
            <RadarCard
              icon={TrendingUp} accent="emerald" title="Mayor confianza"
              detail={`${mostConfident.p.confidence_score.toFixed(0)}% de confianza del modelo`}
              pick={mostConfident} competitionName={competitionName}
            />
          )}
          {mostBalanced && (
            <RadarCard
              icon={Scale} accent="amber" title="Más equilibrado"
              detail="el modelo no ve un favorito claro"
              pick={mostBalanced} competitionName={competitionName}
            />
          )}
          {smartBet && (
            <Link
              href={`/matches/${smartBet.match.id}`}
              className="group flex flex-col justify-between rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-violet-500/40 active:scale-[0.98]"
            >
              <div>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10 text-violet-400">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Smart Bet del día</p>
                <p className="mt-0.5 text-sm font-bold text-zinc-100 group-hover:underline">{smartBet.label}</p>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                {smartBet.match.home_team?.short_name} vs {smartBet.match.away_team?.short_name}
                <span className="mono text-violet-400"> · {smartBet.confidence.toFixed(0)}%</span>
              </p>
            </Link>
          )}
      </div>
    </div>
  )
}

const ACCENT = {
  sky:     { icon: 'bg-sky-500/10 text-sky-400', border: 'hover:border-sky-500/40' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-400', border: 'hover:border-emerald-500/40' },
  amber:   { icon: 'bg-amber-500/10 text-amber-400', border: 'hover:border-amber-500/40' },
} as const

function RadarCard({
  icon: Icon,
  accent,
  title,
  detail,
  pick,
  competitionName,
}: {
  icon: typeof Swords
  accent: keyof typeof ACCENT
  title: string
  detail: string
  pick: RadarPick
  competitionName: (id: string) => string
}) {
  const a = ACCENT[accent]
  const { m, p } = pick
  return (
    <Link
      href={`/matches/${m.id}`}
      className={cn(
        'group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3',
        'transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]',
        a.border,
      )}
    >
      <div>
        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md', a.icon)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-zinc-100 group-hover:underline">
          {m.home_team?.short_name ?? m.home_team?.name} vs {m.away_team?.short_name ?? m.away_team?.name}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <span className="truncate">{competitionName(m.competition_id)}</span>
        <span className="shrink-0">{detail}</span>
      </div>
    </Link>
  )
}
