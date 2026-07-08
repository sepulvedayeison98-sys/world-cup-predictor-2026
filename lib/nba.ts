/**
 * Constantes de la NBA (Fase multideporte).
 *
 * Las 30 franquicias con su código, conferencia y división son datos
 * estables y conocidos — no dependen de la API. El ingest mapea cada
 * equipo de API-Basketball a esta tabla por su apodo (nickname), lo que
 * también filtra automáticamente equipos que no son franquicias
 * (All-Star, selecciones de exhibición, etc.).
 */

export const NBA_COMPETITION_ID = '12000000-0000-4000-8000-000000000012'
export const NBA_API_LEAGUE_ID = 12
export const NBA_API_SEASON = '2024-2025'
export const NBA_MODEL_VERSION = 'nba-1.0'

export type Conference = 'Este' | 'Oeste'

export interface NbaFranchise {
  /** token en minúsculas que debe aparecer en el nombre de la API */
  nickname: string
  code: string
  name: string
  conference: Conference
  division: string
}

export const NBA_FRANCHISES: NbaFranchise[] = [
  // ── Conferencia Este ──
  { nickname: 'celtics',      code: 'BOS', name: 'Boston Celtics',         conference: 'Este', division: 'Atlántico' },
  { nickname: 'nets',         code: 'BKN', name: 'Brooklyn Nets',          conference: 'Este', division: 'Atlántico' },
  { nickname: 'knicks',       code: 'NYK', name: 'New York Knicks',        conference: 'Este', division: 'Atlántico' },
  { nickname: '76ers',        code: 'PHI', name: 'Philadelphia 76ers',     conference: 'Este', division: 'Atlántico' },
  { nickname: 'raptors',      code: 'TOR', name: 'Toronto Raptors',        conference: 'Este', division: 'Atlántico' },
  { nickname: 'bulls',        code: 'CHI', name: 'Chicago Bulls',          conference: 'Este', division: 'Central' },
  { nickname: 'cavaliers',    code: 'CLE', name: 'Cleveland Cavaliers',    conference: 'Este', division: 'Central' },
  { nickname: 'pistons',      code: 'DET', name: 'Detroit Pistons',        conference: 'Este', division: 'Central' },
  { nickname: 'pacers',       code: 'IND', name: 'Indiana Pacers',         conference: 'Este', division: 'Central' },
  { nickname: 'bucks',        code: 'MIL', name: 'Milwaukee Bucks',        conference: 'Este', division: 'Central' },
  { nickname: 'hawks',        code: 'ATL', name: 'Atlanta Hawks',          conference: 'Este', division: 'Sureste' },
  { nickname: 'hornets',      code: 'CHA', name: 'Charlotte Hornets',      conference: 'Este', division: 'Sureste' },
  { nickname: 'heat',         code: 'MIA', name: 'Miami Heat',             conference: 'Este', division: 'Sureste' },
  { nickname: 'magic',        code: 'ORL', name: 'Orlando Magic',          conference: 'Este', division: 'Sureste' },
  { nickname: 'wizards',      code: 'WAS', name: 'Washington Wizards',     conference: 'Este', division: 'Sureste' },
  // ── Conferencia Oeste ──
  { nickname: 'nuggets',      code: 'DEN', name: 'Denver Nuggets',         conference: 'Oeste', division: 'Noroeste' },
  { nickname: 'timberwolves', code: 'MIN', name: 'Minnesota Timberwolves', conference: 'Oeste', division: 'Noroeste' },
  { nickname: 'thunder',      code: 'OKC', name: 'Oklahoma City Thunder',  conference: 'Oeste', division: 'Noroeste' },
  { nickname: 'blazers',      code: 'POR', name: 'Portland Trail Blazers', conference: 'Oeste', division: 'Noroeste' },
  { nickname: 'jazz',         code: 'UTA', name: 'Utah Jazz',              conference: 'Oeste', division: 'Noroeste' },
  { nickname: 'warriors',     code: 'GSW', name: 'Golden State Warriors',  conference: 'Oeste', division: 'Pacífico' },
  { nickname: 'clippers',     code: 'LAC', name: 'Los Angeles Clippers',   conference: 'Oeste', division: 'Pacífico' },
  { nickname: 'lakers',       code: 'LAL', name: 'Los Angeles Lakers',     conference: 'Oeste', division: 'Pacífico' },
  { nickname: 'suns',         code: 'PHX', name: 'Phoenix Suns',           conference: 'Oeste', division: 'Pacífico' },
  { nickname: 'kings',        code: 'SAC', name: 'Sacramento Kings',       conference: 'Oeste', division: 'Pacífico' },
  { nickname: 'mavericks',    code: 'DAL', name: 'Dallas Mavericks',       conference: 'Oeste', division: 'Suroeste' },
  { nickname: 'rockets',      code: 'HOU', name: 'Houston Rockets',        conference: 'Oeste', division: 'Suroeste' },
  { nickname: 'grizzlies',    code: 'MEM', name: 'Memphis Grizzlies',      conference: 'Oeste', division: 'Suroeste' },
  { nickname: 'pelicans',     code: 'NOP', name: 'New Orleans Pelicans',   conference: 'Oeste', division: 'Suroeste' },
  { nickname: 'spurs',        code: 'SAS', name: 'San Antonio Spurs',      conference: 'Oeste', division: 'Suroeste' },
]

/** Resuelve una franquicia a partir del nombre que devuelve la API. */
export function matchFranchise(apiName: string): NbaFranchise | null {
  const n = apiName.toLowerCase()
  return NBA_FRANCHISES.find((f) => n.includes(f.nickname)) ?? null
}
