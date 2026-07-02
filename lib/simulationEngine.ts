import { Probabilities, computeModelPrediction, computeKnockoutAdvance, ModelInput } from './predictionEngine';

export interface Team {
  id: string;
  name: string;
  code: string;
  elo: number;
  group?: string;
}

export interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team?: Team;
  away_team?: Team;
  match_date: string;
  stage: 'group' | 'round_of_16' | 'quarter_finals' | 'semi_finals' | 'final';
  group_letter?: string;
  home_score?: number;
  away_score?: number;
  probabilities?: Probabilities;
}

export interface SimulationResult {
  teamId: string;
  groupStageAdvanceProb: number; // Probabilidad de clasificar a la fase final (top 32)
  roundOf16Prob: number;         // Probabilidad de llegar a octavos (ganar dieciseisavos)
  quarterFinalProb: number;      // Probabilidad de llegar a cuartos
  semiFinalProb: number;         // Probabilidad de llegar a semis
  finalProb: number;             // Probabilidad de llegar a la final
  winnerProb: number;            // Probabilidad de ser campeón
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de simulación de un partido
// ─────────────────────────────────────────────────────────────────────────

// Probabilidades de un cruce a partir del ELO (para partidos que no tienen
// predicción precalculada, p. ej. los cruces de eliminatorias que se arman
// dinámicamente). En eliminatoria no hay localía: campo neutral.
function knockoutProbabilities(home: Team, away: Team): Probabilities {
  const input: ModelInput = {
    homeElo: home.elo,
    awayElo: away.elo,
    homeForm: [],
    awayForm: [],
    homeXg: 1.5,
    awayXg: 1.5,
    homeXga: 1.2,
    awayXga: 1.2,
    homeInjuryImpact: 0,
    awayInjuryImpact: 0,
    isKnockout: true,
  };
  return computeModelPrediction(input);
}

// Resuelve un cruce de eliminatoria (sin empate posible) y devuelve el id
// del equipo que avanza. Usa computeKnockoutAdvance: el empate de 90' se
// reparte entre prórroga (ventaja ELO amortiguada) y penales (50/50).
function playKnockout(home: Team, away: Team): string {
  const probs = knockoutProbabilities(home, away);
  const advance = computeKnockoutAdvance(probs, home.elo, away.elo);
  return Math.random() < advance.home ? home.id : away.id;
}

interface Standing {
  teamId: string;
  points: number;
  gd: number;
  gf: number;
  position: number; // 1, 2, 3, 4 dentro del grupo
}

// Simula la fase de grupos de un grupo y devuelve los standings ordenados.
function simulateGroupStage(groupMatches: Match[], teamsInGroup: Team[]): Standing[] {
  const table = new Map<string, { points: number; gd: number; gf: number }>();
  teamsInGroup.forEach((team) => table.set(team.id, { points: 0, gd: 0, gf: 0 }));

  for (const match of groupMatches) {
    const home = table.get(match.home_team_id);
    const away = table.get(match.away_team_id);
    if (!home || !away) continue;

    // Marcador simulado: si hay probabilidades del modelo (ELO+mercado) las usamos;
    // si no, goles aleatorios como fallback.
    let homeGoals: number;
    let awayGoals: number;
    if (match.probabilities) {
      const rand = Math.random();
      const p = match.probabilities;
      if (rand < p.home) {
        homeGoals = 1 + Math.floor(Math.random() * 2);
        awayGoals = Math.floor(Math.random() * homeGoals);
      } else if (rand < p.home + p.draw) {
        homeGoals = Math.floor(Math.random() * 3);
        awayGoals = homeGoals; // empate
      } else {
        awayGoals = 1 + Math.floor(Math.random() * 2);
        homeGoals = Math.floor(Math.random() * awayGoals);
      }
    } else {
      homeGoals = Math.floor(Math.random() * 4);
      awayGoals = Math.floor(Math.random() * 4);
    }

    home.gf += homeGoals;
    home.gd += homeGoals - awayGoals;
    away.gf += awayGoals;
    away.gd += awayGoals - homeGoals;

    if (homeGoals > awayGoals) home.points += 3;
    else if (awayGoals > homeGoals) away.points += 3;
    else {
      home.points += 1;
      away.points += 1;
    }
  }

  const sorted = Array.from(table.entries())
    .map(([teamId, s]) => ({ teamId, ...s }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

  return sorted.map((s, i) => ({ ...s, position: i + 1 }));
}

// ─────────────────────────────────────────────────────────────────────────
// Bracket de eliminatorias (32 equipos)
// ─────────────────────────────────────────────────────────────────────────

// Orden de siembra estándar de un bracket de n equipos (potencia de 2).
// Devuelve las "semillas" (1 = mejor) en el orden de las posiciones del bracket,
// de modo que las dos mejores semillas solo puedan cruzarse en la final.
function seedBracketOrder(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const sum = order.length * 2 + 1;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed);
      next.push(sum - seed);
    }
    order = next;
  }
  return order;
}

// Métrica de siembra de un clasificado: prioriza la posición de grupo
// (1º > 2º > 3º), luego puntos, diferencia y goles a favor; ELO como desempate.
function seedScore(standing: Standing, elo: number): number {
  return (4 - standing.position) * 1_000_000 + standing.points * 10_000 + standing.gd * 100 + standing.gf + elo / 10_000;
}

