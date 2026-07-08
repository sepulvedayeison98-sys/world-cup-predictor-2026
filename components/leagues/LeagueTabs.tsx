'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StandingsTable } from '@/components/leagues/StandingsTable'
import type { LeagueStandingRow } from '@/lib/leagueStandings'

export interface LeagueTabData {
  key: string
  slug: string | null
  name: string
  season: string
  country: string
  standings: LeagueStandingRow[]
}

export function LeagueTabs({ leagues }: { leagues: LeagueTabData[] }) {
  const [active, setActive] = useState(leagues[0]?.key)
  const league = leagues.find((l) => l.key === active) ?? leagues[0]
  if (!league) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de liga */}
      <div className="flex flex-wrap gap-2">
        {leagues.map((l) => (
          <button
            key={l.key}
            onClick={() => setActive(l.key)}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
              l.key === active
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
            )}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Tabla de posiciones */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-white">{league.name}</h2>
            <p className="text-xs text-zinc-500">{league.country} · Temporada {league.season}</p>
          </div>
          {league.slug && (
            <Link
              href={`/ligas/${league.slug}`}
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Calendario y modelo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <StandingsTable standings={league.standings} />
      </div>
    </div>
  )
}
