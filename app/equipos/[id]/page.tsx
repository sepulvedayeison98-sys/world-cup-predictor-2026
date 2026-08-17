import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin, Users, Calendar, Trophy, Target, Flame, ShieldHalf, Scale, Gauge } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { computeFootballTeamStats, type FbMatch } from '@/lib/footballTeamStats'
import { competitionHref, sportOfCompetition } from '@/lib/sports'
import { COMPETITIONS_NAV } from '@/lib/sports'
import { Flag } from '@/components/ui/Flag'
import { TeamStatCard } from '@/components/teams/TeamStatCard'
import { ClickableMatchRow, OpponentLink } from '@/components/teams/ClickableMatchRow'
import { formatColDate } from '@/lib/datetime'
import { predictionWarmup, coldStartNote } from '@/lib/predictionQuality'
import { cn } from '@/lib/utils'

export const revalidate = 300
// generateStaticParams (vacío) habilita el caché ISR on-demand en Next 15.
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createStaticSupabaseClient()
  const { data } = await supabase.from('teams').select('name').eq('id', id).maybeSingle()
  const name = (data as any)?.name
  return name
    ? { title: `${name} — perfil y forma`, description: `Récord, forma reciente, splits local/visitante y últimos partidos de ${name}, con el ELO del modelo.` }
    : { title: 'Equipo' }
}

/**
 * Perfil universal de equipo de fútbol (playbook Sofascore + paridad con NBA).
 * Sirve a selecciones del Mundial y clubes de liga: un equipo juega en una
 * sola competición, así que todo se filtra por ella (regla de oro). Solo
 * métricas reales de partidos jugados.
 */
