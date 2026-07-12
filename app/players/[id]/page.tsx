import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { PlayerProfileHeader } from '@/components/players/PlayerProfileHeader'
import { PlayerStatsPanel } from '@/components/players/PlayerStatsPanel'
import { PlayerRadarChartLazy as PlayerRadarChart } from '@/components/charts/PlayerRadarChartLazy'

interface Props { params: Promise<{ id: string }> }

// ISR: cacheado y revalidado cada 300s (sin cookies → renderizado estático).
// generateStaticParams (vacío) habilita el caché ISR on-demand en Next 15:
// sin él, un segmento [id] se sirve dinámico (no-store) en cada visita.
export const revalidate = 300
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createStaticSupabaseClient()
  const { data } = await supabase.from('players').select('name').eq('id', id).single()
  return { title: data ? `${data.name} | WC Predictor` : 'Jugador | WC Predictor' }
}


export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createStaticSupabaseClient()

  const { data: player } = await supabase
    .from('players')
    .select(`
      *,
      team:teams(*, team_statistics(*)),
      player_statistics(*)
    `)
    .eq('id', id)
    .single()

  if (!player) notFound()

  const stats = Array.isArray((player as any).player_statistics)
    ? (player as any).player_statistics[0] ?? null
    : (player as any).player_statistics

  // Injuries for this player
  const { data: injuries } = await supabase
    .from('injuries')
    .select('*')
    .eq('player_id', id)
    .order('reported_at', { ascending: false })
    .limit(5)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <PlayerProfileHeader player={player as any} stats={stats} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <PlayerStatsPanel stats={stats} injuries={injuries ?? []} />
        </div>
        <div className="space-y-6">
          <PlayerRadarChart player={player as any} stats={stats} />
        </div>
      </div>
    </div>
  )
}
