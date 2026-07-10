import type { Metadata } from 'next'
import { Zap } from 'lucide-react'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { ValueBetsFullTable } from '@/components/predictions/ValueBetsFullTable'
import { SmartBetsTrackRecord, type ResolvedPickRow, type CategoryStat, type PendingMatchRow } from '@/components/predictions/SmartBetsTrackRecord'

export const metadata: Metadata = {
  title: 'Apuestas de Valor | World Cup Predictor',
}

// ISR: cacheado y revalidado cada 120s (sin cookies → renderizado estático)
export const revalidate = 120

export default async function ValueBetsPage() {
  const supabase = createStaticSupabaseClient()

  const { data: betsRaw } = await supabase
    .from('value_bets')
    .select(`
      id, match_id, market, bookmaker, odds_value,
      implied_probability, model_probability, expected_value,
      edge, grade, stake_suggestion_percent, result, created_at,
      ai_justification,
      match:matches(
        kickoff_time, venue, city, status,
        home_team:teams!matches_home_team_id_fkey(name, short_name, code),
        away_team:teams!matches_away_team_id_fkey(name, short_name, code)
      )
    `)
    .eq('is_active', true)

  const nowMs = Date.now()
  // Incluir partidos en vivo (status='live') además de los próximos aún no comenzados
  const upcoming = (betsRaw ?? []).filter((b: any) => {
    if (!b.match?.kickoff_time) return false
    return (
      b.match.status === 'live' ||
      new Date(b.match.kickoff_time).getTime() > nowMs - 3 * 60 * 60 * 1000 // últimas 3h
    )
  })

  // Orden cronológico; dentro del mismo partido, mayor EV primero
  const bets = upcoming.slice().sort((a: any, b: any) => {
    const ta = new Date(a.match?.kickoff_time ?? 0).getTime()
    const tb = new Date(b.match?.kickoff_time ?? 0).getTime()
    if (ta !== tb) return ta - tb
    return (b.expected_value ?? 0) - (a.expected_value ?? 0)
  })

  const highBets    = bets.filter((b: any) => b.grade === 'high')
  const mediumBets  = bets.filter((b: any) => b.grade === 'medium')
  const totalEV     = bets.reduce((acc, b: any) => acc + (b.expected_value ?? 0), 0)
  const avgEV       = bets.length > 0 ? totalEV / bets.length : 0
  const bestEdge    = bets.reduce((max, b: any) => Math.max(max, b.edge ?? 0), 0)

  // ── Historial de aciertos Smart Bets — 3 consultas en paralelo ──────
  const [{ data: resolvedRaw }, { data: recentRaw }, { data: pendingRaw }] = await Promise.all([
    supabase
      .from('smart_bet_picks')
      .select('id, category, gradable, correct')
      .eq('resolved', true),
    supabase
      .from('smart_bet_picks')
      .select(`
        id, match_id, market_id, category, label, rank, confidence, gradable, correct, actual_detail, resolved_at,
        match:matches(
          home_team:teams!matches_home_team_id_fkey(name, code),
          away_team:teams!matches_away_team_id_fkey(name, code)
        )
      `)
      .eq('resolved', true)
      .order('resolved_at', { ascending: false })
      .limit(20),
    supabase
      .from('smart_bet_picks')
      .select(`
        id, match_id, market_id, label, category, confidence,
        match:matches(kickoff_time,
          home_team:teams!matches_home_team_id_fkey(code),
          away_team:teams!matches_away_team_id_fkey(code))
      `)
      .eq('resolved', false),
  ])

  const resolved = (resolvedRaw ?? []) as any[]
  const gradedRows = resolved.filter((r) => r.gradable)
  const totalAnalyzed = gradedRows.length
  const totalCorrect = gradedRows.filter((r) => r.correct === true).length
  const ungradedCount = resolved.length - gradedRows.length

  const categoryMap = new Map<string, CategoryStat>()
  for (const r of gradedRows) {
    const entry = categoryMap.get(r.category) ?? { category: r.category, analyzed: 0, correct: 0 }
    entry.analyzed++
    if (r.correct === true) entry.correct++
    categoryMap.set(r.category, entry)
  }
  const byCategory = [...categoryMap.values()].sort((a, b) => b.analyzed - a.analyzed)

  // Recomendaciones registradas que aún esperan resultado (partido por jugarse)
  const pendingByMatch = new Map<string, PendingMatchRow>()
  for (const p of ((pendingRaw ?? []) as any[])) {
    let entry = pendingByMatch.get(p.match_id)
    if (!entry) {
      entry = {
        match_id: p.match_id,
        home_code: p.match?.home_team?.code ?? '?',
        away_code: p.match?.away_team?.code ?? '?',
        kickoff_time: p.match?.kickoff_time ?? '',
        picks: [],
      }
      pendingByMatch.set(p.match_id, entry)
    }
    entry.picks.push({ id: p.id, label: p.label, category: p.category, confidence: Number(p.confidence) })
  }
  const pendingMatches = [...pendingByMatch.values()]
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time))

  const recentPicks: ResolvedPickRow[] = ((recentRaw ?? []) as any[]).map((p) => ({
    id: p.id,
    match_id: p.match_id,
    market_id: p.market_id,
    category: p.category,
    label: p.label,
    rank: p.rank,
    confidence: Number(p.confidence),
    gradable: p.gradable,
    correct: p.correct,
    actual_detail: p.actual_detail,
    resolved_at: p.resolved_at,
    home_code: p.match?.home_team?.code ?? '?',
    away_code: p.match?.away_team?.code ?? '?',
    home_name: p.match?.home_team?.name ?? 'Local',
    away_name: p.match?.away_team?.name ?? 'Visitante',
  }))

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Zap className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Apuestas de Valor</h1>
            <p className="text-sm text-zinc-500">
              Mercados con EV positivo · Modelo 5 factores
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Detección activa</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="kpi-card">
          <p className="text-[11px] text-zinc-500">Total detectadas</p>
          <p className="text-2xl font-bold mono text-white">{bets.length}</p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] text-zinc-500">Alto valor</p>
          <p className="text-2xl font-bold mono text-emerald-400">{highBets.length}</p>
          <p className="text-[10px] text-zinc-600">{mediumBets.length} valor medio</p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] text-zinc-500">EV promedio</p>
          <p className={`text-2xl font-bold mono ${avgEV > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {avgEV > 0 ? '+' : ''}{(avgEV * 100).toFixed(1)}%
          </p>
        </div>
        <div className="kpi-card">
          <p className="text-[11px] text-zinc-500">Mejor edge</p>
          <p className="text-2xl font-bold mono text-violet-400">+{(bestEdge * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
        <p className="text-xs text-amber-400">
          ⚠️ Value bets calculadas contra la línea justa de Pinnacle (cuotas reales).
          Estimaciones del modelo, no asesoramiento financiero — verifica en tu casa de apuestas.
          Solo apuesta lo que puedas permitirte perder. +18.
        </p>
      </div>

      {bets.length === 0 ? (
        /* Q8: el mercado sin valor no es un error — es información */
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center">
          <p className="text-sm font-medium text-zinc-300">
            El mercado no ofrece valor en este momento
          </p>
          <p className="mx-auto mt-2 max-w-md text-xs text-zinc-500">
            El detector compara el modelo contra la línea justa de Pinnacle de
            forma continua; cuando una cuota supere el umbral de edge, la
            oportunidad aparecerá aquí automáticamente.
          </p>
          <a href="/predictions" className="mt-4 inline-block text-xs font-semibold text-emerald-400 hover:text-emerald-300">
            Ver predicciones del motor →
          </a>
        </div>
      ) : (
        <ValueBetsFullTable bets={bets} />
      )}

      <SmartBetsTrackRecord
        totalAnalyzed={totalAnalyzed}
        totalCorrect={totalCorrect}
        byCategory={byCategory}
        ungradedCount={ungradedCount}
        recent={recentPicks}
        pending={pendingMatches}
      />
    </div>
  )
}
