import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import {
  generateFallbackAnalysis,
  type GroupContext,
  type AnalysisContext,
  type MatchAnalysis,
} from '@/lib/matchAnalysisFallback'

// Re-export: varios componentes importan estos tipos desde esta ruta
export type { GroupContext, AnalysisContext, MatchAnalysis }

function buildPrompt(ctx: AnalysisContext): string {
  const homeFormStr = ctx.homeForm.slice(0, 6)
    .map(m => `${m.result} ${m.goals_scored}-${m.goals_conceded} vs ${m.opponent_name}`)
    .join(', ')
  const awayFormStr = ctx.awayForm.slice(0, 6)
    .map(m => `${m.result} ${m.goals_scored}-${m.goals_conceded} vs ${m.opponent_name}`)
    .join(', ')

  const homeInj = ctx.homeInjuries.map(i => `${i.name} (${i.position})`).join(', ') || 'Ninguna'
  const awayInj = ctx.awayInjuries.map(i => `${i.name} (${i.position})`).join(', ') || 'Ninguna'

  const betsStr = ctx.bets
    .map(b => `  "${b.id}": "${b.label}" — ${b.confidence}% conf. (tier: ${b.tier})`)
    .join('\n')

  const betKeys = ctx.bets
    .map(b => `    "${b.id}": "explicación de 2-3 oraciones específica para ${ctx.homeTeam.name} vs ${ctx.awayTeam.name}"`)
    .join(',\n')

  const hw = Math.round(ctx.prediction.home_win_probability * 100)
  const dr = Math.round(ctx.prediction.draw_probability * 100)
  const aw = Math.round(ctx.prediction.away_win_probability * 100)

  const homeGrp = ctx.homeGroupContext
  const awayGrp = ctx.awayGroupContext
  const homeGrpStr = homeGrp
    ? `• Fase de grupos: ${homeGrp.groupName} — ${homeGrp.position}º lugar (${homeGrp.won}V-${homeGrp.drawn}E-${homeGrp.lost}D, ${homeGrp.goalsFor}:${homeGrp.goalsAgainst}, ${homeGrp.points}pts). Otros equipos del grupo: ${homeGrp.otherTeams.join(', ')}.`
    : ''
  const awayGrpStr = awayGrp
    ? `• Fase de grupos: ${awayGrp.groupName} — ${awayGrp.position}º lugar (${awayGrp.won}V-${awayGrp.drawn}E-${awayGrp.lost}D, ${awayGrp.goalsFor}:${awayGrp.goalsAgainst}, ${awayGrp.points}pts). Otros equipos del grupo: ${awayGrp.otherTeams.join(', ')}.`
    : ''

  return `Eres el analista jefe de inteligencia deportiva de World Cup Predictor 2026. Tu especialidad es el análisis táctico-estadístico profesional del fútbol. Analiza este partido del Mundial 2026 y genera un informe completo en ESPAÑOL.

PARTIDO: ${ctx.homeTeam.name} vs ${ctx.awayTeam.name}
Fase: ${ctx.phase ?? 'Fase de grupos'} | Sede: ${ctx.venue}, ${ctx.city}
Clima: ${ctx.weather_condition ?? 'Despejado'}, ${ctx.weather_temp_celsius ?? 22}°C

EQUIPO LOCAL — ${ctx.homeTeam.name} (FIFA #${ctx.homeTeam.fifa_ranking} | ELO ${ctx.homeTeam.elo_rating}):
• xG/partido: ${ctx.homeStats?.avg_xg?.toFixed(2) ?? '—'} | xGA/partido: ${ctx.homeStats?.avg_xga?.toFixed(2) ?? '—'}
• Goles marcados/partido: ${ctx.homeStats?.avg_goals_scored?.toFixed(2) ?? '—'} | recibidos: ${ctx.homeStats?.avg_goals_conceded?.toFixed(2) ?? '—'}
• Córners/partido: ${ctx.homeStats?.avg_corners?.toFixed(1) ?? '—'}
• Forma reciente: ${homeFormStr || 'Sin datos suficientes'}
• Lesiones activas: ${homeInj}
• Días desde último partido: ${ctx.home_rest_days ?? '?'}
${homeGrpStr}
EQUIPO VISITANTE — ${ctx.awayTeam.name} (FIFA #${ctx.awayTeam.fifa_ranking} | ELO ${ctx.awayTeam.elo_rating}):
• xG/partido: ${ctx.awayStats?.avg_xg?.toFixed(2) ?? '—'} | xGA/partido: ${ctx.awayStats?.avg_xga?.toFixed(2) ?? '—'}
• Goles marcados/partido: ${ctx.awayStats?.avg_goals_scored?.toFixed(2) ?? '—'} | recibidos: ${ctx.awayStats?.avg_goals_conceded?.toFixed(2) ?? '—'}
• Córners/partido: ${ctx.awayStats?.avg_corners?.toFixed(1) ?? '—'}
• Forma reciente: ${awayFormStr || 'Sin datos suficientes'}
• Lesiones activas: ${awayInj}
• Días desde último partido: ${ctx.away_rest_days ?? '?'}
${awayGrpStr}

PREDICCIÓN DEL MODELO HÍBRIDO (xG + ELO + Forma + Mercado):
• Victoria ${ctx.homeTeam.name}: ${hw}% | Empate: ${dr}% | Victoria ${ctx.awayTeam.name}: ${aw}%
• Marcador más probable: ${ctx.prediction.predicted_home_score}-${ctx.prediction.predicted_away_score}
• Confianza del modelo: ${ctx.prediction.confidence_score?.toFixed(0) ?? 60}%

APUESTAS DETECTADAS (IDs exactos — úsalos en betExplanations):
${betsStr || '  (sin recomendaciones activas)'}

Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown, sin explicaciones fuera del JSON:
{
  "tactical": {
    "homeStyle": "Estilo de juego de ${ctx.homeTeam.name} basado en sus stats. 2 oraciones.",
    "awayStyle": "Estilo de juego de ${ctx.awayTeam.name} basado en sus stats. 2 oraciones.",
    "homeStrengths": "2-3 fortalezas concretas y específicas del local para este partido.",
    "awayStrengths": "2-3 fortalezas concretas y específicas del visitante para este partido.",
    "homeWeaknesses": "1-2 vulnerabilidades del local que el visitante puede aprovechar.",
    "awayWeaknesses": "1-2 vulnerabilidades del visitante que el local puede aprovechar.",
    "keyBattleground": "La zona del campo o el duelo clave que decidirá el partido. 1-2 oraciones.",
    "possessionEdge": "home|away|balanced",
    "possessionReason": "1 oración concisa sobre quién dominará la posesión y por qué.",
    "transitionEdge": "home|away|balanced",
    "transitionReason": "1 oración sobre quién tiene ventaja en transiciones.",
    "firstHalf": "Expectativa táctica del primer tiempo: ritmo, quién dominará, desarrollo probable.",
    "secondHalf": "Expectativa del segundo tiempo: ajustes, momento decisivo, cómo puede cerrarse."
  },
  "context": {
    "homeNeed": "Necesidad específica de ${ctx.homeTeam.name} en este partido del Mundial.",
    "awayNeed": "Necesidad específica de ${ctx.awayTeam.name} en este partido.",
    "intensityLevel": "Muy Alta|Alta|Media|Baja|Muy Baja",
    "intensityReason": "Por qué tiene esa intensidad competitiva. 1-2 oraciones.",
    "competitiveDescription": "Contexto general del partido en el torneo. 2-3 oraciones."
  },
  "betExplanations": {
${betKeys}
  },
  "risks": [
    "Riesgo #1 específico y basado en los datos del partido",
    "Riesgo #2 específico",
    "Riesgo #3 específico"
  ],
  "conclusion": "Párrafo final de 3-4 oraciones. Resume el análisis, señala la apuesta con mejor equilibrio probabilidad-valor, menciona el riesgo principal. Tono de analista profesional senior."
}`
}


