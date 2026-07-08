/**
 * Veredicto post-partido para baloncesto (NBA) — capa determinista.
 *
 * Equivalente a lib/verdictEngine pero en lenguaje de puntos/cuartos, sin
 * empates. Los hechos salen de datos reales (marcador, cuartos, pick
 * moneyline); la redacción con IA (opcional) los pule sin cambiarlos.
 * Módulo puro — ver tests/nbaVerdict.test.ts.
 */
import type { VerdictOutput } from './verdictEngine'

export interface NbaVerdictInput {
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  competitionName: string
  /** { home:[q1..q4,ot?], away:[...] } */
  periodScores: { home: number[]; away: number[] } | null
  prediction: { home: number; away: number; predictedHome: number; predictedAway: number } | null
}

const r1 = (v: number) => Math.round(v * 10) / 10

export function buildNbaVerdict(i: NbaVerdictInput): VerdictOutput {
  const home = i.homeScore
  const away = i.awayScore
  const winner = home > away ? i.homeName : i.awayName
  const loser = home > away ? i.awayName : i.homeName
  const wScore = Math.max(home, away)
  const lScore = Math.min(home, away)
  const margin = Math.abs(home - away)
  const total = home + away

  // ── Resumen ────────────────────────────────────────────────
  let summary = `${winner} venció a ${loser} ${wScore}-${lScore} en ${i.competitionName}.`
  if (margin >= 20) summary += ' Una paliza sin matices.'
  else if (margin <= 3) summary += ' Un final de infarto, decidido en los últimos minutos.'
  else if (total >= 240) summary += ' Duelo de máxima anotación, con las defensas desbordadas.'
  else if (total <= 200) summary += ' Partido trabado y de bajo tanteo.'

  // ── Factores ───────────────────────────────────────────────
  const factors: { title: string; text: string }[] = []
  const ps = i.periodScores
  if (ps && ps.home.length >= 4 && ps.away.length >= 4) {
    // Cuarto de mayor diferencial
    let bestQ = 0, bestDiff = -Infinity, bestSide = ''
    for (let q = 0; q < Math.min(ps.home.length, ps.away.length); q++) {
      const d = ps.home[q] - ps.away[q]
      if (Math.abs(d) > Math.abs(bestDiff)) { bestDiff = d; bestQ = q; bestSide = d > 0 ? i.homeName : i.awayName }
    }
    const qName = bestQ < 4 ? `${bestQ + 1}º cuarto` : 'la prórroga'
    if (Math.abs(bestDiff) >= 8)
      factors.push({ title: 'Cuarto decisivo', text: `${bestSide} rompió el partido en el ${qName} (${ps.home[bestQ]}-${ps.away[bestQ]}, +${Math.abs(bestDiff)}).` })

    // Remontada: quién iba al medio tiempo
    const htHome = ps.home[0] + ps.home[1]
    const htAway = ps.away[0] + ps.away[1]
    const htLeader = htHome > htAway ? 'home' : htHome < htAway ? 'away' : 'tie'
    const finalLeader = home > away ? 'home' : 'away'
    if (htLeader !== 'tie' && htLeader !== finalLeader)
      factors.push({ title: 'Remontada', text: `Al descanso ganaba ${htLeader === 'home' ? i.homeName : i.awayName} (${htHome}-${htAway}); ${winner} dio la vuelta en la segunda mitad.` })

    if (ps.home.length > 4 || ps.away.length > 4)
      factors.push({ title: 'Prórroga', text: 'El partido necesitó tiempo extra para resolverse.' })
  }

  if (margin >= 15)
    factors.push({ title: 'Control', text: `${winner} manejó una ventaja cómoda de ${margin} puntos.` })
  else if (margin <= 5)
    factors.push({ title: 'Partido cerrado', text: `Se decidió por apenas ${margin} ${margin === 1 ? 'punto' : 'puntos'}.` })

  if (factors.length === 0)
    factors.push({ title: 'Ritmo', text: `Marcador de ${total} puntos combinados — un partido de intensidad ${total >= 225 ? 'alta' : 'media'}.` })

  // ── Predicción vs realidad (moneyline) ─────────────────────
  let prediction_review: string
  let model_lesson: string
  if (i.prediction) {
    const p = i.prediction
    const pick: 'home' | 'away' = p.home >= p.away ? 'home' : 'away'
    const actual: 'home' | 'away' = home > away ? 'home' : 'away'
    const correct = pick === actual
    const pickName = pick === 'home' ? i.homeName : i.awayName
    const pPick = Math.round(Math.max(p.home, p.away) * 100)
    const predMargin = p.predictedHome - p.predictedAway
    const realMargin = home - away

    prediction_review = correct
      ? `El motor daba ganador a ${pickName} (${pPick}%) y acertó. Margen estimado ${predMargin > 0 ? '+' : ''}${predMargin}, real ${realMargin > 0 ? '+' : ''}${realMargin} (marcador estimado ${p.predictedHome}-${p.predictedAway}).`
      : `El motor daba ganador a ${pickName} (${pPick}%) y falló: ganó ${winner}.`

    if (correct && pPick >= 65) model_lesson = 'Acierto con señal fuerte: la ventaja de ELO se confirmó en la cancha. Refuerza los pesos del modelo.'
    else if (correct) model_lesson = `Acierto ajustado (pick al ${pPick}%): partido parejo que cayó del lado del modelo. Se registra sin sobreajustar.`
    else if (pPick >= 65) model_lesson = 'Fallo con señal fuerte: sorpresa genuina. Un caso aislado no invalida la señal, pero entra a la recalibración.'
    else model_lesson = `Fallo en zona gris (pick al ${pPick}%): el resultado era plausible para el modelo. Alimenta el ajuste fino del ELO y la ventaja de local.`
  } else {
    prediction_review = 'Este partido no tuvo predicción publicada del motor.'
    model_lesson = 'Sin pick que evaluar: el partido aporta datos de ELO y anotación para las siguientes predicciones.'
  }

  return { summary, factors: factors.slice(0, 4), prediction_review, model_lesson }
}