// ─────────────────────────────────────────────────────────────────────────
// Monte Carlo
// ─────────────────────────────────────────────────────────────────────────

export function runMonteCarloSimulation(
  allTeams: Team[],
  allMatches: Match[],
  numSimulations: number = 10000
): SimulationResult[] {
  const teamsMap = new Map<string, Team>(allTeams.map((t) => [t.id, t]));

  const stats = new Map<
    string,
    { advance: number; r16: number; qf: number; sf: number; final: number; winner: number }
  >();
  allTeams.forEach((t) => stats.set(t.id, { advance: 0, r16: 0, qf: 0, sf: 0, final: 0, winner: 0 }));

  // Agrupar partidos de fase de grupos por letra (una sola vez).
  const groupMatches = new Map<string, Match[]>();
  allMatches
    .filter((m) => m.stage === 'group' && m.group_letter)
    .forEach((m) => {
      const g = m.group_letter!;
      if (!groupMatches.has(g)) groupMatches.set(g, []);
      groupMatches.get(g)!.push(m);
    });

  // Equipos por grupo (estable entre simulaciones).
  const teamsByGroup = new Map<string, Team[]>();
  allTeams.forEach((t) => {
    if (!t.group) return;
    if (!teamsByGroup.has(t.group)) teamsByGroup.set(t.group, []);
    teamsByGroup.get(t.group)!.push(t);
  });

  const numKnockout = 32; // Mundial de 48: top 2 de cada grupo + 8 mejores terceros
  const bracketOrder = seedBracketOrder(numKnockout);

  for (let s = 0; s < numSimulations; s++) {
    const winners: Standing[] = [];
    const runnersUp: Standing[] = [];
    const thirds: Standing[] = [];

    for (const [groupLetter, matches] of groupMatches.entries()) {
      const teamsInGroup = teamsByGroup.get(groupLetter) ?? [];
      const table = simulateGroupStage(matches, teamsInGroup);
      if (table[0]) winners.push(table[0]);
      if (table[1]) runnersUp.push(table[1]);
      if (table[2]) thirds.push(table[2]);
    }

    // 8 mejores terceros
    const bestThirds = thirds
      .slice()
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      })
      .slice(0, 8);

    const qualified = [...winners, ...runnersUp, ...bestThirds];
    if (qualified.length < numKnockout) {
      // Datos incompletos (no están cargados los 12 grupos): solo contamos avance.
      qualified.forEach((q) => stats.get(q.teamId)!.advance++);
      continue;
    }

    // Todos los clasificados avanzan de la fase de grupos.
    qualified.forEach((q) => stats.get(q.teamId)!.advance++);

    // Sembrar los 32 por fuerza demostrada en grupos.
    const seeded = qualified
      .map((q) => ({ standing: q, score: seedScore(q, teamsMap.get(q.teamId)?.elo ?? 1500) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.standing.teamId); // índice 0 = semilla 1 (mejor)

    // Colocar en el bracket según el orden de siembra estándar.
    let round: string[] = bracketOrder.map((seed) => seeded[seed - 1]);

    // Dieciseisavos (32 -> 16): los ganadores LLEGAN A OCTAVOS.
    round = playRound(round, teamsMap);
    round.forEach((id) => stats.get(id)!.r16++);

    // Octavos (16 -> 8): ganadores llegan a cuartos.
    round = playRound(round, teamsMap);
    round.forEach((id) => stats.get(id)!.qf++);

    // Cuartos (8 -> 4): ganadores llegan a semis.
    round = playRound(round, teamsMap);
    round.forEach((id) => stats.get(id)!.sf++);

    // Semis (4 -> 2): ganadores llegan a la final.
    round = playRound(round, teamsMap);
    round.forEach((id) => stats.get(id)!.final++);

    // Final (2 -> 1): el ganador es campeón.
    round = playRound(round, teamsMap);
    if (round[0]) stats.get(round[0])!.winner++;
  }

  return Array.from(stats.entries()).map(([teamId, s]) => ({
    teamId,
    groupStageAdvanceProb: s.advance / numSimulations,
    roundOf16Prob: s.r16 / numSimulations,
    quarterFinalProb: s.qf / numSimulations,
    semiFinalProb: s.sf / numSimulations,
    finalProb: s.final / numSimulations,
    winnerProb: s.winner / numSimulations,
  }));
}

// Juega una ronda de eliminatoria: empareja posiciones consecutivas del bracket
// y devuelve los ids ganadores (la mitad de equipos), conservando el orden para
// la siguiente ronda.
function playRound(teamIds: string[], teamsMap: Map<string, Team>): string[] {
  const winners: string[] = [];
  for (let i = 0; i < teamIds.length; i += 2) {
    const home = teamsMap.get(teamIds[i]);
    const away = teamsMap.get(teamIds[i + 1]);
    if (!home || !away) {
      winners.push(teamIds[i] ?? teamIds[i + 1]);
      continue;
    }
    winners.push(playKnockout(home, away));
  }
  return winners;
}
