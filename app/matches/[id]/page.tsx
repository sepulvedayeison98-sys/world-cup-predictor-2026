import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { MatchHeader } from '@/components/matches/MatchHeader'
import { LiveMatchRefresh } from '@/components/matches/LiveMatchRefresh'
import { MatchAnalysisTabs } from '@/components/matches/MatchAnalysisTabs'
import { fetchTeamForm } from '@/lib/teamForm'
import type { MatchFormEntry } from '@/lib/smartBetsEngine'
import { computeModelPrediction, computeConfidenceLevel } from '@/lib/predictionEngine'
import { MODEL_VERSION } from '@/lib/constants'
import type { GroupContext } from '@/app/api/analysis/match/[id]/route'
import { COMPETITIONS_NAV } from '@/lib/sports'
import { VerdictPanel } from '@/components/matches/VerdictPanel'
import { MatchTimeline } from '@/components/matches/MatchTimeline'
import { QuarterBreakdown } from '@/components/nba/QuarterBreakdown'
import { HeadToHead } from '@/components/matches/HeadToHead'
import { computeH2H, type H2HMatch } from '@/lib/h2h'
import { MarketMovementPanel, type MovementItem } from '@/components/matches/MarketMovementPanel'
import { ProbBar1X2 } from '@/components/predictions/ProbBar1X2'
import { marketImpliedFromOdds } from '@/lib/marketImplied'
import { cn } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

// ISR: cacheado y revalidado cada 60s (sin cookies → renderizado estático).
// generateStaticParams (aunque vacío) es lo que habilita el modelo de caché
// ISR on-demand en Next 15: sin él, un segmento [id] se sirve dinámico
// (no-store) en cada visita. No se prerenderiza nada en build; cada id se
// genera y cachea en la primera visita. La frescura en vivo la maneja
// LiveMatchRefresh en el cliente.
export const revalidate = 60
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createStaticSupabaseClient()
  const { data: match } = await supabase
    .from('matches')
    .select(`
      status, home_score, away_score,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name),
      predictions(home_win_probability, draw_probability, away_win_probability)
    `)
    .eq('id', id)
    .single()

  if (!match) return { title: 'Partido' }
  const m = match as any
  const home = m.home_team?.name ?? 'Local'
  const away = m.away_team?.name ?? 'Visitante'
  const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions

  // Títulos de intención de búsqueda (playbook Sofascore, QW1):
  // "pronóstico X vs Y" es la keyword natural del producto.
  if (m.status === 'finished' && m.home_score != null) {
    return {
      title: `${home} ${m.home_score}-${m.away_score} ${away} — resultado y veredicto del modelo`,
      description: `Resultado ${home} vs ${away}: ${m.home_score}-${m.away_score}. Qué predijo el modelo y cómo le fue, con análisis verificable.`,
    }
  }
  const desc = p
    ? `El modelo da ${Math.round(p.home_win_probability * 100)}% a ${home}, ${Math.round(p.draw_probability * 100)}% al empate y ${Math.round(p.away_win_probability * 100)}% a ${away}. Probabilidades verificables, marcador estimado y análisis.`
    : `Análisis y predicción de ${home} vs ${away} con probabilidades verificables del modelo.`
  return {
    title: `Pronóstico ${home} vs ${away} — probabilidades del modelo`,
    description: desc,
  }
}

