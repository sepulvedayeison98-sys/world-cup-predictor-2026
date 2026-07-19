import type { Metadata } from 'next'
import { Crosshair } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { TopScorersPrediction } from '@/components/scorers/TopScorersPrediction'
import { COMPETITION_ID } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Goleadores del Mundial | Veredicto',
}


// ISR: cacheado y revalidado cada 300s (sin cookies → renderizado estático)
export const revalidate = 300

export default async function ScorersPage() {
  const supabase = createStaticSupabaseClient()

  // Tabla final de goleadores del torneo (cifras reales de la fuente).
  const { data: statsRaw } = await supabase
    .from('player_statistics')
    .select(`
      player_id, goals, assists, matches_played, shots, shots_on_target,
      avg_rating, form_score, physical_condition, updated_at,
      player:players(id, name, short_name, position, photo_url, team_id,
        team:teams(id, name, short_name, code, confederation))
    `)
    .eq('competition_id', COMPETITION_ID)
    .gt('matches_played', 0)
    .order('goals', { ascending: false })
    .limit(50)

  const enriched = (statsRaw ?? []).map((s: any) => {
    const played = s.matches_played || 1
    return { ...s, goalsPerGame: Math.round((s.goals / played) * 100) / 100 }
  }).sort((a: any, b: any) => b.goals - a.goals || b.goalsPerGame - a.goalsPerGame)

  // Fecha del dato más reciente (honestidad: se declara "hasta cuándo")
  const lastUpdated = (statsRaw ?? [])
    .map((s: any) => s.updated_at)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
          <Crosshair className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Goleadores del Mundial</h1>
          <p className="text-sm text-zinc-500">
            Tabla final de anotadores del torneo — cifras reales, sin proyecciones.
            {lastUpdated && (
              <> Datos a la última actualización de la fuente ({new Date(lastUpdated).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}).</>
            )}
          </p>
        </div>
      </div>

      <TopScorersPrediction players={enriched} />
    </div>
  )
}
