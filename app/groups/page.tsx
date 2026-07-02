import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { GroupCard } from '@/components/groups/GroupCard'
import { COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Grupos | World Cup Predictor',
}


export default async function GroupsPage() {
  const supabase = await createServerSupabaseClient()
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
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Mundial 2026 · Fase de Grupos
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Grupos</h1>
        <p className="text-sm text-zinc-400">
          Tablas de posición, probabilidades de clasificación y próximos partidos
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
