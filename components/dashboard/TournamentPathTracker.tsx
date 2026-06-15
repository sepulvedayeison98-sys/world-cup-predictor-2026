'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface TeamProbability {
  team_id: string
  team_name: string
  team_code: string
  group_stage_advance_prob: number
  round_of_16_prob: number
  quarter_final_prob: number
  semi_final_prob: number
  final_prob: number
  winner_prob: number
}

export function TournamentPathTracker() {
  const [data, setData] = useState<TeamProbability[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: latestRun } = await supabase
        .from('tournament_simulations')
        .select('simulation_run_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestRun) {
        const { data: results } = await supabase
          .from('tournament_simulations')
          .select(`
            team_id,
            group_stage_advance_prob,
            round_of_16_prob,
            quarter_final_prob,
            semi_final_prob,
            final_prob,
            winner_prob,
            teams(name, code)
          `)
          .eq('simulation_run_id', latestRun.simulation_run_id)
          .order('group_stage_advance_prob', { ascending: false })
          .limit(8)

        if (results) {
          setData(results.map((r: any) => ({
            ...r,
            team_name: r.teams.name,
            team_code: r.teams.code
          })))
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  if (loading || data.length === 0) return null

  const stages = [
    { key: 'group_stage_advance_prob', label: 'Grupos' },
    { key: 'round_of_16_prob', label: 'Octavos' },
    { key: 'quarter_final_prob', label: 'Cuartos' },
    { key: 'semi_final_prob', label: 'Semis' },
    { key: 'final_prob', label: 'Final' },
    { key: 'winner_prob', label: 'Campeón' }
  ]

  return (
    <Card className="col-span-full border-zinc-800 bg-zinc-950/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Probabilidades de Avance por Etapa
        </CardTitle>
        <p className="text-xs text-zinc-500">Top 8 favoritos según la última simulación de Monte Carlo</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px] space-y-4">
            {data.map((team) => (
              <div key={team.team_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-zinc-300">{team.team_name}</span>
                  <span className="text-emerald-400 font-mono">{(team.winner_prob * 100).toFixed(1)}% Campeón</span>
                </div>
                <div className="flex h-6 w-full gap-1">
                  {stages.map((stage) => {
                    const prob = (team as any)[stage.key]
                    return (
                      <div
                        key={stage.key}
                        className="relative flex-1 rounded-sm overflow-hidden bg-zinc-900 border border-zinc-800/50 group"
                      >
                        <div
                          className={cn(
                            "h-full transition-all duration-1000 ease-out",
                            prob > 0.7 ? "bg-emerald-500/60" : 
                            prob > 0.4 ? "bg-emerald-500/40" : 
                            prob > 0.1 ? "bg-emerald-500/20" : "bg-zinc-800/30"
                          )}
                          style={{ width: `${prob * 100}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          {stage.label}: {(prob * 100).toFixed(0)}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-between px-1 text-[10px] font-bold text-zinc-600 uppercase tracking-widest pt-2">
              {stages.map(s => <span key={s.key} className="flex-1 text-center">{s.label}</span>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
