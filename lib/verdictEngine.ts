/**
 * Veredicto post-partido — capa determinista (Fase P3 del detalle universal).
 *
 * Genera el análisis base SIEMPRE a partir de datos reales: qué ocurrió,
 * qué factores pesaron, cómo le fue a la predicción y qué registra el
 * modelo. La capa de redacción con IA (services/verdict.ts) puede pulir
 * la prosa, pero los hechos salen de aquí — sin inventar nada.
 *
 * Módulo puro sin I/O — ver tests/verdict.test.ts.
 */

export interface VerdictEvent {
  type: string // goal · own_goal · penalty_goal · missed_penalty · yellow_card · red_card · substitution · var
  minute: number | null
  side: 'home' | 'away' | null
  player: string | null
}

export interface VerdictInput {
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  htHome?: number | null
  htAway?: number | null
  competitionName: string
  prediction: {
    home: number
    draw: number
    away: number
    predictedHome: number
    predictedAway: number
  } | null
  homeXg?: number | null
  awayXg?: number | null
  events: VerdictEvent[]
}

export interface VerdictOutput {
  summary: string
  factors: { title: string; text: string }[]
  prediction_review: string
  model_lesson: string
}

type Outcome = 'home' | 'draw' | 'away'

const r1 = (v: number) => Math.round(v * 10) / 10

