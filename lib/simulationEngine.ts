import { Probabilities, computeModelPrediction, ModelInput, DEFAULT_WEIGHTS } from './predictionEngine';

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
  groupStageAdvanceProb: number;
  roundOf16Prob: number;
  quarterFinalProb: number;
  semiFinalProb: number;
  finalProb: number;
  winnerProb: number;
}

// Helper para simular un resultado de partido basado en probabilidades 1X2
function simulateMatchResult(probabilities: Probabilities): 'home_win' | 'draw' | 'away_win' {
  const rand = Math.random();
  if (rand < probabilities.home) {
    return 'home_win';
  } else if (rand < probabilities.home + probabilities.draw) {
    return 'draw';
  } else {
    return 'away_win';
  }
}

// Simula un partido y devuelve el ganador o si fue empate
function runMatch(match: Match, teamsMap: Map<string, Team>): { winnerId?: string; isDraw: boolean } {
  if (!match.home_team || !match.away_team) {
    // Si no hay equipos, no podemos simular. Podríamos lanzar un error o devolver un resultado por defecto.
    return { isDraw: true }; // Por simplicidad, asumimos empate si faltan datos
  }

  // Usar las probabilidades precalculadas o calcularlas si no existen
  let probabilities = match.probabilities;
  if (!probabilities) {
    // Esto es una simplificación. En un sistema real, se usaría el predictionEngine completo
    // con datos de forma, xG, etc. Aquí solo usamos ELO como base si no hay probabilidades.
    const homeTeam = teamsMap.get(match.home_team_id)!;
    const awayTeam = teamsMap.get(match.away_team_id)!;

    const modelInput: ModelInput = {
      homeElo: homeTeam.elo,
      awayElo: awayTeam.elo,
      homeForm: [], // Simplificado
      awayForm: [], // Simplificado
      homeXg: 1.5, // Simplificado
      awayXg: 1.5, // Simplificado
      homeGoals: 1, // Simplificado
      awayGoals: 1, // Simplificado
      homeInjuryImpact: 0, // Simplificado
      awayInjuryImpact: 0, // Simplificado
    };
    probabilities = computeModelPrediction(modelInput, DEFAULT_WEIGHTS);
  }

  const result = simulateMatchResult(probabilities);

  if (result === 'home_win') {
    return { winnerId: match.home_team_id, isDraw: false };
  } else if (result === 'away_win') {
    return { winnerId: match.away_team_id, isDraw: false };
  } else {
    return { isDraw: true };
  }
}

