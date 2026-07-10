import type { Metadata } from 'next'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { GroupCard } from '@/components/groups/GroupCard'
import { COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Grupos | World Cup Predictor',
}


// ISR: cacheado y revalidado cada 120s (sin cookies → renderizado estático)
export const revalidate = 120

export default async function GroupsPage() {
  const supabase = createStaticSupabaseClient()
  const { data: groups } = await supabase
    .from('groups')
    .select(`
      *,
      group_standings(
        *,
        team:teams(
          id, name, short_name, code, fifa_ranking, elo_rating, logo_url
        )
      )
    `)
    .eq('competition_id', COMPETITION_ID)
    .order('letter')

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Mundial 2026 · Fase de Grupos
          </span>
          <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Fase finalizada
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">Grupos</h1>
        <p className="text-sm text-zinc-400">
          Clasificación final de la fase de grupos — el torneo continúa en las{' '}
          <a href="/bracket" className="text-emerald-400 hover:text-emerald-300">eliminatorias</a>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(groups ?? []).map((group: any) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  )
}
