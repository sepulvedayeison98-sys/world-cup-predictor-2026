import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { LEAGUE_COMPETITION_IDS } from '@/lib/constants'
import { computeLeagueStandings } from '@/lib/leagueStandings'
import { LeagueTabs, type LeagueTabData } from '@/components/leagues/LeagueTabs'

export const metadata: Metadata = {
  title: 'Ligas | World Cup Predictor',
}

export const revalidate = 300 // los datos de liga cambian poco (temporada histórica)

export default async function LigasPage() {
  const supabase = await createServerSupabaseClient()
  const leagueIds = Object.values(LEAGUE_COMPETITION_IDS)

  const { data: competitions } = await supabase
    .from('competitions')
    .select('id, name, season, country')
    .in('id', leagueIds)
    .order('name')

  const leagues: LeagueTabData[] = []
  for (const comp of (competitions ?? []) as any[]) {
    const [{ data: teams }, { data: matches }] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, code, logo_url')
        .eq('competition_id', comp.id),
      supabase
        .from('matches')
        .select('home_team_id, away_team_id, home_score, away_score, status, kickoff_time')
        .eq('competition_id', comp.id),
    ])
    if (!teams?.length) continue
    leagues.push({
      key: comp.id,
      name: comp.name,
      season: comp.season,
      country: comp.country ?? '',
      standings: computeLeagueStandings(teams as any[], (matches ?? []) as any[]),
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Fútbol de Clubes
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Ligas</h1>
        <p className="text-sm text-zinc-400">
          Premier League y La Liga — temporada 2024-25 completa como base del motor.
          La temporada 2026-27 se activará en vivo con su arranque en agosto.
        </p>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-400">
            Los datos de las ligas aún no han sido cargados. Vuelve en unos minutos.
          </p>
        </div>
      ) : (
        <LeagueTabs leagues={leagues} />
      )}

      <p className="text-[11px] text-zinc-600">
        Fuente: API-Football (api-sports.io) · Posiciones calculadas a partir de los
        resultados oficiales de cada jornada.
      </p>
    </div>
  )
}
