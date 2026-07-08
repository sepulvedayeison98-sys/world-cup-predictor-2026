import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Activity, AlertTriangle } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { TerminalHeader } from '@/components/dashboard/TerminalHeader'
import { MODEL_VERSION, COMPETITION_ID, PHASE_LABELS, LEAGUE_DISPLAY_ORDER } from '@/lib/constants'
import { ACTIVE_COMPETITIONS, COMPETITIONS_NAV, competitionHref } from '@/lib/sports'

export const metadata: Metadata = {
  title: 'Inicio | Veredicto — Inteligencia Deportiva',
  description: 'Predicciones y análisis con métricas verificables: Mundial 2026 y las 5 grandes ligas europeas.',
}

// ISR 60s: el inicio se cachea y los datos vivos se refrescan solos
export const revalidate = 60

type Outcome = 'home' | 'draw' | 'away'
const OUTCOME_LABEL: Record<Outcome, string> = { home: 'Local', draw: 'Empate', away: 'Visita' }

function pickOf(p: { home: number; draw: number; away: number }): Outcome {
  if (p.home >= p.draw && p.home >= p.away) return 'home'
  return p.away >= p.draw ? 'away' : 'draw'
}

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', ...opts })
}

/**
 * Inicio global (auditoría F3): responde en orden — ¿qué pasa hoy?,
 * ¿qué dice el motor?, ¿puedo confiar? El Mundial ya no es el universo:
 * es la primera tarjeta de un panel multi-competición.
 */
