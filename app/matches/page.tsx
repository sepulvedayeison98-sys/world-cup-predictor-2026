import type { Metadata } from 'next'
import { MatchesTable } from '@/components/matches/MatchesTable'
import { MatchFiltersBar } from '@/components/matches/MatchFiltersBar'
import { DayKpiStrip } from '@/components/matches/DayKpiStrip'
import { DayRadar } from '@/components/matches/DayRadar'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { ACTIVE_COMPETITIONS } from '@/lib/sports'
import { predictionWarmup } from '@/lib/predictionQuality'

export const metadata: Metadata = {
  title: 'Partidos',
}

// ISR: cacheado y revalidado cada 60s (sin cookies → renderizado estático)
export const revalidate = 60

/**
 * Agenda de partidos con predicción.
 *
 * Cubre las competiciones ACTIVAS de fútbol, no una sola. Hasta 2026-08 esta
 * página consultaba únicamente el Mundial: cuando el torneo pasó a histórico
 * se quedó sin un solo partido programado que mostrar, aunque las seis ligas
 * en curso sí los tuvieran. Los grupos (concepto exclusivo del Mundial)
 * dejaron paso al filtro por competición.
 */
export default async function MatchesPage() {
  const supabase = createStaticSupabaseClient()

  const competitions = ACTIVE_COMPETITIONS
    .filter((c) => c.sport === 'futbol' && c.id !== null)
    .map((c) => ({ id: c.id as string, name: c.name }))
  const competitionIds = competitions.map((c) => c.id)

  // Equipos de todas las competiciones en curso, para el selector
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, code, competition_id')
    .in('competition_id', competitionIds)
    .order('name')

  // Q2 (auditoría C2): la página nunca abre vacía. Si hoy no hay partidos,
  // la fecha por defecto salta a la próxima fecha con partidos (o a la
  // última jugada si no queda nada por delante).
  const TZ = 'America/Bogota'
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const dayStart = new Date(`${todayStr}T00:00:00-05:00`).toISOString()
  const dayEnd = new Date(`${todayStr}T23:59:59-05:00`).toISOString()
  const { count: todayCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .in('competition_id', competitionIds)
    .gte('kickoff_time', dayStart)
    .lte('kickoff_time', dayEnd)

  let defaultDate = todayStr
  if (!todayCount) {
    const { data: nextDated } = await supabase
      .from('matches')
      .select('kickoff_time')
      .in('competition_id', competitionIds)
      .gte('kickoff_time', dayEnd)
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .maybeSingle()
    const { data: lastDated } = nextDated
      ? { data: null }
      : await supabase
          .from('matches')
          .select('kickoff_time')
          .in('competition_id', competitionIds)
          .order('kickoff_time', { ascending: false })
          .limit(1)
          .maybeSingle()
    const anchor = (nextDated ?? lastDated)?.kickoff_time
    if (anchor) defaultDate = new Date(anchor).toLocaleDateString('en-CA', { timeZone: TZ })
  }
  const jumped = defaultDate !== todayStr
  const jumpedLabel = jumped
    ? new Date(`${defaultDate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  // ── KPIs y radar del día ──────────────────────────────────────────────
  // Sobre el mismo día que muestra la tabla (defaultDate, no "hoy" a
  // secas): si la fecha saltó por falta de partidos, el resumen debe
  // hablar del mismo día que el usuario está viendo.
  const effStart = jumped ? new Date(`${defaultDate}T00:00:00-05:00`).toISOString() : dayStart
  const effEnd = jumped ? new Date(`${defaultDate}T23:59:59-05:00`).toISOString() : dayEnd

  const { data: dayMatchesRaw } = await supabase
    .from('matches')
    .select(`
      id, competition_id, status, home_team_id, away_team_id,
      home_team:teams!matches_home_team_id_fkey(name, short_name, code, logo_url, elo_rating,
        team_statistics(matches_played)),
      away_team:teams!matches_away_team_id_fkey(name, short_name, code, logo_url, elo_rating,
        team_statistics(matches_played)),
      predictions(home_win_probability, draw_probability, away_win_probability,
        predicted_home_score, predicted_away_score, confidence_score, confidence_level)
    `)
    .in('competition_id', competitionIds)
    .gte('kickoff_time', effStart)
    .lte('kickoff_time', effEnd)

  const dayMatches = (dayMatchesRaw ?? []) as any[]
  const playedOf = (t: any) =>
    (Array.isArray(t?.team_statistics) ? t.team_statistics[0]?.matches_played : t?.team_statistics?.matches_played) ?? 0

  // Con base real: solo cuentan los partidos donde los DOS equipos ya
  // calentaron. Un "44/28/28 · 45%" repetido en 300 partidos no es alta
  // confianza, es el prior de la liga — ya lo declaramos en la tabla, y el
  // radar no puede contradecirlo destacándolo como si fuera una lectura.
  const withRealPrediction = dayMatches
    .map((m) => ({ m, p: Array.isArray(m.predictions) ? m.predictions[0] : m.predictions }))
    .filter(({ m, p }) => p && predictionWarmup(playedOf(m.home_team), playedOf(m.away_team)).warmedUp)

  const kpisBase = {
    today: dayMatches.length,
    live: dayMatches.filter((m) => m.status === 'live').length,
    competitions: new Set(dayMatches.map((m) => m.competition_id)).size,
    highConfidence: withRealPrediction.filter(({ p }) => p.confidence_level >= 4).length,
  }

  const byConfidence = [...withRealPrediction].sort((a, b) => b.p.confidence_score - a.p.confidence_score)
  const byBalance = [...withRealPrediction].sort((a, b) => {
    const marginOf = (p: any) => {
      const probs = [p.home_win_probability, p.draw_probability, p.away_win_probability].sort((x, y) => y - x)
      return probs[0] - probs[1]
    }
    return marginOf(a.p) - marginOf(b.p)
  })
  const byStakes = [...withRealPrediction].sort((a, b) => {
    const eloOf = (x: any) => ((x.m.home_team?.elo_rating ?? 1500) + (x.m.away_team?.elo_rating ?? 1500)) / 2
    return eloOf(b) - eloOf(a)
  })

  // Smart Bet del día: el pick sin resolver de mayor confianza entre los
  // partidos de hoy. Si no hay ninguno, la tarjeta simplemente no aparece
  // — no se inventa una oportunidad para no dejar el radar incompleto.
  const dayMatchIds = dayMatches.map((m) => m.id)
  let topSmartBet: any = null
  let smartBetMatches = 0
  if (dayMatchIds.length > 0) {
    const { data: picks } = await supabase
      .from('smart_bet_picks')
      .select('match_id, label, category, confidence')
      .in('match_id', dayMatchIds)
      .eq('resolved', false)
      .order('confidence', { ascending: false })
    const rows = (picks ?? []) as any[]
    smartBetMatches = new Set(rows.map((r) => r.match_id)).size
    const pick = rows[0]
    if (pick) {
      const match = dayMatches.find((m) => m.id === pick.match_id)
      if (match) topSmartBet = { match, label: pick.label, confidence: pick.confidence }
    }
  }

  const kpis = { ...kpisBase, smartBets: smartBetMatches }
  const competitionName = (id: string) => competitions.find((c) => c.id === id)?.name ?? 'Fútbol'
  // El resumen (KPIs + radar) queda anclado al día por defecto del
  // servidor —hoy, o la próxima fecha con partidos si hoy no hay— y no
  // sigue la navegación de fecha del cliente: es un panel de "estado del
  // día", no un resumen de lo que el usuario esté mirando en la tabla de
  // abajo. Por eso lleva fecha explícita: nunca debe leerse como "hoy" si
  // no lo es.
  const kpiDateLabelRaw = new Date(`${defaultDate}T12:00:00`)
    .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  // Mayúscula solo en la primera letra (día de la semana) — `capitalize` en
  // CSS mayusculiza cada palabra ("17 De Agosto"), que no es cómo se
  // escribe una fecha en español.
  const kpiDateLabel = kpiDateLabelRaw.charAt(0).toUpperCase() + kpiDateLabelRaw.slice(1)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Fútbol · {competitions.length} ligas en curso
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Partidos</h1>
        <p className="text-sm text-zinc-400">
          Tabla avanzada con predicciones y probabilidades del motor
        </p>
      </div>

      {jumped && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400">
          Hoy no hay partidos programados — mostrando la próxima fecha con
          actividad: <span className="font-semibold text-emerald-400">{jumpedLabel}</span>.
        </div>
      )}

      <DayKpiStrip {...kpis} dateLabel={kpiDateLabel} />

      <DayRadar
        featured={byStakes[0]}
        mostConfident={byConfidence[0]}
        mostBalanced={byBalance[0]}
        smartBet={topSmartBet}
        competitionName={competitionName}
      />

      {/* Filters */}
      <MatchFiltersBar
        competitions={competitions}
        teams={teams ?? []}
        defaultDate={defaultDate}
      />

      {/* Table */}
      <MatchesTable defaultDate={defaultDate} competitions={competitions} />
    </div>
  )
}