// Simula la fase de grupos para un grupo dado
function simulateGroupStage(groupMatches: Match[], teamsInGroup: Team[]): { advancingTeams: string[]; groupStandings: Map<string, { points: number; gd: number; gf: number }> } {
  const standings = new Map<string, { points: number; gd: number; gf: number }>();
  teamsInGroup.forEach(team => standings.set(team.id, { points: 0, gd: 0, gf: 0 }));

  for (const match of groupMatches) {
    const homeTeamId = match.home_team_id;
    const awayTeamId = match.away_team_id;

    // Simular el resultado usando las probabilidades del modelo (ELO+mercado)
    // si existen; si no, goles aleatorios como fallback.
    let homeGoals: number;
    let awayGoals: number;
    if (match.probabilities) {
      const outcome = simulateMatchResult(match.probabilities);
      if (outcome === 'home_win') {
        homeGoals = 1 + Math.floor(Math.random() * 2);
        awayGoals = Math.floor(Math.random() * homeGoals);
      } else if (outcome === 'away_win') {
        awayGoals = 1 + Math.floor(Math.random() * 2);
        homeGoals = Math.floor(Math.random() * awayGoals);
      } else {
        homeGoals = Math.floor(Math.random() * 3);
        awayGoals = homeGoals; // empate
      }
    } else {
      homeGoals = Math.floor(Math.random() * 4);
      awayGoals = Math.floor(Math.random() * 4);
    }

    const homeStandings = standings.get(homeTeamId)!;
    const awayStandings = standings.get(awayTeamId)!;

    homeStandings.gf += homeGoals;
    homeStandings.gd += (homeGoals - awayGoals);
    awayStandings.gf += awayGoals;
    awayStandings.gd += (awayGoals - homeGoals);

    if (homeGoals > awayGoals) {
      homeStandings.points += 3;
    } else if (awayGoals > homeGoals) {
      awayStandings.points += 3;
    } else {
      homeStandings.points += 1;
      awayStandings.points += 1;
    }
  }

  // Determinar equipos que avanzan (top 2 por puntos, GD, GF)
  const sortedStandings = Array.from(standings.entries()).sort(([, a], [, b]) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  return { advancingTeams: sortedStandings.slice(0, 2).map(([teamId]) => teamId), groupStandings: standings };
}

// Simula una fase de eliminación directa
function simulateKnockoutStage(matches: Match[], teamsMap: Map<string, Team>): string | undefined {
  let currentRoundWinners: string[] = [];
  for (const match of matches) {
    let result = runMatch(match, teamsMap);
    if (result.isDraw) {
      // En eliminatoria, si es empate, simular penaltis (aleatorio por ahora)
      result.winnerId = Math.random() < 0.5 ? match.home_team_id : match.away_team_id;
    }
    if (result.winnerId) {
      currentRoundWinners.push(result.winnerId);
    }
  }
  // Si solo queda un ganador, es el campeón de esta fase (o del torneo)
  return currentRoundWinners.length === 1 ? currentRoundWinners[0] : undefined;
}

export function runMonteCarloSimulation(
  allTeams: Team[],
  allMatches: Match[],
  numSimulations: number = 10000
): SimulationResult[] {
  const teamsMap = new Map<string, Team>(allTeams.map(team => [team.id, team]));
  const teamStats = new Map<string, { groupStageAdvance: number; roundOf16: number; quarterFinal: number; semiFinal: number; final: number; winner: number }>();
  allTeams.forEach(team => teamStats.set(team.id, { groupStageAdvance: 0, roundOf16: 0, quarterFinal: 0, semiFinal: 0, final: 0, winner: 0 }));

  for (let s = 0; s < numSimulations; s++) {
    const currentTeamsMap = new Map<string, Team>(allTeams.map(team => [team.id, { ...team }]));
    const currentMatches = allMatches.map(match => ({ ...match }));

    // Fase de Grupos
    const groups = new Map<string, Match[]>();
    currentMatches.filter(m => m.stage === 'group').forEach(m => {
      if (m.group_letter) {
        if (!groups.has(m.group_letter)) groups.set(m.group_letter, []);
        groups.get(m.group_letter)!.push(m);
      }
    });

    const knockoutTeams: { [round: string]: string[] } = {
      'round_of_16': [],
      'quarter_finals': [],
      'semi_finals': [],
      'final': [],
    };

    const groupWinners: { [group: string]: string } = {};
    const groupRunnersUp: { [group: string]: string } = {};

    for (const [groupLetter, matches] of groups.entries()) {
      const teamsInGroup = allTeams.filter(t => t.group === groupLetter);
      const { advancingTeams } = simulateGroupStage(matches, teamsInGroup);
      
      if (advancingTeams.length >= 2) {
        groupWinners[groupLetter] = advancingTeams[0];
        groupRunnersUp[groupLetter] = advancingTeams[1];
      }

      advancingTeams.forEach(teamId => {
        const stats = teamStats.get(teamId)!;
        stats.groupStageAdvance++;
        stats.roundOf16++; // Si avanzan de grupo, llegan a octavos
      });
    }

    // Llenar los partidos de octavos de final (simplificado: A1 vs B2, B1 vs A2, etc.)
    // Esto requiere un mapeo real de cómo se emparejan los grupos en el Mundial
    // Por ahora, una asignación simple para demostrar la lógica
    const r16Matches: Match[] = currentMatches.filter(m => m.stage === 'round_of_16');
    // Asignar equipos a los partidos de octavos de final basándose en groupWinners y groupRunnersUp
    // Esto es una simplificación y debería ser más robusto para un Mundial real
    // Ejemplo: r16Matches[0].home_team_id = groupWinners['A']; r16Matches[0].away_team_id = groupRunnersUp['B'];
    // Para esta demo, simplemente asumimos que los partidos de knockout ya tienen los IDs de equipo correctos

    // Simular Octavos de Final
    const r16Winners: string[] = [];
    for (const match of r16Matches) {
      const result = runMatch(match, currentTeamsMap);
      if (result.winnerId) r16Winners.push(result.winnerId);
    }
    r16Winners.forEach(teamId => teamStats.get(teamId)!.quarterFinal++);

    // Simular Cuartos de Final (simplificado)
    const qfMatches: Match[] = currentMatches.filter(m => m.stage === 'quarter_finals');
    const qfWinners: string[] = [];
    for (const match of qfMatches) {
      const result = runMatch(match, currentTeamsMap);
      if (result.winnerId) qfWinners.push(result.winnerId);
    }
    qfWinners.forEach(teamId => teamStats.get(teamId)!.semiFinal++);

    // Simular Semifinales (simplificado)
    const sfMatches: Match[] = currentMatches.filter(m => m.stage === 'semi_finals');
    const sfWinners: string[] = [];
    for (const match of sfMatches) {
      const result = runMatch(match, currentTeamsMap);
      if (result.winnerId) sfWinners.push(result.winnerId);
    }
    sfWinners.forEach(teamId => teamStats.get(teamId)!.final++);

    // Simular Final (simplificado)
    const finalMatch: Match | undefined = currentMatches.find(m => m.stage === 'final');
    if (finalMatch) {
      const finalWinner = simulateKnockoutStage([finalMatch], currentTeamsMap);
      if (finalWinner) {
        teamStats.get(finalWinner)!.winner++;
        // Los finalistas también llegan a la final
        teamStats.get(finalMatch.home_team_id)!.final++;
        teamStats.get(finalMatch.away_team_id)!.final++;
      }
    }
  }

  // Consolidar resultados
  return Array.from(teamStats.entries()).map(([teamId, stats]) => ({
    teamId,
    groupStageAdvanceProb: stats.groupStageAdvance / numSimulations,
    roundOf16Prob: stats.roundOf16 / numSimulations,
    quarterFinalProb: stats.quarterFinal / numSimulations,
    semiFinalProb: stats.semiFinal / numSimulations,
    finalProb: stats.final / numSimulations,
    winnerProb: stats.winner / numSimulations,
  }));
}