export default async function MatchDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = createStaticSupabaseClient()

  // Fetch match data y odds en paralelo
  const [{ data: match }, { data: oddsRaw }] = await Promise.all([
    supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!matches_home_team_id_fkey(*, team_statistics(*)),
        away_team:teams!matches_away_team_id_fkey(*, team_statistics(*)),
        predictions(*, exact_score_predictions(*)),
        match_statistics(*)
      `)
      .eq('id', id)
      .single(),

    supabase
      .from('odds')
      .select('bookmaker, market, odds_value, implied_probability, recorded_at')
      .eq('match_id', id)
      .order('recorded_at', { ascending: false }),
  ])

  if (!match) notFound()

  const m = match as any

  const KNOCKOUT_PHASES = new Set(['round_of_32','round_of_16','quarter_final','semi_final','final','third_place'])
  const isKnockout = KNOCKOUT_PHASES.has(m.phase)

  // Injuries, forma reciente y (para eliminatorias) contexto de grupo — en paralelo
  const homeGroupId: string | null = m.home_team?.group_id ?? null
  const awayGroupId: string | null = m.away_team?.group_id ?? null

  async function fetchGroupContext(groupId: string | null, teamId: string): Promise<GroupContext | null> {
    if (!groupId || !isKnockout) return null
    const { data, error } = await supabase
      .from('group_standings')
      .select('won, drawn, lost, goals_for, goals_against, points, team_id, groups(letter, name), teams(id, name, short_name)')
      .eq('group_id', groupId)
      .order('points', { ascending: false })
    if (error) console.error('[match-detail] contexto de grupo:', error.message)
    if (!data || data.length === 0) return null
    const rows = data as any[]
    // Sort by points desc, goal_difference desc for position
    const sorted = [...rows].sort((a, b) =>
      (b.points - a.points) || ((b.goals_for - b.goals_against) - (a.goals_for - a.goals_against))
    )
    const pos = sorted.findIndex((r: any) => r.team_id === teamId)
    const entry = rows.find((r: any) => r.team_id === teamId)
    if (!entry) return null
    const grp = entry.groups as any
    const otherTeams = rows
      .filter((r: any) => r.team_id !== teamId)
      .map((r: any) => (r.teams as any)?.short_name ?? (r.teams as any)?.name ?? '?')
    return {
      groupLetter: grp?.letter ?? '',
      groupName:   grp?.name  ?? '',
      position:    pos >= 0 ? pos + 1 : 0,
      won:         entry.won ?? 0,
      drawn:       entry.drawn ?? 0,
      lost:        entry.lost ?? 0,
      goalsFor:    entry.goals_for ?? 0,
      goalsAgainst:entry.goals_against ?? 0,
      points:      entry.points ?? 0,
      otherTeams,
    }
  }

  const [{ data: injuriesData }, homeRecentMatches, awayRecentMatches, homeGroupContext, awayGroupContext] = await Promise.all([
    supabase
      .from('injuries')
      .select('*, player:players(name, short_name, position, photo_url)')
      .in('team_id', [m.home_team_id, m.away_team_id])
      .eq('is_active', true),
    fetchTeamForm(supabase, m.home_team_id, id, m.competition_id),
    fetchTeamForm(supabase, m.away_team_id, id, m.competition_id),
    fetchGroupContext(homeGroupId, m.home_team_id),
    fetchGroupContext(awayGroupId, m.away_team_id),
  ])

  // PostgREST returns predictions as object (UNIQUE match_id); handle array too
  const savedPrediction = Array.isArray(m.predictions)
    ? (m.predictions[0] ?? null)
    : (m.predictions ?? null)

  const homeStats  = m.home_team?.team_statistics?.[0] ?? null
  const awayStats  = m.away_team?.team_statistics?.[0] ?? null

  // Medias del torneo derivadas de la forma reciente: es la mejor fuente
  // disponible cuando team_statistics está vacía (los partidos del Mundial
  // ya tienen xG/estadísticas por partido en match_statistics).
  function tournamentAverages(form: MatchFormEntry[]) {
    if (form.length === 0) return null
    const n = form.length
    const avg = (sel: (e: MatchFormEntry) => number | null | undefined): number | null => {
      const vals = form.map(sel).filter((v): v is number => v != null)
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    }
    const goals    = form.reduce((s, e) => s + e.goals_scored, 0) / n
    const conceded = form.reduce((s, e) => s + e.goals_conceded, 0) / n
    return {
      xg:    avg(e => e.xg)  ?? goals,
      xga:   avg(e => e.xga) ?? conceded,
      goals,
      sot:   avg(e => e.shots_on_target) ?? undefined,
      // Cronológico ascendente: formToScore pondera los últimos del array
      form:  [...form].reverse().map(e => e.result),
    }
  }

  // Si no hay predicción guardada (partidos nuevos como octavos R32), calculamos al vuelo
  let prediction = savedPrediction
  if (!savedPrediction && m.status !== 'finished') {
    const homeInjury = (injuriesData ?? [])
      .filter((i: any) => i.team_id === m.home_team_id)
      .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)
    const awayInjury = (injuriesData ?? [])
      .filter((i: any) => i.team_id === m.away_team_id)
      .reduce((s: number, i: any) => s + (i.impact_score ?? 0), 0)

    const hDerived = tournamentAverages(homeRecentMatches)
    const aDerived = tournamentAverages(awayRecentMatches)

    const result = computeModelPrediction({
      homeElo: m.home_team?.elo_rating ?? 1500,
      awayElo: m.away_team?.elo_rating ?? 1500,
      homeForm: homeStats?.form ?? hDerived?.form ?? [],
      awayForm: awayStats?.form ?? aDerived?.form ?? [],
      // Prioridad: stats de temporada → medias reales del torneo → default
      // simétrico (en un Mundial no hay ventaja de "local").
      homeXg:   homeStats?.avg_xg  ?? hDerived?.xg  ?? 1.1,
      awayXg:   awayStats?.avg_xg  ?? aDerived?.xg  ?? 1.1,
      homeXga:  homeStats?.avg_xga ?? hDerived?.xga ?? 1.1,
      awayXga:  awayStats?.avg_xga ?? aDerived?.xga ?? 1.1,
      homeShotsOnTarget: homeStats?.avg_shots_on_target ?? hDerived?.sot,
      awayShotsOnTarget: awayStats?.avg_shots_on_target ?? aDerived?.sot,
      homeGoalsScored: homeStats?.avg_goals_scored ?? hDerived?.goals,
      awayGoalsScored: awayStats?.avg_goals_scored ?? aDerived?.goals,
      homeInjuryImpact: homeInjury,
      awayInjuryImpact: awayInjury,
      isKnockout,
    })

    prediction = {
      id: 'computed',
      match_id: id,
      home_win_probability:  result.home,
      draw_probability:      result.draw,
      away_win_probability:  result.away,
      predicted_home_score:  result.predictedHome,
      predicted_away_score:  result.predictedAway,
      confidence_level:      computeConfidenceLevel(result.confidenceScore),
      confidence_score:      result.confidenceScore,
      model_version:         MODEL_VERSION,
      is_published:          false,
      exact_score_predictions: result.exactScores.map((s, i) => ({
        id: `computed-${i}`,
        home_score: s.home,
        away_score: s.away,
        probability: s.prob,
        rank: i + 1,
      })),
    }
  }
  const matchStats = (m.match_statistics ?? []) as any[]

  // Keep only the most recent odds per bookmaker + market combination
  const oddsMap = new Map<string, any>()
  for (const o of (oddsRaw ?? []) as any[]) {
    const key = `${o.bookmaker}||${o.market}`
    if (!oddsMap.has(key)) oddsMap.set(key, o)
  }
  const odds = Array.from(oddsMap.values())

  // Modelo vs mercado (mejora 9): implícita justa 1X2 de Pinnacle (devig).
  // null si no hay cuotas → el overlay no se dibuja (vacío honesto).
  const marketImplied = marketImpliedFromOdds(odds as any)
  const mvm = marketImplied && prediction ? (() => {
    const mh = Number(prediction.home_win_probability)
    const md = Number(prediction.draw_probability)
    const ma = Number(prediction.away_win_probability)
    const max = Math.max(mh, md, ma)
    const key: 'home' | 'draw' | 'away' = max === mh ? 'home' : max === ma ? 'away' : 'draw'
    const pickLabel = key === 'home'
      ? `${m.home_team?.short_name ?? m.home_team?.name} gana`
      : key === 'away' ? `${m.away_team?.short_name ?? m.away_team?.name} gana` : 'Empate'
    const edge = Math.round((max - marketImplied[key]) * 1000) / 10 // pp de ventaja vs mercado
    return { mh, md, ma, pickLabel, edge }
  })() : null

  // Contexto de competición para el regreso y la etiqueta (universal):
  // primero el registro (Mundial + ligas); si no está (p. ej. amistosos),
  // el nombre viene de la BD y el regreso cae en /matches.
  const registryEntry = COMPETITIONS_NAV.find((c) => c.id === m.competition_id)
  // Deportes sin modelo de goles (NBA) ocultan Smart Bets / gemelo Poisson
  const isFootball = registryEntry ? registryEntry.sport === 'futbol' : true
  let competitionCtx: { name: string; href: string } | null = registryEntry
    ? { name: registryEntry.name, href: registryEntry.href }
    : null
  if (!competitionCtx) {
    const { data: comp } = await supabase
      .from('competitions')
      .select('name')
      .eq('id', m.competition_id)
      .maybeSingle()
    if (comp) competitionCtx = { name: (comp as any).name, href: '/matches' }
  }

  // Head-to-head (playbook Sofascore, mejora 10): enfrentamientos previos
  // entre los dos equipos en la MISMA competición (regla de oro). Excluye
  // el partido actual. Vacío → el componente no se renderiza.
  const { data: h2hRaw } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, kickoff_time, status')
    .eq('competition_id', m.competition_id)
    .eq('status', 'finished')
    .or(
      `and(home_team_id.eq.${m.home_team_id},away_team_id.eq.${m.away_team_id}),` +
      `and(home_team_id.eq.${m.away_team_id},away_team_id.eq.${m.home_team_id})`,
    )
    .neq('id', m.id)
    .order('kickoff_time', { ascending: false })
    .limit(20)
  const h2h = computeH2H((h2hRaw ?? []) as H2HMatch[], m.home_team_id, m.away_team_id)

  // Movimiento del mercado (playbook Sofascore, mejora 7): solo pre-partido,
  // Pinnacle. Vacío mientras el sync no haya acumulado historia → el panel
  // se auto-oculta.
  let movements: MovementItem[] = []
  if (isFootball && (m.status === 'scheduled' || m.status === 'live')) {
    const { data: mv } = await supabase
      .from('market_movements')
      .select('market, odds_before, odds_after, prob_shift_pct, detected_at')
      .eq('match_id', m.id)
      .eq('bookmaker', 'Pinnacle')
      .order('detected_at', { ascending: false })
      .limit(30)
    movements = (mv ?? []) as MovementItem[]
  }

  // JSON-LD SportsEvent (playbook Sofascore, QW1): datos estructurados con
  // SOLO campos reales del partido — los buscadores indexan el evento.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${m.home_team?.name ?? 'Local'} vs ${m.away_team?.name ?? 'Visitante'}`,
    startDate: m.kickoff_time,
    sport: isFootball ? 'Soccer' : 'Basketball',
    eventStatus: m.status === 'postponed'
      ? 'https://schema.org/EventPostponed'
      : 'https://schema.org/EventScheduled',
    ...(m.venue ? {
      location: {
        '@type': 'Place',
        name: m.venue,
        ...(m.city ? { address: m.city } : {}),
      },
    } : {}),
    homeTeam: { '@type': 'SportsTeam', name: m.home_team?.name ?? 'Local' },
    awayTeam: { '@type': 'SportsTeam', name: m.away_team?.name ?? 'Visitante' },
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LiveMatchRefresh status={m.status} kickoffTime={m.kickoff_time} />
      <MatchHeader match={m} competition={competitionCtx} prediction={savedPrediction} />

      {/* Veredicto post-partido (solo finalizados) */}
      {m.status === 'finished' && <VerdictPanel matchId={m.id} />}

      {/* Cronología: fútbol → eventos (goles/tarjetas); baloncesto → cuartos */}
      {isFootball && ['finished', 'live'].includes(m.status) && (
        <MatchTimeline
          matchId={m.id}
          homeTeamId={m.home_team_id}
          homeName={m.home_team?.short_name ?? m.home_team?.name ?? 'Local'}
          awayName={m.away_team?.short_name ?? m.away_team?.name ?? 'Visitante'}
          hasSource={m.api_football_id != null}
          status={m.status}
        />
      )}
      {!isFootball && ['finished', 'live'].includes(m.status) && (
        <QuarterBreakdown
          matchId={m.id}
          homeCode={m.home_team?.code ?? 'LOC'}
          awayCode={m.away_team?.code ?? 'VIS'}
        />
      )}

      {/* Modelo vs Mercado (mejora 9): la barra 1X2 del modelo con los
          marcadores de la probabilidad justa de Pinnacle. Solo fútbol con
          cuotas 1X2; se auto-oculta si no hay mercado. */}
      {isFootball && mvm && marketImplied && (
        <section aria-label="Modelo vs mercado" className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white">Modelo vs Mercado</h3>
            <span className={cn(
              'rounded px-2 py-0.5 text-[11px] font-bold',
              mvm.edge > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : mvm.edge < 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-zinc-800 text-zinc-400',
            )}>
              {mvm.pickLabel}: {mvm.edge > 0 ? '+' : ''}{mvm.edge}pp vs mercado
            </span>
          </div>
          <ProbBar1X2
            variant="full"
            home={mvm.mh} draw={mvm.md} away={mvm.ma}
            market={marketImplied}
            homeLabel={m.home_team?.code} awayLabel={m.away_team?.code}
          />
          <p className="mt-2 text-[11px] text-zinc-600">
            Barra: probabilidad del modelo. Marcadores blancos: dónde traza el
            mercado (Pinnacle, sin margen) sus límites. Un edge positivo = el
            modelo ve más probable ese resultado que el mercado.
          </p>
        </section>
      )}

      {/* Movimiento del mercado (pre-partido; se auto-oculta sin datos) */}
      <MarketMovementPanel
        movements={movements}
        homeName={m.home_team?.short_name ?? m.home_team?.name ?? 'Local'}
        awayName={m.away_team?.short_name ?? m.away_team?.name ?? 'Visita'}
      />

      {/* Historial de enfrentamientos (se auto-oculta si no hay ninguno) */}
      <HeadToHead
        h2h={h2h}
        homeName={m.home_team?.short_name ?? m.home_team?.name ?? 'Local'}
        awayName={m.away_team?.short_name ?? m.away_team?.name ?? 'Visita'}
        homeIsA={true}
      />

      <MatchAnalysisTabs
        match={m}
        prediction={prediction}
        matchStats={matchStats}
        homeStats={homeStats}
        awayStats={awayStats}
        injuries={injuriesData ?? []}
        odds={odds}
        homeRecentMatches={homeRecentMatches}
        awayRecentMatches={awayRecentMatches}
        homeGroupContext={homeGroupContext ?? undefined}
        awayGroupContext={awayGroupContext ?? undefined}
        football={isFootball}
      />
    </div>
  )
}
