/**
 * Veredicto post-partido: orquestación y caché (P3 del detalle universal).
 *
 * Se genera UNA vez por partido y queda en match_verdicts para siempre:
 *   1. Capa determinista (lib/verdictEngine) — hechos desde datos reales.
 *   2. Capa de redacción con Claude (opcional): pule la prosa SIN
 *      cambiar los hechos. Si no hay clave o falla, se publica la
 *      versión determinista — el bloque nunca queda vacío.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureMatchEvents } from '@/services/sync/match-events'
import { buildDeterministicVerdict, type VerdictInput, type VerdictOutput } from '@/lib/verdictEngine'
import { buildNbaVerdict } from '@/lib/nba/verdict'
import { sportOfCompetition } from '@/lib/sports'

const CLAUDE_MODEL = 'claude-sonnet-4-6'

export interface StoredVerdict extends VerdictOutput {
  generator: string
  created_at: string
}

async function polishWithClaude(base: VerdictOutput, input: VerdictInput): Promise<VerdictOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  try {
    const client = new Anthropic({ apiKey })
    const goalsTxt = input.events
      .filter((e) => ['goal', 'penalty_goal', 'own_goal'].includes(e.type))
      .map((e) => `${e.minute}' ${e.player ?? '?'} (${e.side === 'home' ? input.homeName : input.awayName})`)
      .join('; ') || 'sin detalle de goles'
    const prompt = `Eres el analista de una plataforma seria de inteligencia deportiva en español.
Reescribe este veredicto post-partido con prosa clara y sobria (sin exclamaciones, sin inventar NINGÚN dato que no esté aquí).

PARTIDO: ${input.homeName} ${input.homeScore}-${input.awayScore} ${input.awayName} (${input.competitionName})
GOLES: ${goalsTxt}
xG: ${input.homeXg ?? 'n/d'} vs ${input.awayXg ?? 'n/d'}

VEREDICTO BASE (los hechos — consérvalos todos):
${JSON.stringify(base, null, 2)}

Responde SOLO con JSON válido, mismas claves y misma cantidad de factores:
{"summary": "...", "factors": [{"title": "...", "text": "..."}], "prediction_review": "...", "model_lesson": "..."}`

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as VerdictOutput
    if (!parsed.summary || !Array.isArray(parsed.factors) || !parsed.prediction_review || !parsed.model_lesson) return null
    // No dejar que el pulido pierda factores del determinista (la señal real)
    if (parsed.factors.length < base.factors.length) return null
    return parsed
  } catch (err: any) {
    console.error('[verdict] Claude falló, se usa la versión determinista:', err?.message)
    return null
  }
}

/** Pulido de prosa genérico (sport-neutral): conserva los hechos del base. */
async function polishVerdictText(
  base: VerdictOutput, sport: string, matchLine: string,
): Promise<VerdictOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  try {
    const client = new Anthropic({ apiKey })
    const prompt = `Eres el analista de una plataforma seria de inteligencia deportiva en español.
Reescribe este veredicto post-partido (${sport}) con prosa clara y sobria, sin exclamaciones
y sin inventar NINGÚN dato que no esté aquí.

PARTIDO: ${matchLine}

VEREDICTO BASE (los hechos — consérvalos todos):
${JSON.stringify(base, null, 2)}

Responde SOLO con JSON válido, mismas claves y misma cantidad de factores:
{"summary":"...","factors":[{"title":"...","text":"..."}],"prediction_review":"...","model_lesson":"..."}`
    const message = await client.messages.create({
      model: CLAUDE_MODEL, max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as VerdictOutput
    if (!parsed.summary || !Array.isArray(parsed.factors) || !parsed.prediction_review || !parsed.model_lesson) return null
    // No dejar que el pulido pierda factores del determinista (la señal real)
    if (parsed.factors.length < base.factors.length) return null
    return parsed
  } catch (err: any) {
    console.error('[verdict] polish falló, se usa determinista:', err?.message)
    return null
  }
}

export async function getOrCreateVerdict(matchId: string): Promise<StoredVerdict | null> {
  const supabase = createAdminClient()

  // 1. Caché permanente
  const { data: existing } = await supabase
    .from('match_verdicts')
    .select('summary, factors, prediction_review, model_lesson, generator, created_at')
    .eq('match_id', matchId)
    .maybeSingle()
  if (existing) return existing as unknown as StoredVerdict

  // 2. Datos del partido (solo finalizados con marcador)
  const { data: match } = await supabase
    .from('matches')
    .select(`
      id, status, home_score, away_score, home_score_ht, away_score_ht, period_scores,
      home_team_id, away_team_id, competition_id,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name),
      predictions(home_win_probability, draw_probability, away_win_probability, predicted_home_score, predicted_away_score, model_version),
      match_statistics(team_id, xg),
      competition:competitions(name)
    `)
    .eq('id', matchId)
    .maybeSingle()
  const m = match as any
  if (!m || m.status !== 'finished' || m.home_score == null || m.away_score == null) return null
  const pred0 = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions

  // ── Baloncesto: veredicto por puntos/cuartos, sin API de fútbol ──
  if (sportOfCompetition(m.competition_id) === 'baloncesto') {
    const final = buildNbaVerdict({
      homeName: m.home_team?.name ?? 'Local',
      awayName: m.away_team?.name ?? 'Visitante',
      homeScore: m.home_score,
      awayScore: m.away_score,
      competitionName: m.competition?.name ?? 'la competición',
      periodScores: m.period_scores ?? null,
      prediction: pred0
        ? {
            home: Number(pred0.home_win_probability),
            away: Number(pred0.away_win_probability),
            predictedHome: pred0.predicted_home_score,
            predictedAway: pred0.predicted_away_score,
          }
        : null,
    })
    const polished = await polishVerdictText(final, 'baloncesto',
      `${m.home_team?.name} ${m.home_score}-${m.away_score} ${m.away_team?.name} (${m.competition?.name})`)
    const chosen = polished ?? final
    const gen = polished ? CLAUDE_MODEL : 'deterministic'
    await (supabase.from('match_verdicts') as any).upsert({
      match_id: matchId, summary: chosen.summary, factors: chosen.factors,
      prediction_review: chosen.prediction_review, model_lesson: chosen.model_lesson,
      generator: gen, model_version: pred0?.model_version ?? null,
    }, { onConflict: 'match_id', ignoreDuplicates: true })
    return { ...chosen, generator: gen, created_at: new Date().toISOString() }
  }

  // 3. Eventos (reutiliza la ingesta bajo demanda de P2)
  const { events } = await ensureMatchEvents(matchId)

  const pred = Array.isArray(m.predictions) ? m.predictions[0] : m.predictions
  const stats = (m.match_statistics ?? []) as any[]
  const homeXg = stats.find((s) => s.team_id === m.home_team_id)?.xg ?? null
  const awayXg = stats.find((s) => s.team_id === m.away_team_id)?.xg ?? null

  const input: VerdictInput = {
    homeName: m.home_team?.name ?? 'Local',
    awayName: m.away_team?.name ?? 'Visitante',
    homeScore: m.home_score,
    awayScore: m.away_score,
    htHome: m.home_score_ht,
    htAway: m.away_score_ht,
    competitionName: m.competition?.name ?? 'la competición',
    prediction: pred
      ? {
          home: Number(pred.home_win_probability),
          draw: Number(pred.draw_probability),
          away: Number(pred.away_win_probability),
          predictedHome: pred.predicted_home_score,
          predictedAway: pred.predicted_away_score,
        }
      : null,
    homeXg: homeXg != null ? Number(homeXg) : null,
    awayXg: awayXg != null ? Number(awayXg) : null,
    events: events.map((e) => ({
      type: e.type,
      minute: e.minute,
      side: e.team_id === m.home_team_id ? 'home' as const : e.team_id === m.away_team_id ? 'away' as const : null,
      player: e.player_name,
    })),
  }

  // 4. Determinista siempre; Claude pule si está disponible
  const base = buildDeterministicVerdict(input)
  const polished = await polishWithClaude(base, input)
  const final = polished ?? base
  const generator = polished ? CLAUDE_MODEL : 'deterministic'

  // 5. Persistir (idempotente ante carreras: PK match_id)
  const row = {
    match_id: matchId,
    summary: final.summary,
    factors: final.factors,
    prediction_review: final.prediction_review,
    model_lesson: final.model_lesson,
    generator,
    model_version: pred?.model_version ?? null,
  }
  const { error } = await (supabase.from('match_verdicts') as any)
    .upsert(row, { onConflict: 'match_id', ignoreDuplicates: true })
  if (error) console.error('[verdict] persistencia:', error.message)

  return { ...final, generator, created_at: new Date().toISOString() }
}
