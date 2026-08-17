import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Activity, AlertTriangle } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { TerminalHeader } from '@/components/dashboard/TerminalHeader'
import { MyTeamsStrip } from '@/components/dashboard/MyTeamsStrip'
import { ProbBar1X2 } from '@/components/predictions/ProbBar1X2'
import { MODEL_VERSION, PHASE_LABELS, LEAGUE_DISPLAY_ORDER, ALL_LEAGUE_COMPETITION_IDS } from '@/lib/constants'
import { ACTIVE_COMPETITIONS, COMPETITIONS_NAV, competitionHref } from '@/lib/sports'
import { CompetitionLogo } from '@/components/ui/CompetitionLogo'
import { fetchTennisDashboardStrip } from '@/services/tennis/queries'
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'
import { EngineConfidencePanel, type EngineConfidenceRow } from '@/components/dashboard/EngineConfidencePanel'

export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Predicciones y análisis con métricas verificables: ligas de fútbol, NBA y tenis ATP.',
}

// ISR 60s: el inicio se cachea y los datos vivos se refrescan solos
export const revalidate = 60

/**
 * Precisión por CONTEO exacto (dos consultas `head`), no trayendo filas.
 * PostgREST corta las respuestas en 1.000 filas: contar en JS lo que devuelve
 * un select daba precisiones calculadas sobre muestras truncadas (p. ej.
 * 518/1000 cuando lo real eran 1.039/2.058).
 */
