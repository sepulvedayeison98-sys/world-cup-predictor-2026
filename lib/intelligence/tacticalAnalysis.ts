/**
 * Tactical Analysis Engine.
 * Deriva zonas de presión, intensidad de ataque y métricas tácticas
 * a partir de las estadísticas agregadas del equipo.
 *
 * El campo se divide en una rejilla 6×3 (6 columnas longitudinales, 3 filas laterales).
 * Columnas: defensa propia → mitad campo → área rival (1→6)
 * Filas: izquierda / centro / derecha (0→2)
 */

export interface TacticalStats {
  avgXg: number
  avgXga: number
  avgPossession: number
  avgShots: number
  avgShotsOnTarget: number
  avgCorners: number
  avgYellowCards: number
  form: string[]        // ['W','D','L',...]
}

export type ZoneIntensity = number  // 0.0 – 1.0

export interface PitchZoneMap {
  // zones[col][row]: 0.0 sin presión → 1.0 máxima presión
  // col 0 = propia portería, col 5 = portería rival
  zones: ZoneIntensity[][]
}

export interface TacticalProfile {
  style: 'posesión' | 'contragolpe' | 'directo' | 'equilibrado'
  attackIntensity: number   // 0..1
  defensiveBlock: number    // 0..1 — qué tan bajo defiende el equipo
  pressureHigh: number      // 0..1 — presión alta sobre el rival
  setpieceThreat: number    // 0..1 — amenaza de balón parado
  formScore: number         // 0..1
}

export interface MatchTacticalAnalysis {
  home: TacticalProfile & { zoneMap: PitchZoneMap }
  away: TacticalProfile & { zoneMap: PitchZoneMap }
  contestedZones: number[][]   // zonas de máxima disputa (col,row)
  dominantTeam: 'home' | 'away' | 'equal'
  keyBattleZone: string        // descripción en texto
}

function clamp01(x: number): number { return Math.min(1, Math.max(0, x)) }

function formScore(form: string[], lookback = 5): number {
  if (!form?.length) return 0.5
  const r = form.slice(-lookback)
  return r.reduce((s, f) => s + (f === 'W' ? 1 : f === 'D' ? 0.5 : 0), 0) / r.length
}

function buildProfile(stats: TacticalStats): TacticalProfile {
  const possessionAdv = clamp01(stats.avgPossession / 100)
  const attackInt     = clamp01((stats.avgXg / 2.5 + stats.avgShotsOnTarget / 8) / 2)
  const defBlock      = clamp01(1 - stats.avgXga / 2.5)
  const pressureH     = clamp01(possessionAdv * 0.6 + attackInt * 0.4)
  const setpiece      = clamp01(stats.avgCorners / 10)
  const fs            = formScore(stats.form)

  let style: TacticalProfile['style']
  if (possessionAdv > 0.55 && attackInt > 0.55) style = 'posesión'
  else if (possessionAdv < 0.45 && attackInt > 0.5) style = 'contragolpe'
  else if (stats.avgShots > 15 && possessionAdv < 0.5) style = 'directo'
  else style = 'equilibrado'

  return {
    style,
    attackIntensity:  Math.round(attackInt  * 100) / 100,
    defensiveBlock:   Math.round(defBlock   * 100) / 100,
    pressureHigh:     Math.round(pressureH  * 100) / 100,
    setpieceThreat:   Math.round(setpiece   * 100) / 100,
    formScore:        Math.round(fs         * 100) / 100,
  }
}

/**
 * Construye el mapa de intensidad de zonas para un equipo.
 * El equipo siempre "ataca hacia la derecha" (col 5 = portería rival).
 */
