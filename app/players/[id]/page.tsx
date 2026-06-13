import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PlayerProfileHeader } from '@/components/players/PlayerProfileHeader'
import { PlayerStatsPanel } from '@/components/players/PlayerStatsPanel'
import { PlayerRadarChart } from '@/components/charts/PlayerRadarChart'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('players').select('name').eq('id', id).single()
  return { title: data ? `${data.name} | WC Predictor` : 'Jugador | WC Predictor' }
}

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

export default async function PlayerDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

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
