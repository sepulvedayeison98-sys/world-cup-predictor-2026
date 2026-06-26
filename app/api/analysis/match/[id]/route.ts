import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export interface AnalysisContext {
  matchId: string
  homeTeam: { name: string; code: string; fifa_ranking: number; elo_rating: number }
  awayTeam: { name: string; code: string; fifa_ranking: number; elo_rating: number }
  phase: string
  venue: string
  city: string
  weather_condition: string
  weather_temp_celsius: number
  home_rest_days: number
  away_rest_days: number
  homeStats: { avg_xg?: number; avg_xga?: number; avg_goals_scored?: number; avg_goals_conceded?: number; avg_corners?: number; avg_shots?: number }
  awayStats: { avg_xg?: number; avg_xga?: number; avg_goals_scored?: number; avg_goals_conceded?: number; avg_corners?: number; avg_shots?: number }
  homeForm: { result: string; goals_scored: number; goals_conceded: number; opponent_name: string; xg?: number | null }[]
  awayForm: { result: string; goals_scored: number; goals_conceded: number; opponent_name: string; xg?: number | null }[]
  homeInjuries: { name: string; position: string; impact: number }[]
  awayInjuries: { name: string; position: string; impact: number }[]
  prediction: {
    home_win_probability: number
    draw_probability: number
    away_win_probability: number
    predicted_home_score: number
    predicted_away_score: number
    confidence_score: number
  }
  bets: { id: string; label: string; confidence: number; tier: string }[]
}

export interface MatchAnalysis {
  tactical: {
    homeStyle: string
    awayStyle: string
    homeStrengths: string
    awayStrengths: string
    homeWeaknesses: string
    awayWeaknesses: string
    keyBattleground: string
    possessionEdge: 'home' | 'away' | 'balanced'
    possessionReason: string
    transitionEdge: 'home' | 'away' | 'balanced'
    transitionReason: string
    firstHalf: string
    secondHalf: string
  }
  context: {
    homeNeed: string
    awayNeed: string
    intensityLevel: 'Muy Alta' | 'Alta' | 'Media' | 'Baja' | 'Muy Baja'
    intensityReason: string
    competitiveDescription: string
  }
  betExplanations: Record<string, string>
  risks: string[]
  conclusion: string
  is_fallback?: boolean
}

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

