import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { LEAGUE_SLUGS, LEAGUE_NAMES } from '@/lib/constants'
import { computeLeagueStandings } from '@/lib/leagueStandings'
import { StandingsTable } from '@/components/leagues/StandingsTable'
import { JornadaCalendar, type JornadaView, type JornadaMatchView } from '@/components/leagues/JornadaCalendar'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 300

export function generateStaticParams() {
  return Object.keys(LEAGUE_SLUGS).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return { title: `${LEAGUE_NAMES[slug] ?? 'Liga'} | World Cup Predictor` }
}

type Outcome = 'home' | 'draw' | 'away'

function pickOf(p: { home: number; draw: number; away: number }): Outcome {
  if (p.home >= p.draw && p.home >= p.away) return 'home'
  return p.away >= p.draw ? 'away' : 'draw'
}

export default async function LeagueDetailPage({ params }: Props) {
  const { slug } = await params
  const competitionId = LEAGUE_SLUGS[slug]
  if (!competitionId) notFound()

  // Cliente sin cookies(): permite el prerender estático (ISR) de la página
  const supabase = createStaticSupabaseClient()
  const [{ data: comp }, { data: teams }, { data: matches }] = await Promise.all([
    supabase
      .from('competitions')
      .select('id, name, season, country')
      .eq('id', competitionId)
      .single(),
    supabase
      .from('teams')
      .select('id, name, code, logo_url')
      .eq('competition_id', competitionId),
    supabase
      .from('matches')
      .select(`
        id, round, status, kickoff_time, home_team_id, away_team_id, home_score, away_score,
        predictions(home_win_probability, draw_probability, away_win_probability, was_correct, model_version)
      `)
      .eq('competition_id', competitionId)
      .order('kickoff_time', { ascending: true }),
  ])
  if (!comp || !teams?.length) notFound()

  // Solo temporada regular (round ≠ NULL): los playoffs de descenso no
  // cuentan para la tabla ni el calendario, y el rival de segunda
  // división del playoff no aparece como equipo de la liga.
  const regularMatches = ((matches ?? []) as any[]).filter((m) => m.round != null)
  const inLeague = new Set(regularMatches.flatMap((m) => [m.home_team_id, m.away_team_id]))
  const leagueTeams = (teams as any[]).filter((t) => inLeague.has(t.id))

  const teamById = new Map((teams as any[]).map((t) => [t.id, t]))
  const standings = computeLeagueStandings(leagueTeams, regularMatches)

  // ── Calendario agrupado por jornada ────────────────────────
  const byRound = new Map<number, JornadaMatchView[]>()
  let evaluated = 0
  let correct = 0
  for (const m of (matches ?? []) as any[]) {
    if (m.round == null) continue
    const home = teamById.get(m.home_team_id)
    const away = teamById.get(m.away_team_id)
    if (!home || !away) continue

    // PostgREST: relación 1-a-1 → objeto; por robustez se acepta array
    const rawPred = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
    let prediction: JornadaMatchView['prediction'] = null
    if (rawPred) {
      const probs = {
        home: Number(rawPred.home_win_probability),
        draw: Number(rawPred.draw_probability),
        away: Number(rawPred.away_win_probability),
      }
      prediction = { ...probs, pick: pickOf(probs), correct: rawPred.was_correct }
      if (rawPred.was_correct !== null) {
        evaluated++
        if (rawPred.was_correct) correct++
      }
    }

    const row: JornadaMatchView = {
      id: m.id,
      kickoff_time: m.kickoff_time,
      status: m.status,
      home: { name: home.name, logo_url: home.logo_url },
      away: { name: away.name, logo_url: away.logo_url },
      home_score: m.home_score,
      away_score: m.away_score,
      prediction,
    }
    const list = byRound.get(m.round) ?? []
    list.push(row)
    byRound.set(m.round, list)
  }
  const jornadas: JornadaView[] = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, ms]) => ({ round, matches: ms }))

  // Jornada inicial: la última con partidos jugados
  const lastPlayed = jornadas.filter((j) => j.matches.some((m) => m.status === 'finished'))
  const initialRound = lastPlayed.length ? lastPlayed[lastPlayed.length - 1].round : (jornadas[0]?.round ?? 1)

  // ── Tarjetas de resumen ────────────────────────────────────
  const leader = standings[0]
  const bestAttack = [...standings].sort((a, b) => b.goals_for - a.goals_for)[0]
  const bestDefense = [...standings].sort((a, b) => a.goals_against - b.goals_against)[0]
  const accuracy = evaluated > 0 ? ((correct / evaluated) * 100).toFixed(1) : null

  const cards = [
    { label: 'Líder', value: leader?.team.name ?? '—', sub: leader ? `${leader.points} pts` : '' },
    { label: 'Mejor ataque', value: bestAttack?.team.name ?? '—', sub: bestAttack ? `${bestAttack.goals_for} goles` : '' },
    { label: 'Mejor defensa', value: bestDefense?.team.name ?? '—', sub: bestDefense ? `${bestDefense.goals_against} en contra` : '' },
    { label: 'Precisión del modelo', value: accuracy ? `${accuracy}%` : '—', sub: evaluated ? `${correct}/${evaluated} picks · azar 33% · siempre-local ≈44%` : 'sin evaluar' },
  ]

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/ligas" className="flex w-fit items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Ligas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">{comp.name}</h1>
        <p className="text-sm text-zinc-400">{comp.country} · Temporada {comp.season}</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{c.label}</p>
            <p className="mt-1 truncate text-sm font-bold text-white">{c.value}</p>
            <p className="text-xs text-zinc-500">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden h-fit">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-bold text-white">Tabla de posiciones</h2>
          </div>
          <StandingsTable standings={standings} />
        </div>

        {jornadas.length > 0 && <JornadaCalendar jornadas={jornadas} initialRound={initialRound} />}
      </div>

      <p className="text-[11px] text-zinc-600">
        Fuente: API-Football (api-sports.io) · Modelo liga-1.0: backtest
        walk-forward — cada partido se predice solo con información previa a su
        disputa. Métricas honestas, sin mirar el futuro.
      </p>
    </div>
  )
}
