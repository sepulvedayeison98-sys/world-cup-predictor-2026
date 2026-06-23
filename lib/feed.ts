export interface FeedEntry {
  id: string
  type: 'prediction' | 'value_bet' | 'result' | 'alert'
  timestamp: string
  title: string
  detail: string
  code1?: string | null
  code2?: string | null
}

export function buildFeedEntries(
  predictions: any[],
  valueBets: any[],
): FeedEntry[] {
  const entries: FeedEntry[] = []

  for (const p of (predictions ?? []).slice(0, 10)) {
    const m = p.match
    const homeP = p.home_win_probability ?? 0
    const drawP = p.draw_probability ?? 0
    const awayP = p.away_win_probability ?? 0
    const maxP = Math.max(homeP, drawP, awayP)
    const outcome =
      maxP === homeP ? `${m?.home_team?.code ?? '?'} gana` :
      maxP === awayP ? `${m?.away_team?.code ?? '?'} gana` : 'Empate'
    entries.push({
      id: `pred-${p.id}`,
      type: 'prediction',
      timestamp: p.created_at ?? new Date().toISOString(),
      title: `${m?.home_team?.code ?? '?'} – ${m?.away_team?.code ?? '?'}`,
      detail: `${outcome} · Confianza ${Math.round(maxP * 100)}%`,
      code1: m?.home_team?.code ?? null,
      code2: m?.away_team?.code ?? null,
    })
  }

  for (const b of (valueBets ?? []).slice(0, 5)) {
    const edgePct = b.edge != null
      ? Number(b.edge) * 100
      : ((b.model_probability ?? 0) - (b.implied_probability ?? 0)) * 100
    const marketLabel = b.market?.replace(/_/g, ' ') ?? 'Apuesta de valor'
    entries.push({
      id: `bet-${b.id}`,
      type: 'value_bet',
      timestamp: b.created_at ?? new Date().toISOString(),
      title: marketLabel.charAt(0).toUpperCase() + marketLabel.slice(1),
      detail: `Edge: +${edgePct.toFixed(1)}% · Cuota: ${b.odds_value?.toFixed(2) ?? '—'} · ${b.bookmaker ?? '—'}`,
    })
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}