function buildZoneMap(profile: TacticalProfile): PitchZoneMap {
  const zones: ZoneIntensity[][] = Array.from({ length: 6 }, () => [0, 0, 0])

  const { attackIntensity: ai, defensiveBlock: db, pressureHigh: ph, setpieceThreat: sp } = profile

  // Col 0 — propia portería: muy baja presión ofensiva
  zones[0] = [db * 0.2, db * 0.3, db * 0.2]

  // Col 1 — defensa propia: actividad defensiva
  zones[1] = [db * 0.4, db * 0.5, db * 0.4]

  // Col 2 — zona media-defensiva
  zones[2] = [ph * 0.4, ph * 0.5, ph * 0.4]

  // Col 3 — zona media-ofensiva: presión alta si aplica
  zones[3] = [ph * 0.6, ph * 0.7, ph * 0.6]

  // Col 4 — zona ofensiva: principal amenaza
  zones[4] = [ai * 0.7 + sp * 0.2, ai * 0.8, ai * 0.7 + sp * 0.2]

  // Col 5 — área rival: máxima intensidad de ataque
  zones[5] = [ai * 0.8 + sp * 0.4, ai * 0.95, ai * 0.8 + sp * 0.4]

  return {
    zones: zones.map(row => row.map(v => clamp01(Math.round(v * 100) / 100))),
  }
}

export function analyzeMatchTactics(
  homeStats: TacticalStats | null,
  awayStats: TacticalStats | null,
  homeFormation?: string,
  awayFormation?: string,
): MatchTacticalAnalysis {
  const defaultStats: TacticalStats = {
    avgXg: 1.2, avgXga: 1.1, avgPossession: 50,
    avgShots: 12, avgShotsOnTarget: 4,
    avgCorners: 5, avgYellowCards: 2, form: [],
  }

  const hs = homeStats ?? defaultStats
  const as_ = awayStats ?? defaultStats

  const homeProfile = buildProfile(hs)
  const awayProfile = buildProfile(as_)
  const homeZones   = buildZoneMap(homeProfile)

  // Away zones: el visitante ataca en dirección contraria — se invierte el mapa
  const awayZonesRaw = buildZoneMap(awayProfile)
  const awayZones: PitchZoneMap = {
    zones: awayZonesRaw.zones.slice().reverse(),
  }

  // Zonas contestadas: donde ambos equipos tienen intensidad alta
  const contestedZones: number[][] = []
  for (let col = 0; col < 6; col++) {
    for (let row = 0; row < 3; row++) {
      const hIntensity = homeZones.zones[col][row]
      const aIntensity = awayZones.zones[col][row]
      if (hIntensity > 0.5 && aIntensity > 0.5) {
        contestedZones.push([col, row])
      }
    }
  }

  // Equipo dominante
  const homeTotalIntensity = homeZones.zones.flat().reduce((s, v) => s + v, 0)
  const awayTotalIntensity = awayZones.zones.flat().reduce((s, v) => s + v, 0)
  const diff = homeTotalIntensity - awayTotalIntensity
  const dominantTeam: 'home' | 'away' | 'equal' =
    diff > 1.5 ? 'home' : diff < -1.5 ? 'away' : 'equal'

  // Zona clave del partido
  const keyBattleZone =
    contestedZones.length >= 6
      ? 'Batalla en toda la cancha — partido físico e intenso'
      : contestedZones.some(([col]) => col >= 4)
        ? 'La disputa clave será en las áreas — duelo de ataque vs. defensa'
        : contestedZones.some(([col]) => col >= 2 && col <= 3)
          ? 'Zona media como campo de batalla — control del mediocampo decisivo'
          : 'Partido cerrado — bloques defensivos con transiciones rápidas'

  return {
    home: { ...homeProfile, zoneMap: homeZones },
    away: { ...awayProfile, zoneMap: awayZones },
    contestedZones,
    dominantTeam,
    keyBattleZone,
  }
}

/** Parsea una formación "4-3-3" a array [4, 3, 3] */
export function parseFormation(formation?: string | null): number[] {
  if (!formation) return [4, 3, 3]
  return formation.split('-').map(Number).filter(n => !isNaN(n) && n > 0)
}