export default async function HomePage() {
  const supabase = createStaticSupabaseClient()
  const now = Date.now()
  const in48h = new Date(now + 48 * 3600_000).toISOString()
  const in72h = new Date(now + 72 * 3600_000).toISOString()
  const since3h = new Date(now - 3 * 3600_000).toISOString()
  const since30d = new Date(now - 30 * 24 * 3600_000).toISOString()

  const [
    { data: upcoming },
    { data: wcPreds },
    { data: ligaPreds },
    { data: preds30d },
    { data: topBet },
    { data: lastFinished },
    { data: lastRecalib },
    { count: liveCount },
    { data: nextWcMatch },
  ] = await Promise.all([
    // Hoy en juego: cualquier competición, próximas 48 h (o en vivo)
    supabase
      .from('matches')
      .select(`
        id, kickoff_time, status, phase, competition_id,
        home_team:teams!matches_home_team_id_fkey(id, name, code, elo_rating),
        away_team:teams!matches_away_team_id_fkey(id, name, code, elo_rating),
        predictions(home_win_probability, draw_probability, away_win_probability, confidence_score, predicted_home_score, predicted_away_score)
      `)
      .in('status', ['scheduled', 'live'])
      .gte('kickoff_time', since3h)
      .lte('kickoff_time', in48h)
      .order('kickoff_time', { ascending: true })
      .limit(6),
    // Confianza: Mundial
    supabase
      .from('predictions')
      .select('was_correct, match:matches!inner(competition_id)')
      .eq('match.competition_id', COMPETITION_ID)
      .not('was_correct', 'is', null),
    // Confianza: ligas (backtest liga-1.0)
    supabase
      .from('predictions')
      .select('was_correct, match:matches!inner(competition_id)')
      .in('match.competition_id', LEAGUE_DISPLAY_ORDER)
      .not('was_correct', 'is', null),
    // Precisión 30 días (cinta terminal, cualquier competición)
    supabase
      .from('predictions')
      .select('was_correct, match:matches!inner(kickoff_time)')
      .gte('match.kickoff_time', since30d)
      .not('was_correct', 'is', null),
    // Smart Bet destacada: mayor EV activa con partido por jugar
    supabase
      .from('value_bets')
      .select(`
        id, market, bookmaker, odds_value, expected_value, edge, grade,
        match:matches!inner(id, kickoff_time, status,
          home_team:teams!matches_home_team_id_fkey(code, name),
          away_team:teams!matches_away_team_id_fkey(code, name))
      `)
      .eq('is_active', true)
      .gte('match.kickoff_time', since3h)
      .order('expected_value', { ascending: false })
      .limit(1),
    // Actividad: últimos resueltos (cualquier competición)
    supabase
      .from('matches')
      .select(`
        id, kickoff_time, home_score, away_score, competition_id,
        home_team:teams!matches_home_team_id_fkey(code),
        away_team:teams!matches_away_team_id_fkey(code),
        predictions(was_correct)
      `)
      .eq('status', 'finished')
      .order('kickoff_time', { ascending: false })
      .limit(3),
    // Actividad: última recalibración del motor
    supabase
      .from('predictions')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live'),
    supabase
      .from('matches')
      .select('phase, kickoff_time')
      .eq('competition_id', COMPETITION_ID)
      .in('status', ['scheduled', 'live'])
      .order('kickoff_time', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // ── Confianza del motor ────────────────────────────────────
  const acc = (rows: any[] | null) => {
    const r = rows ?? []
    const c = r.filter((p) => p.was_correct === true).length
    return { correct: c, total: r.length, pct: r.length ? (c / r.length) * 100 : null }
  }
  const wc = acc(wcPreds)
  const ligas = acc(ligaPreds)
  const d30 = acc(preds30d)

  // ── Pick del día: mayor confianza entre lo que viene (72 h) ─
  const upcomingRows = (upcoming ?? []) as any[]
  const candidates = upcomingRows
    .filter((m) => {
      const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
      return p && new Date(m.kickoff_time).getTime() <= now + 72 * 3600_000
    })
    .map((m) => ({ m, p: Array.isArray(m.predictions) ? m.predictions[0] : m.predictions }))
    .sort((a, b) => Number(b.p.confidence_score) - Number(a.p.confidence_score))
  const pick = candidates[0] ?? null
  let pickReasoning = ''
  let pickOutcome: Outcome = 'home'
  if (pick) {
    const probs = {
      home: Number(pick.p.home_win_probability),
      draw: Number(pick.p.draw_probability),
      away: Number(pick.p.away_win_probability),
    }
    pickOutcome = pickOf(probs)
    const favTeam = pickOutcome === 'home' ? pick.m.home_team : pickOutcome === 'away' ? pick.m.away_team : null
    const favProb = Math.round(Math.max(probs.home, probs.draw, probs.away) * 100)
    const eloH = pick.m.home_team?.elo_rating
    const eloA = pick.m.away_team?.elo_rating
    pickReasoning = favTeam
      ? `El motor da ${favProb}% a ${favTeam.name}: ELO ${eloH} vs ${eloA} y marcador estimado ${pick.p.predicted_home_score}-${pick.p.predicted_away_score}.`
      : `El motor ve un partido cerrado (${favProb}% de empate, ELO ${eloH} vs ${eloA}): marcador estimado ${pick.p.predicted_home_score}-${pick.p.predicted_away_score}.`
  }

  // ── Estado de competiciones ────────────────────────────────
  const wcPhaseLabel = nextWcMatch
    ? (PHASE_LABELS[(nextWcMatch as any).phase] ?? 'En juego')
    : 'Torneo finalizado'
  const upcomingComps = COMPETITIONS_NAV.filter((c) => c.status === 'proximamente')

  // ── Smart Bet destacada ────────────────────────────────────
  const bet = (topBet?.[0] ?? null) as any

  // ── Actividad del motor ────────────────────────────────────
  const recalibAt = (lastRecalib?.[0] as any)?.updated_at
  const compName = (id: string) => COMPETITIONS_NAV.find((c) => c.id === id)?.name ?? 'Liga'

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      <TerminalHeader
        modelVersion={MODEL_VERSION}
        accuracy30d={d30.pct}
        activeCompetitions={ACTIVE_COMPETITIONS.length}
        liveCount={liveCount ?? 0}
      />

      {/* ── HOY EN JUEGO ─────────────────────────────────────── */}
      <section aria-label="Hoy en juego">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Hoy en juego</h2>
          <Link href="/matches" className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
            ver agenda <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {upcomingRows.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {upcomingRows.map((m) => {
              const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {compName(m.competition_id)} · {PHASE_LABELS[m.phase] ?? ''}
                  </p>
                  <p className="mt-1.5 truncate text-sm font-bold text-zinc-100">
                    {m.home_team?.name} <span className="font-normal text-zinc-500">vs</span> {m.away_team?.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    {p ? (
                      <span className="mono text-zinc-400">
                        {Math.round(p.home_win_probability * 100)}·{Math.round(p.draw_probability * 100)}·{Math.round(p.away_win_probability * 100)}%
                        <span className="ml-2 text-zinc-600">est. {p.predicted_home_score}-{p.predicted_away_score}</span>
                      </span>
                    ) : <span className="text-zinc-600">sin predicción aún</span>}
                    <span className={m.status === 'live' ? 'font-bold text-emerald-400' : 'text-zinc-500'}>
                      {m.status === 'live' ? '● EN VIVO' : fmtDate(m.kickoff_time, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          // Estado vacío inteligente: qué pasó, qué viene, una acción
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-center">
            <p className="text-sm font-medium text-zinc-300">No hay partidos en las próximas 48 horas</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
              {nextWcMatch
                ? `La actividad regresa con ${wcPhaseLabel.toLowerCase()} del Mundial.`
                : 'La temporada europea 2026-27 arranca a mediados de agosto — mientras tanto, el backtest completo de las 5 grandes ligas está disponible.'}
            </p>
            <Link href={nextWcMatch ? '/matches' : '/ligas'} className="mt-3 inline-block text-xs font-semibold text-emerald-400 hover:text-emerald-300">
              {nextWcMatch ? 'Ver agenda →' : 'Explorar ligas →'}
            </Link>
          </div>
        )}
      </section>

      {/* ── PICK DEL DÍA + CONFIANZA ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label="El pick del día" className="rounded-xl border border-emerald-500/30 bg-zinc-900 p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">El pick del día</p>
          {pick ? (
            <>
              <p className="mt-2 text-lg font-bold text-white">
                {pick.m.home_team?.name} <span className="font-normal text-zinc-500">vs</span> {pick.m.away_team?.name}
              </p>
              <p className="text-xs text-zinc-500">
                {compName(pick.m.competition_id)} · {fmtDate(pick.m.kickoff_time, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{pickReasoning}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-xs font-bold text-emerald-400">
                  Pick: {OUTCOME_LABEL[pickOutcome]}
                </span>
                <Link href={`/matches/${pick.m.id}`} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                  ver análisis →
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Sin partidos con predicción en las próximas 72 horas. El pick
              regresa con la próxima jornada.
            </p>
          )}
        </section>

        <section aria-label="Confianza del motor" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Confianza del motor</p>
            <Link href="/inteligencia" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
              metodología →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-bold text-emerald-400 mono">{wc.pct !== null ? `${wc.pct.toFixed(1)}%` : '—'}</p>
              <p className="text-xs text-zinc-500">Mundial 2026 · {wc.correct}/{wc.total} aciertos 1X2</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white mono">{ligas.pct !== null ? `${ligas.pct.toFixed(1)}%` : '—'}</p>
              <p className="text-xs text-zinc-500">5 grandes ligas · backtest {ligas.total} picks</p>
            </div>
          </div>
          <p className="mt-3 border-t border-zinc-800 pt-2.5 text-[11px] text-zinc-600">
            Líneas base: azar 33% · apostar siempre local ≈44%. Cada cifra es
            verificable en Inteligencia.
          </p>
        </section>
      </div>

      {/* ── COMPETICIONES ────────────────────────────────────── */}
      <section aria-label="Competiciones">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-300">Competiciones</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {ACTIVE_COMPETITIONS.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 transition-colors hover:border-zinc-700"
            >
              <p className="truncate text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">{c.name}</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                {c.slug === 'mundial-2026' ? wcPhaseLabel : c.note}
              </p>
            </Link>
          ))}
        </div>
        {upcomingComps.length > 0 && (
          <p className="mt-2 text-[11px] text-zinc-600">
            En el roadmap: {upcomingComps.map((c) => c.name).join(' · ')}.
          </p>
        )}
      </section>

      {/* ── SMART BET + ACTIVIDAD ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-label="Smart Bet destacada" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Smart Bet destacada</p>
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500"><AlertTriangle className="h-3 w-3" /> +18</span>
          </div>
          {bet ? (
            <>
              <p className="mt-2 text-sm font-bold text-white">
                {bet.match?.home_team?.name} vs {bet.match?.away_team?.name}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mono">
                <span>{bet.market === 'over_2_5' ? 'Más de 2.5 goles' : bet.market}</span>
                <span>cuota {Number(bet.odds_value).toFixed(2)}</span>
                <span className="text-emerald-400">edge +{(Number(bet.edge) * 100).toFixed(1)}%</span>
                <span className="text-emerald-400">EV +{(Number(bet.expected_value) * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-zinc-600">Vs. línea justa de Pinnacle · no es asesoría financiera</span>
                <Link href="/value-bets" className="shrink-0 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                  todas →
                </Link>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              El mercado no ofrece valor ahora mismo — el detector sigue
              comparando el modelo contra la línea justa de Pinnacle.
            </p>
          )}
        </section>

        <section aria-label="Actividad del motor" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Actividad del motor</p>
          </div>
          <ul className="mt-3 space-y-2.5 text-xs text-zinc-400">
            {recalibAt && (
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Recalibrado por última vez: {fmtDate(recalibAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </li>
            )}
            {((lastFinished ?? []) as any[]).map((m) => {
              const p = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
              return (
                <li key={m.id} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${p?.was_correct === true ? 'bg-emerald-500' : p?.was_correct === false ? 'bg-red-500' : 'bg-zinc-600'}`} />
                  <Link href={`/matches/${m.id}`} className="mono hover:text-zinc-200">
                    {m.home_team?.code} {m.home_score}-{m.away_score} {m.away_team?.code}
                  </Link>
                  <span className="text-zinc-600">
                    {compName(m.competition_id)} · {p?.was_correct === true ? 'pick acertado' : p?.was_correct === false ? 'pick fallido' : 'resuelto'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