export default async function FootballTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createStaticSupabaseClient()

  const { data: team } = await supabase
    .from('teams')
    .select(`
      id, name, short_name, code, logo_url, elo_rating, fifa_ranking, competition_id,
      venue_name, venue_city, venue_capacity, venue_image_url, founded_year, coach
    `)
    .eq('id', id)
    .maybeSingle()
  if (!team) notFound()
  const t = team as any

  // Solo equipos de deportes de fútbol (NBA tiene su propia página)
  if (sportOfCompetition(t.competition_id) !== 'futbol') notFound()

  const { data: matchesRaw } = await supabase
    .from('matches')
    .select(`
      id, home_team_id, away_team_id, home_score, away_score, status, kickoff_time, phase, round,
      home_team:teams!matches_home_team_id_fkey(id, short_name, code, logo_url),
      away_team:teams!matches_away_team_id_fkey(id, short_name, code, logo_url),
      predictions(home_win_probability, draw_probability, away_win_probability,
        predicted_home_score, predicted_away_score, confidence_score)
    `)
    .eq('competition_id', t.competition_id)
    .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
    .order('kickoff_time', { ascending: false })
    .limit(500)

  const matches = (matchesRaw ?? []) as any[]
  const stats = computeFootballTeamStats(matches as FbMatch[], id)

  // Plantilla: solo donde ya se ingestó (Copa Libertadores por ahora — ver
  // services/sync/libertadores-squad.ts). Vacía en cualquier otro equipo,
  // la sección entera desaparece en vez de mostrar un bloque en blanco.
  const { data: squadRaw } = await supabase
    .from('players')
    .select('id, name, number, position_raw, nationality, photo_url')
    .eq('team_id', id)
    .order('number', { ascending: true, nullsFirst: false })
  const squad = (squadRaw ?? []) as any[]
  const POSITION_LABEL: Record<string, string> = {
    Goalkeeper: 'Porteros', Defender: 'Defensas', Midfielder: 'Mediocampistas', Attacker: 'Delanteros',
  }
  const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker']
  const squadByPosition = POSITION_ORDER
    .map((pos) => ({ pos, label: POSITION_LABEL[pos], players: squad.filter((p) => p.position_raw === pos) }))
    .filter((g) => g.players.length > 0)
  const squadUnknown = squad.filter((p) => !POSITION_ORDER.includes(p.position_raw))

  const compName = COMPETITIONS_NAV.find((c) => c.id === t.competition_id)?.name ?? 'Fútbol'
  const backHref = competitionHref(t.competition_id)

  const recent = matches
    .filter((m) => m.status === 'finished' && m.home_score != null)
    .slice(0, 10)

  // El calendario por delante. `matches` viene del más reciente al más
  // antiguo, así que los próximos hay que darles la vuelta: se leen del
  // más cercano al más lejano.
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' || m.status === 'live' || m.status === 'postponed')
    .reverse()
    .slice(0, 10)

  // El calendario muestra probabilidades: si este equipo no ha calentado,
  // esas probabilidades son el prior de la liga y hay que declararlo.
  const avisoArranque = coldStartNote(predictionWarmup(stats.played, stats.played))

  const streakLabel = stats.streak === 0 ? '—'
    : stats.streak > 0 ? `${stats.streak} ${stats.streak === 1 ? 'victoria' : 'victorias'}`
    : `${-stats.streak} ${-stats.streak === 1 ? 'derrota' : 'derrotas'}`

  const FormPill = ({ r }: { r: 'W' | 'D' | 'L' }) => (
    <span className={cn(
      'inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
      r === 'W' && 'bg-emerald-500/20 text-emerald-400',
      r === 'D' && 'bg-amber-500/20 text-amber-400',
      r === 'L' && 'bg-red-500/20 text-red-400',
    )}>{r}</span>
  )

  // Barras de contexto: SIEMPRE un ratio real ya calculado (victorias sobre
  // jugados, puntos sobre el máximo de 3 por partido). Nunca una tendencia
  // simulada — donde no hay una base sólida para el ratio, la tarjeta se
  // queda sin barra (goles, diferencia, ELO).
  const winRatio = stats.played > 0 ? stats.won / stats.played : 0
  const pointsRatio = stats.ppg / 3

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-500 hover:text-emerald-400">
          <ArrowLeft className="h-3.5 w-3.5" /> {compName}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          {t.logo_url
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.logo_url} alt="" className="h-9 w-9 object-contain" />
            : <Flag code={t.code} className="h-7 w-10 rounded" />}
          <h1 className="text-2xl font-bold text-white">{t.name}</h1>
          <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs font-bold text-zinc-400">{t.code}</span>
        </div>
        {t.fifa_ranking > 0 && (
          <p className="mt-1 text-xs text-zinc-500">Ranking FIFA #{t.fifa_ranking}</p>
        )}

        {/* Ficha del club: solo lo que la fuente realmente trae. Un club
            recién ascendido puede no tener estadio o fundación en la
            fuente — no se rellena con nada, la fila desaparece entera. */}
        {(t.venue_name || t.founded_year || t.coach) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {t.venue_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {t.venue_name}{t.venue_city ? ` · ${t.venue_city}` : ''}
              </span>
            )}
            {t.venue_capacity && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {t.venue_capacity.toLocaleString('es-ES')} aforo
              </span>
            )}
            {t.founded_year && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Fundado en {t.founded_year}
              </span>
            )}
            {t.coach && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                DT: {t.coach}
              </span>
            )}
          </div>
        )}
      </div>

      {stats.played === 0 ? (
        <div className="card px-6 py-5 text-center">
          <p className="text-sm text-zinc-400">
            Todavía no hay partidos jugados en esta temporada, así que no hay
            récord ni forma que mostrar.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            El calendario por delante sí está disponible, aquí abajo.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <TeamStatCard
              icon={Trophy} label="Récord (G-E-P)" accent="emerald"
              value={`${stats.won}-${stats.drawn}-${stats.lost}`}
              contextRatio={winRatio} contextLabel={`${Math.round(winRatio * 100)}% de victorias`}
            />
            <TeamStatCard
              icon={Target} label="Puntos por partido" accent="emerald"
              value={stats.ppg.toFixed(2)}
              contextRatio={pointsRatio} contextLabel={`sobre 3,00 posibles`}
            />
            <TeamStatCard icon={Flame} label="Goles a favor / p" accent="amber" value={stats.gfpg.toFixed(1)} />
            <TeamStatCard icon={ShieldHalf} label="Goles en contra / p" accent="sky" value={stats.gapg.toFixed(1)} />
            <TeamStatCard
              icon={Scale} label="Diferencia" value={`${stats.goal_diff > 0 ? '+' : ''}${stats.goal_diff}`}
              accent={stats.goal_diff > 0 ? 'emerald' : stats.goal_diff < 0 ? 'red' : 'zinc'}
            />
            <TeamStatCard icon={Gauge} label="ELO del modelo" value={String(t.elo_rating)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Splits */}
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-white">Local / visitante</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">En casa</span>
                  <span className="mono text-zinc-200">{stats.homeW}-{stats.homeD}-{stats.homeL}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Fuera</span>
                  <span className="mono text-zinc-200">{stats.awayW}-{stats.awayD}-{stats.awayL}</span>
                </div>
                <p className="border-t border-zinc-800 pt-2 text-[11px] text-zinc-600">
                  {stats.played} partidos jugados · {stats.points} puntos · {(stats.won / stats.played * 100).toFixed(0)}% de victorias
                </p>
              </div>
            </div>

            {/* Forma */}
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-white">Forma</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Últimos 5</span>
                  <span className="flex gap-1">
                    {stats.last5.length ? stats.last5.map((r, i) => <FormPill key={i} r={r} />) : <span className="text-zinc-600">—</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Últimos 10</span>
                  <span className="mono text-zinc-200">{stats.last10W}-{stats.last10D}-{stats.last10L}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Racha actual</span>
                  <span className={cn('font-semibold', stats.streak > 0 ? 'text-emerald-400' : stats.streak < 0 ? 'text-red-400' : 'text-zinc-500')}>{streakLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Últimos partidos */}
          <div className="card overflow-hidden">
            <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
              <h2 className="text-sm font-bold text-white">Últimos partidos</h2>
            </div>
            <ul className="divide-y divide-zinc-800/60">
              {recent.map((m) => {
                const isHome = m.home_team_id === id
                const gf = isHome ? m.home_score : m.away_score
                const ga = isHome ? m.away_score : m.home_score
                const opp = isHome ? m.away_team : m.home_team
                const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D'
                return (
                  <li key={m.id}>
                    <ClickableMatchRow
                      matchId={m.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-800/40 active:bg-zinc-800/60 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-xs">
                        <FormPill r={res as 'W' | 'D' | 'L'} />
                        <span className="text-zinc-500">{isHome ? 'vs' : '@'}</span>
                        <OpponentLink teamId={opp?.id} className="flex items-center gap-2 hover:underline">
                          <Flag code={opp?.code} />
                          <span className="text-zinc-300">{opp?.short_name ?? opp?.code}</span>
                        </OpponentLink>
                      </span>
                      <span className="mono text-xs font-bold text-zinc-200">{gf}–{ga}</span>
                    </ClickableMatchRow>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}

      {/* Próximos partidos — fuera del bloque anterior a propósito: al
          empezar una temporada no hay nada jugado, y el calendario por
          delante es justo lo único que el equipo tiene que enseñar. */}
      {upcoming.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
            <h2 className="text-sm font-bold text-white">Próximos partidos</h2>
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {upcoming.map((m) => {
              const isHome = m.home_team_id === id
              const opp = isHome ? m.away_team : m.home_team
              const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
              // Probabilidades desde la óptica de ESTE equipo, no del local.
              const win  = p ? (isHome ? p.home_win_probability : p.away_win_probability) : null
              const loss = p ? (isHome ? p.away_win_probability : p.home_win_probability) : null
              const pct = (v: number) => `${Math.round(v * 100)}%`
              return (
                <li key={m.id}>
                  <ClickableMatchRow
                    matchId={m.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-800/40 active:bg-zinc-800/60 transition-colors"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-xs">
                      <span className="mono w-20 shrink-0 text-[10px] text-zinc-500">
                        {formatColDate(m.kickoff_time)}
                      </span>
                      <span className="text-zinc-500">{isHome ? 'vs' : '@'}</span>
                      <OpponentLink teamId={opp?.id} className="flex min-w-0 items-center gap-2 hover:underline">
                        {opp?.logo_url
                          ? /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={opp.logo_url} alt="" aria-hidden="true" loading="lazy" className="h-4 w-4 shrink-0 object-contain" />
                          : <Flag code={opp?.code} />}
                        <span className="truncate text-zinc-300">{opp?.short_name ?? opp?.code}</span>
                      </OpponentLink>
                      {m.status === 'postponed' && (
                        <span className="shrink-0 rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
                          Aplazado
                        </span>
                      )}
                    </span>
                    {win != null && loss != null ? (
                      <span className="mono shrink-0 text-[11px] text-zinc-400">
                        <span className="text-emerald-400">{pct(win)}</span>
                        <span className="mx-1 text-zinc-700">·</span>
                        <span className="text-amber-400">{pct(p.draw_probability)}</span>
                        <span className="mx-1 text-zinc-700">·</span>
                        <span className="text-red-400">{pct(loss)}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-zinc-600">Sin predicción</span>
                    )}
                  </ClickableMatchRow>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-zinc-800 px-4 py-2">
            <p className="text-[10px] text-zinc-600">
              Probabilidades del modelo desde la óptica de {t.short_name ?? t.name}:
              victoria · empate · derrota.
            </p>
            {/* Data First: si el modelo aún no tiene base, se dice — no se
                presenta el prior de la liga como si fuera una lectura. */}
            {avisoArranque && (
              <p className="mt-1 text-[10px] leading-snug text-amber-400/80">{avisoArranque}</p>
            )}
          </div>
        </div>
      )}

      {/* Plantilla: se auto-oculta si el equipo no tiene ingesta de jugadores */}
      {squad.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
            <h2 className="text-sm font-bold text-white">Plantilla</h2>
            <p className="text-[10px] text-zinc-500">{squad.length} jugadores registrados</p>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {squadByPosition.map((group) => (
              <div key={group.pos} className="px-4 py-3">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{group.label}</h3>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {group.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="mono w-6 shrink-0 text-right text-zinc-600">{p.number ?? '—'}</span>
                      {p.photo_url
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.photo_url} alt="" loading="lazy" className="h-6 w-6 shrink-0 rounded-full object-cover bg-zinc-800" />
                        : <span className="h-6 w-6 shrink-0 rounded-full bg-zinc-800" />}
                      <span className="truncate text-zinc-300">{p.name}</span>
                      {p.nationality && <span className="shrink-0 text-[10px] text-zinc-600">{p.nationality}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {squadUnknown.length > 0 && (
              <div className="px-4 py-3">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Posición no disponible</h3>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {squadUnknown.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="mono w-6 shrink-0 text-right text-zinc-600">{p.number ?? '—'}</span>
                      <span className="truncate text-zinc-300">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
