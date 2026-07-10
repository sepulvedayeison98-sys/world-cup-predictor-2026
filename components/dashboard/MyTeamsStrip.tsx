'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getFavorites, FAVORITES_EVENT, type FavoriteTeam } from '@/lib/favorites'
import { ACTIVE_COMPETITIONS } from '@/lib/sports'
import { ProbBar1X2 } from '@/components/predictions/ProbBar1X2'
import { Flag } from '@/components/ui/Flag'

interface StripMatch {
  id: string
  kickoff_time: string
  status: string
  competition_id: string
  home_team: { id: string; name: string; short_name: string | null; code: string | null } | null
  away_team: { id: string; name: string; short_name: string | null; code: string | null } | null
  home_score: number | null
  away_score: number | null
  predictions: { home_win_probability: number; draw_probability: number; away_win_probability: number }[] | null
}

/** Regla de oro: toda query a matches filtra por competición (lista blanca completa). */
const COMPETITION_WHITELIST = ACTIVE_COMPETITIONS.filter((c) => c.id).map((c) => c.id as string)

async function fetchStrip(teamIds: string[]): Promise<{ next: StripMatch[]; last: StripMatch[] }> {
  const supabase = createClient()
  const orFilter = `home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`
  const select = `
    id, kickoff_time, status, competition_id, home_score, away_score,
    home_team:teams!matches_home_team_id_fkey(id, name, short_name, code),
    away_team:teams!matches_away_team_id_fkey(id, name, short_name, code),
    predictions(home_win_probability, draw_probability, away_win_probability)
  `
  const [{ data: next }, { data: last }] = await Promise.all([
    supabase.from('matches').select(select)
      .in('competition_id', COMPETITION_WHITELIST)
      .or(orFilter)
      .in('status', ['scheduled', 'live'])
      .order('kickoff_time', { ascending: true })
      .limit(12),
    supabase.from('matches').select(select)
      .in('competition_id', COMPETITION_WHITELIST)
      .or(orFilter)
      .eq('status', 'finished')
      .order('kickoff_time', { ascending: false })
      .limit(12),
  ])
  return { next: (next ?? []) as unknown as StripMatch[], last: (last ?? []) as unknown as StripMatch[] }
}

/**
 * Franja "Mis equipos" (playbook Sofascore, QW3): los favoritos del usuario
 * primero. Por cada equipo, su próximo partido con la probabilidad del
 * modelo — o su último resultado si no tiene nada programado (fin de
 * temporada/torneo). Sin favoritos no renderiza nada: cero ruido.
 */
export function MyTeamsStrip() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([])

  useEffect(() => {
    const sync = () => setFavorites(getFavorites())
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const ids = favorites.map((f) => f.id)
  const { data } = useQuery({
    queryKey: ['my-teams-strip', ids],
    queryFn: () => fetchStrip(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  })

  if (favorites.length === 0) return null

  // Un partido por favorito: el próximo si existe, si no el último jugado
  const cards = favorites.map((fav) => {
    const next = data?.next.find((m) => m.home_team?.id === fav.id || m.away_team?.id === fav.id)
    const last = data?.last.find((m) => m.home_team?.id === fav.id || m.away_team?.id === fav.id)
    return { fav, match: next ?? last ?? null, isNext: Boolean(next) }
  })

  return (
    <section aria-label="Mis equipos">
      <div className="mb-2 flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Mis equipos</h2>
        <span className="text-[10px] text-zinc-600">— guardados en este navegador</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {cards.map(({ fav, match, isNext }) => {
          const p = match?.predictions?.[0]
          return (
            <div key={fav.id} className="w-64 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                <Flag code={fav.code} />
                <span className="truncate">{fav.name}</span>
              </p>
              {match ? (
                <Link href={`/matches/${match.id}`} className="mt-2 block group">
                  <p className="truncate text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    {match.home_team?.short_name ?? match.home_team?.name} vs {match.away_team?.short_name ?? match.away_team?.name}
                  </p>
                  {isNext ? (
                    <>
                      <p className="text-[10px] text-zinc-600">
                        {match.status === 'live' ? (
                          <span className="font-bold text-emerald-400">● EN VIVO</span>
                        ) : (
                          new Date(match.kickoff_time).toLocaleString('es-CO', {
                            timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })
                        )}
                      </p>
                      {p && (
                        <ProbBar1X2
                          className="mt-1.5"
                          home={Number(p.home_win_probability)}
                          draw={Number(p.draw_probability)}
                          away={Number(p.away_win_probability)}
                        />
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-zinc-500 mono">
                      Último: {match.home_score}–{match.away_score}
                    </p>
                  )}
                </Link>
              ) : (
                <p className="mt-2 text-[11px] text-zinc-600">Sin partidos registrados</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
