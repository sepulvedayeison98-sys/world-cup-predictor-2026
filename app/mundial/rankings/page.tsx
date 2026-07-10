import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { COMPETITION_ID, PHASE_LABELS } from '@/lib/constants'
import { computeTournamentRecords, fifaPositions, type RankingMatch } from '@/lib/mundialRankings'
import { Flag } from '@/components/ui/Flag'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Ranking ELO del Mundial 2026 — las 48 selecciones según el modelo',
  description:
    'Las 48 selecciones del Mundial 2026 ordenadas por ELO del modelo, contrastadas con el ranking FIFA y su récord real del torneo.',
}

// ISR: la clasificación cambia con cada partido de eliminatorias
export const revalidate = 120

/**
 * Ranking ELO del Mundial (playbook Sofascore, QW2): el ordenamiento del
 * modelo vs el oficial de FIFA, con el récord real del torneo. Espejo del
 * patrón ya probado en /nba/rankings. Cero datos fabricados: ELO y ranking
 * FIFA vienen de `teams`; el récord, de `matches`.
 */
export default async function MundialRankingsPage() {
  const supabase = createStaticSupabaseClient()

  const [{ data: teams }, { data: matches }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, short_name, code, elo_rating, fifa_ranking')
      .eq('competition_id', COMPETITION_ID)
      .order('elo_rating', { ascending: false }),
    supabase
      .from('matches')
      .select('home_team_id, away_team_id, home_score, away_score, status, phase')
      .eq('competition_id', COMPETITION_ID),
  ])

  const records = computeTournamentRecords((matches ?? []) as RankingMatch[])
  const fifaPos = fifaPositions((teams ?? []) as any[])

  const rows = (teams ?? []).map((t: any, i: number) => {
    const rec = records.get(t.id)
    const fifa = fifaPos.get(t.id)
    // Δ = posición FIFA dentro del torneo − posición ELO: positivo = el
    // modelo lo ve más fuerte que su ranking FIFA
    const delta = fifa != null ? fifa - (i + 1) : null
    return { ...t, pos: i + 1, rec, fifa, delta }
  })

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <div>
        <Link href="/mundial" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Mundial 2026
        </Link>
        <span className="block text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Mundial 2026 · Ranking del modelo
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Ranking ELO</h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Las 48 selecciones según la fuerza que les asigna el motor (ELO),
          contrastadas con el ranking FIFA y su campaña real en el torneo.
          Δ positivo: el modelo las ve más fuertes que su puesto FIFA.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="sticky left-0 z-10 bg-zinc-900 w-10 text-left">#</th>
                <th className="sticky left-10 z-10 bg-zinc-900 text-left">Selección</th>
                <th className="text-right">ELO</th>
                <th className="text-right">FIFA</th>
                <th className="text-right">Δ</th>
                <th className="text-center">PJ</th>
                <th className="text-center hidden sm:table-cell">G-E-P</th>
                <th className="text-center hidden sm:table-cell">GF:GC</th>
                <th className="text-right">Fase</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td className="sticky left-0 z-10 !bg-zinc-900 w-10 text-zinc-500 mono">{r.pos}</td>
                  <td className="sticky left-10 z-10 !bg-zinc-900">
                    <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                      <Flag code={r.code} />
                      <span className="truncate">{r.name}</span>
                    </span>
                  </td>
                  <td className="text-right mono text-sm font-bold text-emerald-400">{r.elo_rating}</td>
                  <td className="text-right mono text-xs text-zinc-400">{r.fifa ? `#${r.fifa_ranking}` : '—'}</td>
                  <td className={cn(
                    'text-right mono text-xs font-semibold',
                    r.delta == null ? 'text-zinc-600' : r.delta > 0 ? 'text-emerald-400' : r.delta < 0 ? 'text-red-400' : 'text-zinc-500',
                  )}>
                    {r.delta == null ? '—' : r.delta > 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className="text-center mono text-xs text-zinc-400">{r.rec?.played ?? 0}</td>
                  <td className="text-center mono text-xs text-zinc-400 hidden sm:table-cell">
                    {r.rec ? `${r.rec.won}-${r.rec.drawn}-${r.rec.lost}` : '0-0-0'}
                  </td>
                  <td className="text-center mono text-xs text-zinc-500 hidden sm:table-cell">
                    {r.rec ? `${r.rec.goals_for}:${r.rec.goals_against}` : '0:0'}
                  </td>
                  <td className="text-right text-[11px] text-zinc-400">
                    {PHASE_LABELS[r.rec?.maxPhase ?? 'group'] ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">
        ELO: fuerza según el motor, actualizada partido a partido. Δ compara
        el orden ELO contra el orden FIFA dentro de las 48 del torneo. Fase:
        la más avanzada con partido jugado o programado — entre rondas, los
        cruces de la siguiente fase aparecen cuando se definen.
      </p>
    </div>
  )
}