// ─── Cache y rate limit en memoria ───────────────────────────────────────
// La ruta es pública y cada llamada a la API de Anthropic cuesta dinero.
// El análisis de un partido no cambia entre visitas, así que se cachea por
// matchId. El rate limit por IP evita que un script queme crédito: al
// superarlo se sirve el fallback estadístico (gratis) en vez de un 429,
// para que la UI siga funcionando.
const analysisCache = new Map<string, { data: MatchAnalysis; ts: number }>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas

const rateBuckets = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT = 5             // llamadas a la IA por IP…
const RATE_WINDOW_MS = 60_000    // …por minuto

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return false
  }
  bucket.count++
  return bucket.count > RATE_LIMIT
}

function pruneMaps() {
  const now = Date.now()
  if (analysisCache.size > 200) {
    for (const [k, v] of analysisCache) {
      if (now - v.ts > CACHE_TTL_MS) analysisCache.delete(k)
    }
  }
  if (rateBuckets.size > 2000) {
    for (const [k, v] of rateBuckets) {
      if (now - v.windowStart > RATE_WINDOW_MS) rateBuckets.delete(k)
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: { context: AnalysisContext } | null = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const ctx = body?.context
  if (!ctx) return NextResponse.json({ error: 'Missing context' }, { status: 400 })

  const { id: matchId } = await params
  pruneMaps()

  // 1. Cache: el análisis de un partido se reutiliza durante 6h
  const cached = analysisCache.get(matchId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(generateFallbackAnalysis(ctx))
  }

  // 2. Rate limit por IP: por encima del límite se sirve el fallback (sin costo)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(generateFallbackAnalysis(ctx))
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: buildPrompt(ctx) }],
    })

    const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json(generateFallbackAnalysis(ctx))

    const analysis: MatchAnalysis = JSON.parse(jsonMatch[0])
    analysisCache.set(matchId, { data: analysis, ts: Date.now() })
    return NextResponse.json(analysis)
  } catch (err: any) {
    console.error('[POST /api/analysis/match]', err?.message)
    return NextResponse.json(generateFallbackAnalysis(ctx))
  }
}