async function countAccuracy(
  supabase: any,
  scope: (qb: any) => any,
): Promise<{ correct: number; total: number; pct: number | null }> {
  const base = () => scope(supabase.from('predictions')).not('was_correct', 'is', null)
  const [{ count: total }, { count: correct }] = await Promise.all([
    base(),
    base().eq('was_correct', true),
  ])
  const t = total ?? 0
  const c = correct ?? 0
  return { correct: c, total: t, pct: t ? (c / t) * 100 : null }
}

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
 * Inicio global: responde en orden — ¿qué pasa hoy?, ¿qué dice el motor?,
 * ¿puedo confiar? Centrado en las competiciones EN CURSO (ligas de fútbol,
 * NBA, tenis). El Mundial 2026 terminó y pasó a histórico: sus métricas
 * siguen verificables en /inteligencia y /mundial/balance, pero ya no
 * ocupan el inicio.
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
    ligas,
    nba,
    d30,
    { data: topBet },
    { data: lastFinished },
    { data: lastRecalib },
    { count: liveCount },
    tennis,
  ] = await Promise.all([
    // Próximos partidos: cualquier competición, próximas 48 h (o en vivo)
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
    // Confianza: ligas y NBA por CONTEO exacto. Traer las filas y contarlas
    // en JS truncaba la muestra en 1.000 (tope de PostgREST) y la precisión
    // salía calculada sobre datos incompletos.
    countAccuracy(supabase, (qb: any) => qb
      .select('id, match:matches!inner(competition_id)', { count: 'exact', head: true })
      .in('match.competition_id', ALL_LEAGUE_COMPETITION_IDS)),
    countAccuracy(supabase, (qb: any) => qb
      .select('id, match:matches!inner(competition_id)', { count: 'exact', head: true })
      .eq('match.competition_id', NBA_COMPETITION_ID)),
    // Precisión 30 días (cinta terminal, cualquier competición) — por conteo
    countAccuracy(supabase, (qb: any) => qb
      .select('id, match:matches!inner(kickoff_time)', { count: 'exact', head: true })
      .gte('match.kickoff_time', since30d)),
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
    // Tenis: franja del dominio (top del ranking + medición del motor)
    fetchTennisDashboardStrip('ATP').catch(() => ({ top: [], backtest: null })),
  ])

  // ── Confianza del motor ────────────────────────────────────

  // Panel multideporte: precisión medida por dominio, cada uno con su base
  const tennisBt = tennis.backtest
  const confidenceRows: EngineConfidenceRow[] = [
    {
      sport: 'ligas', label: 'Ligas de fútbol', accuracy: ligas.pct, accent: true,
      detail: ligas.total ? `${ligas.correct}/${ligas.total} · azar 33%` : 'sin backtest cargado',
      href: '/inteligencia',
    },
    {
      sport: 'nba', label: 'NBA', accuracy: nba.pct,
      detail: nba.total ? `${nba.correct}/${nba.total} · azar 50%` : 'sin partidos resueltos',
      href: '/nba/predicciones',
    },
    {
      sport: 'tenis', label: 'Tenis · ATP',
      accuracy: tennisBt?.accuracy != null ? tennisBt.accuracy * 100 : null,
      detail: tennisBt?.accuracy != null
        ? `${tennisBt.sample_size.toLocaleString('es-ES')} partidos · azar 50%`
        : 'sin backtest cargado',
      href: '/tennis/inteligencia',
    },
  ]

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
  const upcomingComps = COMPETITIONS_NAV.filter((c) => c.status === 'proximamente')

  // ── Smart Bet destacada ────────────────────────────────────
  const bet = (topBet?.[0] ?? null) as any

  // ── Chips de fecha (zona horaria del producto: Bogotá) ─────
  const bogotaDay = (offsetDays: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(now + offsetDays * 86_400_000))

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

      {/* ── MIS EQUIPOS (favoritos del navegador; oculto si no hay) ── */}
      <MyTeamsStrip />

      {/* ── PRÓXIMOS PARTIDOS (ventana de 48 h; los chips saltan a un día) ── */}
      <section aria-label="Próximos partidos">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Próximos partidos</h2>
          <div className="flex items-center gap-1.5">
            <Link href={`/matches?date=${bogotaDay(0)}`} className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
              Hoy
            </Link>
            <Link href={`/matches?date=${bogotaDay(1)}`} className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
              Mañana
            </Link>
            <Link href="/matches" className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
              agenda <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
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
                    <span className="text-zinc-600">
                      {p ? `est. ${p.predicted_home_score}-${p.predicted_away_score}` : 'sin predicción aún'}
                    </span>
                    <span className={m.status === 'live' ? 'font-bold text-emerald-400' : 'text-zinc-500'}>
                      {m.status === 'live' ? '● EN VIVO' : fmtDate(m.kickoff_time, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {p && (
                    <ProbBar1X2
                      className="mt-2"
                      home={Number(p.home_win_probability)}
                      draw={Number(p.draw_probability)}
                      away={Number(p.away_win_probability)}
                    />
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          // Estado vacío honesto y multideporte: qué pasó, qué sigue vivo
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-center">
            <p className="text-sm font-medium text-zinc-300">No hay partidos de fútbol en las próximas 48 horas</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">
              No hay encuentros en la ventana de 48 horas. El tenis ATP sigue
              activo y el backtest completo de las ligas está disponible.
            </p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <Link href="/tennis" className="text-xs font-semibold text-lime-400 hover:text-lime-300">
                Tenis ATP en vivo →
              </Link>
              <Link href="/ligas" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                Backtest de ligas →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ── PICK DEL DÍA ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
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
            <div className="mt-3 space-y-2">
              <p className="text-sm text-zinc-500">
                El Mundial concluyó. El pick del día regresa cuando arranquen las
                ligas europeas (agosto) o la temporada NBA. Mientras tanto, el
                motor de tenis ATP está activo con su análisis de partidos.
              </p>
              <Link href="/tennis/h2h" className="inline-block text-xs font-semibold text-lime-400 hover:text-lime-300">
                Simular un cara a cara ATP →
              </Link>
            </div>
          )}
        </section>

      </div>

      {/* ── CONFIANZA DEL MOTOR (multideporte) ─────────────────── */}
      <EngineConfidencePanel rows={confidenceRows} />

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
              {/* El escudo va ENCIMA y no al lado: en la rejilla de seis
                  columnas, ponerlo en línea le robaba ancho al nombre y
                  "Premier League" pasaba a "Premier Lea…". */}
              <CompetitionLogo competition={c} size={24} />
              <p className="mt-2 truncate text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">{c.name}</p>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                {c.note}
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

      {/* ── TENIS · ATP ──────────────────────────────────────── */}
      {tennis.top.length > 0 && (
        <section aria-label="Tenis ATP" className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-lime-400">Tenis · ATP</p>
            <Link href="/tennis" className="text-xs font-semibold text-lime-400 hover:text-lime-300">
              hub del tenis →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Cabeza del ranking</p>
              <ul className="mt-1.5 space-y-1.5">
                {tennis.top.map((r) => (
                  <li key={r.player_id}>
                    <Link href={`/tennis/jugadores/${r.player_id}`} className="flex items-center gap-2 text-sm text-zinc-200 hover:text-lime-300">
                      <span className="mono w-6 shrink-0 text-xs font-bold text-zinc-500">#{r.position}</span>
                      <span className="truncate font-medium">{r.name}</span>
                      {r.points != null && (
                        <span className="ml-auto shrink-0 mono text-[11px] text-zinc-500">{r.points.toLocaleString('es-ES')} pts</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Motor {tennis.backtest?.model_version ?? 'de tenis'}</p>
              {tennis.backtest?.accuracy != null ? (
                <>
                  <p className="mt-1 text-3xl font-bold text-lime-400 mono">{(tennis.backtest.accuracy * 100).toFixed(1)}%</p>
                  <p className="text-xs text-zinc-500">
                    precisión en backtest walk-forward · {tennis.backtest.sample_size.toLocaleString('es-ES')} partidos reales
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">Backtest pendiente de publicar.</p>
              )}
            </div>
          </div>
        </section>
      )}

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