export function buildDeterministicVerdict(i: VerdictInput): VerdictOutput {
  const actual: Outcome = i.homeScore > i.awayScore ? 'home' : i.homeScore < i.awayScore ? 'away' : 'draw'
  const winner = actual === 'home' ? i.homeName : actual === 'away' ? i.awayName : null
  const margin = Math.abs(i.homeScore - i.awayScore)
  const totalGoals = i.homeScore + i.awayScore

  const goals = i.events.filter((e) => ['goal', 'penalty_goal', 'own_goal'].includes(e.type) && e.minute != null)
  const reds = i.events.filter((e) => e.type === 'red_card')
  const lateGoal = goals.find((e) => (e.minute ?? 0) >= 85)
  const earlyGoal = goals.find((e) => (e.minute ?? 99) <= 10)

  // ── Resumen ────────────────────────────────────────────────
  const scoreline = `${i.homeScore}-${i.awayScore}`
  let summary = winner
    ? `${winner} se llevó el partido ${scoreline} ante ${winner === i.homeName ? i.awayName : i.homeName} en ${i.competitionName}.`
    : `${i.homeName} y ${i.awayName} empataron ${scoreline} en ${i.competitionName}.`
  if (margin >= 3) summary += ' Fue una goleada sin discusión.'
  else if (totalGoals === 0) summary += ' Un duelo cerrado donde las defensas dominaron de principio a fin.'
  else if (lateGoal) summary += ` El marcador se definió sobre el final (gol al ${lateGoal.minute}'${lateGoal.player ? ` de ${lateGoal.player}` : ''}).`
  else if (earlyGoal) summary += ` El gol tempranero (${earlyGoal.minute}'${earlyGoal.player ? ` de ${earlyGoal.player}` : ''}) marcó el guion del partido.`

  // ── Factores ───────────────────────────────────────────────
  const factors: { title: string; text: string }[] = []

  // Remontada respecto al medio tiempo
  if (i.htHome != null && i.htAway != null) {
    const htOutcome: Outcome = i.htHome > i.htAway ? 'home' : i.htHome < i.htAway ? 'away' : 'draw'
    if (htOutcome !== actual && htOutcome !== 'draw' && actual !== 'draw') {
      const comebackTeam = actual === 'home' ? i.homeName : i.awayName
      factors.push({
        title: 'Remontada',
        text: `Al descanso iba ${i.htHome}-${i.htAway} y ${comebackTeam} dio la vuelta al partido en el segundo tiempo.`,
      })
    }
  }

  // Expulsiones
  for (const red of reds.slice(0, 2)) {
    const team = red.side === 'home' ? i.homeName : red.side === 'away' ? i.awayName : 'uno de los equipos'
    factors.push({
      title: 'Expulsión',
      text: `${team} jugó en inferioridad desde el ${red.minute ?? '?'}'${red.player ? ` (roja a ${red.player})` : ''} — un cambio estructural del partido.`,
    })
  }

  // Eficacia vs xG (solo con datos oficiales)
  if (i.homeXg != null && i.awayXg != null && (i.homeXg > 0 || i.awayXg > 0)) {
    const homeDelta = i.homeScore - i.homeXg
    const awayDelta = i.awayScore - i.awayXg
    if (homeDelta >= 1)
      factors.push({ title: 'Eficacia local', text: `${i.homeName} convirtió ${i.homeScore} con ${r1(i.homeXg)} xG: definición muy por encima de lo esperado.` })
    else if (homeDelta <= -1)
      factors.push({ title: 'Falta de puntería local', text: `${i.homeName} generó ${r1(i.homeXg)} xG pero solo marcó ${i.homeScore}: le faltó definición.` })
    if (awayDelta >= 1)
      factors.push({ title: 'Eficacia visitante', text: `${i.awayName} convirtió ${i.awayScore} con ${r1(i.awayXg)} xG: aprovechó casi todo lo que generó.` })
    else if (awayDelta <= -1)
      factors.push({ title: 'Falta de puntería visitante', text: `${i.awayName} generó ${r1(i.awayXg)} xG pero solo marcó ${i.awayScore}.` })

    const xgDiff = i.homeXg - i.awayXg
    if (Math.abs(xgDiff) >= 1 && factors.length < 4) {
      const dominant = xgDiff > 0 ? i.homeName : i.awayName
      factors.push({ title: 'Dominio territorial', text: `${dominant} dominó la creación de peligro (${r1(i.homeXg)} vs ${r1(i.awayXg)} xG).` })
    }
  }

  if (factors.length === 0) {
    factors.push(
      totalGoals === 0
        ? { title: 'Equilibrio', text: 'Ninguno de los dos generó ventajas claras: partido de pocas ocasiones y mucho control.' }
        : { title: 'Partido parejo', text: `El ${scoreline} refleja un duelo sin un dominador claro en los datos disponibles.` },
    )
  }

  // ── Predicción vs realidad ─────────────────────────────────
  let prediction_review: string
  let model_lesson: string
  if (i.prediction) {
    const p = i.prediction
    const pick: Outcome = p.home >= p.draw && p.home >= p.away ? 'home' : p.away >= p.draw ? 'away' : 'draw'
    const correct = pick === actual
    const pickLabel = pick === 'home' ? `victoria de ${i.homeName}` : pick === 'away' ? `victoria de ${i.awayName}` : 'empate'
    const pActual = Math.round((actual === 'home' ? p.home : actual === 'draw' ? p.draw : p.away) * 100)
    const pPick = Math.round(Math.max(p.home, p.draw, p.away) * 100)
    const exactHit = p.predictedHome === i.homeScore && p.predictedAway === i.awayScore

    prediction_review = correct
      ? `El motor eligió ${pickLabel} con ${pPick}% y acertó el resultado 1X2${exactHit ? ` — e incluso el marcador exacto (${p.predictedHome}-${p.predictedAway})` : ` (marcador estimado ${p.predictedHome}-${p.predictedAway}, real ${scoreline})`}.`
      : `El motor eligió ${pickLabel} (${pPick}%) y falló: al resultado real le asignaba ${pActual}%.`

    if (correct && pPick >= 55) model_lesson = 'Acierto con señal fuerte: la ventaja de ELO y forma se confirmó en la cancha. El caso refuerza los pesos actuales del modelo.'
    else if (correct) model_lesson = `Acierto en un partido abierto (pick al ${pPick}%): el margen era fino y esta vez cayó del lado del modelo. Se registra sin sobreajustar.`
    else if (pActual <= 20) model_lesson = `Resultado de baja probabilidad (${pActual}%): en fútbol ~1 de cada 4 partidos termina así. El dato entra a la recalibración, pero un evento improbable aislado no invalida la señal.`
    else model_lesson = `Fallo en zona gris: el resultado real tenía ${pActual}% — el modelo lo consideraba plausible. Estos casos alimentan el ajuste fino de los pesos de forma y localía.`
  } else {
    prediction_review = 'Este partido no tuvo predicción publicada del motor (anterior a su cobertura o en calentamiento del modelo).'
    model_lesson = 'Sin pick que evaluar: el partido aporta datos de forma y ELO para las siguientes predicciones.'
  }

  return { summary, factors: factors.slice(0, 4), prediction_review, model_lesson }
}
