'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { Flag } from '@/components/ui/Flag'
import { ProbBar1X2 } from '@/components/predictions/ProbBar1X2'

interface FinalMatch {
  id: string
  kickoff_time: string
  home_team: { name: string; code: string | null } | null
  away_team: { name: string; code: string | null } | null
  prediction: { home: number; draw: number; away: number } | null
}

interface Props {
  /** Fila real del partido de la final si ya existe en la BD */
  match: FinalMatch | null
  /** Fecha oficial FIFA (YYYY-MM-DD) como respaldo mientras no exista la fila */
  fallbackDate: string
}

function remaining(target: Date): { d: number; h: number; m: number } | null {
  const ms = target.getTime() - Date.now()
  if (ms <= 0) return null
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
  }
}

/**
 * Hero de la final del Mundial (playbook Sofascore, QW4). Mientras la fila
 * del partido no existe (el sync la crea cuando se definen los finalistas),
 * cuenta días a la fecha oficial; cuando existe, muestra finalistas,
 * probabilidad del modelo y cuenta exacta. Tras jugarse, desaparece.
 */
export function FinalCountdown({ match, fallbackDate }: Props) {
  // La fila real manda; el respaldo asume mediodía Bogotá para contar días
  const target = match ? new Date(match.kickoff_time) : new Date(`${fallbackDate}T12:00:00-05:00`)
  const [left, setLeft] = useState<{ d: number; h: number; m: number } | null>(() => remaining(target))

  useEffect(() => {
    const t = setInterval(() => setLeft(remaining(target)), 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.kickoff_time, fallbackDate])

  if (!left) return null // la final ya se jugó (o está en curso): el hero cede el lugar

  const body = match?.home_team && match?.away_team ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Flag code={match.home_team.code} /> {match.home_team.name}
        <span className="font-normal text-zinc-500">vs</span>
        <Flag code={match.away_team.code} /> {match.away_team.name}
      </div>
      {match.prediction && (
        <ProbBar1X2
          className="max-w-xs"
          home={match.prediction.home}
          draw={match.prediction.draw}
          away={match.prediction.away}
        />
      )}
    </div>
  ) : (
    <p className="text-sm text-zinc-400">
      Finalistas por definirse — el motor publicará su predicción cuando se
      conozcan.
    </p>
  )

  return (
    <section
      aria-label="Cuenta regresiva a la final"
      className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-zinc-900 to-zinc-900/60 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
            La final · 19 de julio
          </p>
        </div>
        <p className="mono text-sm font-bold text-white">
          {left.d > 0 ? `${left.d}d ${left.h}h` : `${left.h}h ${left.m}m`}
          <span className="ml-1 text-[10px] font-normal text-zinc-500">restantes</span>
        </p>
      </div>
      <div className="mt-2.5">{body}</div>
      <div className="mt-2.5">
        <Link
          href={match ? `/matches/${match.id}` : '/bracket'}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300"
        >
          {match ? 'ver análisis de la final →' : 'ver el camino a la final →'}
        </Link>
      </div>
    </section>
  )
}
