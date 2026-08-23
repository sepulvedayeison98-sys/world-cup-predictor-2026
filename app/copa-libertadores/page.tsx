import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { GroupCard } from '@/components/groups/GroupCard'
import { ClickableMatchRow, OpponentLink } from '@/components/teams/ClickableMatchRow'
import { PHASE_LABELS, LIBERTADORES_COMPETITION_ID } from '@/lib/constants'
import { formatColDate } from '@/lib/datetime'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Copa Libertadores',
}

// ISR: cacheado y revalidado cada 60s (sin cookies → renderizado estático)
export const revalidate = 60

export default async function CopaLibertadoresPage() {
  const supabase = createStaticSupabaseClient()

  const [{ data: groups }, { data: knockoutRaw }] = await Promise.all([
    supabase
      .from('groups')
      .select(`
        *,
        group_standings(
          *,
          team:teams(id, name, short_name, code, elo_rating, logo_url)
        )
      `)
      .eq('competition_id', LIBERTADORES_COMPETITION_ID)
      .order('letter'),
    supabase
      .from('matches')
      .select(`
        id, phase, status, kickoff_time, home_score, away_score,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, code, logo_url),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, code, logo_url)
      `)
      .eq('competition_id', LIBERTADORES_COMPETITION_ID)
      .neq('phase', 'group')
      .order('kickoff_time'),
  ])

  const knockout = (knockoutRaw ?? []) as any[]
  const byPhase = new Map<string, any[]>()
  for (const m of knockout) {
    if (!byPhase.has(m.phase)) byPhase.set(m.phase, [])
    byPhase.get(m.phase)!.push(m)
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Copa Libertadores 2026
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Copa Libertadores</h1>
        <p className="text-sm text-zinc-400">
          Fase de grupos finalizada, octavos de final en curso — CONMEBOL Libertadores 2026.
        </p>
      </div>

      {/* Eliminatorias: octavos en adelante, ida/vuelta salvo la final */}
      {byPhase.size > 0 && (
        <div className="flex flex-col gap-4">
          {/* Por qué aquí no hay predicciones, dicho antes de que se note.
              Un hueco sin explicar se lee como un fallo; el motivo real es
              que el motor no da la talla en esta fase y preferimos callar a
              publicar un número que sabemos malo. */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
            <p className="text-xs text-amber-400">
              El motor no publica predicciones de eliminatoria.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              Medido sobre los 15 partidos de eliminación directa ya jugados en esta
              edición, acierta el <span className="mono font-semibold">13%</span> — por
              debajo del <span className="mono">33%</span> del azar. El modelo asume una
              liga continua y aplica ventaja de local a todos los partidos, y en una
              ida y vuelta esa ventaja no existe: de esos 15 partidos solo 2 los ganó
              el equipo de casa. La fase de grupos sí tiene predicciones publicadas.
            </p>
          </div>
          {Array.from(byPhase.entries()).map(([phase, ties]) => (
            <div key={phase} className="card overflow-hidden">
              <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
                <h3 className="text-sm font-bold text-white">{PHASE_LABELS[phase] ?? phase}</h3>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {ties.map((m) => (
                  <ClickableMatchRow key={m.id} matchId={m.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <OpponentLink teamId={m.home_team?.id} className="text-sm font-medium text-zinc-200 truncate hover:text-emerald-400">
                        {m.home_team?.short_name ?? m.home_team?.name}
                      </OpponentLink>
                      <span className="text-xs text-zinc-600">vs</span>
                      <OpponentLink teamId={m.away_team?.id} className="text-sm font-medium text-zinc-200 truncate hover:text-emerald-400">
                        {m.away_team?.short_name ?? m.away_team?.name}
                      </OpponentLink>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {m.status === 'finished' ? (
                        <span className="mono text-sm font-bold text-white">{m.home_score}–{m.away_score}</span>
                      ) : (
                        <span className="text-xs text-zinc-500">{formatColDate(new Date(m.kickoff_time))}</span>
                      )}
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        m.status === 'finished' ? 'bg-zinc-800 text-zinc-500' :
                        m.status === 'live' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400',
                      )}>
                        {m.status === 'finished' ? 'Jugado' : m.status === 'live' ? 'Vivo' : 'Prog.'}
                      </span>
                    </div>
                  </ClickableMatchRow>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fase de grupos: tabla final por grupo */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Fase de grupos</h2>
          <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Finalizada
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(groups ?? []).map((group: any) => (
            <GroupCard key={group.id} group={group} bestThirdAdvances={false} showQualification={false} />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-zinc-600">
        Los partidos de ida/vuelta se muestran cada uno por separado — el agregado real
        aparece en el detalle de cada partido de vuelta.{' '}
        <Link href="/matches" className="text-emerald-400 hover:text-emerald-300">Ver todos los partidos</Link>
      </p>
    </div>
  )
}