EQUIPO VISITANTE — ${ctx.awayTeam.name} (FIFA #${ctx.awayTeam.fifa_ranking} | ELO ${ctx.awayTeam.elo_rating}):
• xG/partido: ${ctx.awayStats?.avg_xg?.toFixed(2) ?? '—'} | xGA/partido: ${ctx.awayStats?.avg_xga?.toFixed(2) ?? '—'}
• Goles marcados/partido: ${ctx.awayStats?.avg_goals_scored?.toFixed(2) ?? '—'} | recibidos: ${ctx.awayStats?.avg_goals_conceded?.toFixed(2) ?? '—'}
• Córners/partido: ${ctx.awayStats?.avg_corners?.toFixed(1) ?? '—'}
• Forma reciente: ${awayFormStr || 'Sin datos suficientes'}
• Lesiones activas: ${awayInj}
• Días desde último partido: ${ctx.away_rest_days ?? '?'}

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

function generateFallbackAnalysis(ctx: Partial<AnalysisContext>): MatchAnalysis {
  const home = ctx.homeTeam?.name ?? 'Local'
  const away = ctx.awayTeam?.name ?? 'Visitante'
  const hw = Math.round((ctx.prediction?.home_win_probability ?? 0.40) * 100)
  const aw = Math.round((ctx.prediction?.away_win_probability ?? 0.30) * 100)
  const hXg = ctx.homeStats?.avg_xg ?? 1.2
  const aXg = ctx.awayStats?.avg_xg ?? 1.0
  const hXga = ctx.homeStats?.avg_xga ?? 1.1
  const aXga = ctx.awayStats?.avg_xga ?? 1.2
  const favor = hw > aw ? home : aw > hw ? away : 'ninguno'
  const bets = ctx.bets ?? []

  return {
    tactical: {
      homeStyle: `${home} despliega un juego de presión alta y ataque directo, sustentado en una producción ofensiva de ${hXg.toFixed(1)} xG por partido. Su estilo privilegia el control de zonas centrales y la transición rápida tras recuperar el balón.`,
      awayStyle: `${away} apuesta por una estructura defensiva compacta concediendo solo ${aXga.toFixed(1)} xG por partido, buscando hacer daño en espacios mediante el contraataque y la pelota parada.`,
      homeStrengths: `Potencia ofensiva con ${hXg.toFixed(1)} xG por partido, ventaja del ELO rating (${ctx.homeTeam?.elo_rating ?? '—'}) y presión de jugar como favorito estadístico. Solidez en el mediocampo.`,
      awayStrengths: `Disciplina táctica defensiva, capacidad de absorber presión y eficiencia en contraataques. La experiencia en partidos de alta tensión puede ser determinante.`,
      homeWeaknesses: `Con ${hXga.toFixed(1)} xGA por partido, el local puede ser vulnerable al contragolpe si el visitante cierra bien los espacios y aprovecha la profundidad.`,
      awayWeaknesses: `La producción ofensiva limitada de ${aXg.toFixed(1)} xG por partido puede ser insuficiente si el local establece dominio posesional desde el inicio.`,
      keyBattleground: `El mediocampo será el campo de batalla principal. Quien controle las segundas jugadas y limite las transiciones del rival definirá el ritmo y las oportunidades de gol.`,
      possessionEdge: hw > aw + 10 ? 'home' : aw > hw + 10 ? 'away' : 'balanced',
      possessionReason: `${hw > aw ? home : away} tiene ventaja estadística en posesión basada en el diferencial ELO y su estilo de juego dominante.`,
      transitionEdge: 'balanced',
      transitionReason: `Ambos equipos presentan capacidades similares en transición, con el visitante favoreciendo el contragolpe y el local la presión inmediata.`,
      firstHalf: `Se espera un inicio cauteloso mientras los equipos se estudian. El local intentará establecer el control posesional desde el minuto 1, mientras el visitante buscará aguantar bien estructurado y aprovechar los contragolpes.`,
      secondHalf: `El segundo tiempo podría abrirse con más espacios y riesgos. La fatiga y la presión del marcador provocarán ajustes tácticos significativos, con mayor intensidad en los últimos 20 minutos.`,
    },
    context: {
      homeNeed: `${home} necesita los tres puntos para consolidar su posición en el grupo y mantener vivas sus aspiraciones de clasificación al siguiente ronda.`,
      awayNeed: `${away} busca un resultado positivo —mínimo un punto— que le permita mantener opciones en la fase de grupos del Mundial 2026.`,
      intensityLevel: hw > 65 || aw > 65 ? 'Alta' : 'Media',
      intensityReason: `La diferencia entre los equipos y el momento del torneo generan una intensidad competitiva elevada, donde un resultado negativo puede comprometer seriamente la clasificación.`,
      competitiveDescription: `Este encuentro se enmarca en una fase de grupos donde cada punto tiene peso crítico. El marcador final definirá posiblemente las opciones de clasificación de uno o ambos equipos al siguiente ronda del Mundial 2026, elevando la presión y la intensidad del partido.`,
    },
    betExplanations: Object.fromEntries(
      bets.map(b => [
        b.id,
        `El modelo asigna ${b.confidence}% de probabilidad a esta apuesta basándose en el análisis conjunto de xG, ELO rating, forma reciente y diferencial estadístico entre ${home} y ${away}. Los datos del torneo respaldan esta evaluación con un nivel de confianza ${b.tier}.`,
      ])
    ),
    risks: [
      `Posibles rotaciones o cambios de alineación no reflejados en los datos estadísticos actuales podrían alterar las proyecciones del modelo.`,
      `La presión psicológica de un partido de Mundial puede generar variaciones de rendimiento difíciles de cuantificar estadísticamente.`,
      `Factores externos como el clima, el estado del terreno de juego o las decisiones arbitrales pueden influir significativamente en el resultado final.`,
    ],
    conclusion: `El análisis del modelo posiciona a ${favor !== 'ninguno' ? favor : `ambos equipos de forma equilibrada`} como favorito con ${Math.max(hw, aw)}% de probabilidad. La apuesta con mejor equilibrio entre probabilidad y valor esperado es "${bets[0]?.label ?? 'la principal recomendación del motor'}", respaldada por los datos xG y el diferencial ELO acumulado en el torneo. El principal factor de riesgo es la imprevisibilidad inherente a los partidos eliminatorios del Mundial, donde la presión puede distorsionar los patrones estadísticos habituales. Se recomienda un enfoque de gestión de riesgo conservador.`,
    is_fallback: true,
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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
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
    return NextResponse.json(analysis)
  } catch (err: any) {
    console.error('[POST /api/analysis/match]', err?.message)
    return NextResponse.json(generateFallbackAnalysis(ctx))
  }
}
