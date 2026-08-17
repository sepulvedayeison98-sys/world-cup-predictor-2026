/**
 * Traductores compartidos ESPN → modelos internos.
 *
 * Viven aparte porque fútbol y baloncesto comparten estructura en ESPN
 * (evento → competición → competidores) y duplicar el mapeo garantizaría
 * que un día divergieran sin que nadie se enterase. El tenis NO reutiliza
 * casi nada de aquí: su forma es distinta de verdad, no por capricho.
 */

import { ProviderError } from '../../core/errors'
import { ref } from '../../core/ports'
import type {
  Coach, Competition, ExternalRef, Fixture, FixtureSide, PeriodScore,
  RecentForm, Standing, Team, Venue,
} from '../../core/types'
import type {
  EspnCompetition, EspnCompetitor, EspnStandingsEntry, EspnStat, EspnStatus,
  EspnTeamRaw,
} from './shapes'

export const ESPN = 'espn' as const

/** Índice nombre→valor de las listas `stats` de ESPN, que llegan sin orden fijo. */
export function statMap(stats: EspnStat[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of stats ?? []) {
    if (!s?.name || typeof s.value !== 'number' || !Number.isFinite(s.value)) continue
    out[s.name] = s.value
  }
  return out
}

/** Escudo preferido: el `default`, y si no el primero que haya. */
export function pickLogo(t: EspnTeamRaw | undefined): string | null {
  if (!t) return null
  if (t.logo) return t.logo
  const logos = t.logos ?? []
  const def = logos.find((l) => l.rel?.includes('default'))
  return def?.href ?? logos[0]?.href ?? null
}

export function toVenue(v: EspnTeamRaw['venue'] | EspnCompetition['venue']): Venue | null {
  if (!v?.fullName) return null
  const asTeamVenue = v as NonNullable<EspnTeamRaw['venue']>
  return {
    name: v.fullName,
    city: v.address?.city ?? null,
    country: v.address?.country ?? null,
    capacity: typeof v.capacity === 'number' ? v.capacity : null,
    // ESPN solo distingue césped natural sí/no. Traducirlo a un enum de
    // superficies que no publica sería inventar precisión.
    surface: typeof asTeamVenue.grass === 'boolean' ? (asTeamVenue.grass ? 'grass' : 'artificial') : null,
    imageUrl: asTeamVenue.images?.[0]?.href ?? null,
  }
}

export function toTeam(raw: EspnTeamRaw | undefined, endpoint: string): Team {
  if (!raw?.id || !raw.displayName) {
    throw new ProviderError({
      kind: 'parse', provider: ESPN, endpoint,
      message: 'equipo de ESPN sin id o sin nombre',
    })
  }
  return {
    ref: ref(ESPN, raw.id),
    name: raw.displayName,
    shortName: raw.shortDisplayName ?? raw.name ?? null,
    code: raw.abbreviation ?? null,
    // ESPN no publica el país del club en el endpoint de equipos; el del
    // estadio es lo más cercano que hay y se declara como tal.
    country: raw.venue?.address?.country ?? null,
    logoUrl: pickLogo(raw),
    // Ni año de fundación ni palmarés: ESPN no los sirve. Van en null, no en 0.
    founded: null,
    venue: toVenue(raw.venue),
    coach: null,
    honours: null,
  }
}

/** ESPN no entrega técnico en estos endpoints; el hueco queda explícito. */
export const NO_COACH: Coach | null = null

const STATUS_MAP: Record<string, Fixture['status']> = {
  STATUS_SCHEDULED: 'scheduled',
  STATUS_IN_PROGRESS: 'live',
  STATUS_HALFTIME: 'live',
  STATUS_END_PERIOD: 'live',
  STATUS_FIRST_HALF: 'live',
  STATUS_SECOND_HALF: 'live',
  STATUS_FINAL: 'finished',
  STATUS_FULL_TIME: 'finished',
  STATUS_POSTPONED: 'postponed',
  STATUS_CANCELED: 'cancelled',
  STATUS_ABANDONED: 'cancelled',
}

export function toFixtureStatus(s: EspnStatus | undefined): Fixture['status'] {
  const name = s?.type?.name
  if (name && STATUS_MAP[name]) return STATUS_MAP[name]
  // Si el nombre es desconocido, el `state` sigue siendo fiable.
  const state = s?.type?.state
  if (state === 'in') return 'live'
  if (state === 'post') return s?.type?.completed ? 'finished' : 'cancelled'
  return 'scheduled'
}

function parseScore(v: string | number | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toSide(c: EspnCompetitor | undefined, endpoint: string): FixtureSide {
  const team = c?.team
  if (!team?.id) {
    throw new ProviderError({
      kind: 'parse', provider: ESPN, endpoint,
      message: 'competidor de ESPN sin equipo',
    })
  }
  return {
    teamRef: ref(ESPN, team.id),
    name: team.displayName ?? team.name ?? team.abbreviation ?? 'Desconocido',
    shortName: team.shortDisplayName ?? null,
    logoUrl: pickLogo(team),
    score: parseScore(c?.score),
    record: c?.records?.find((r) => r.type === 'total')?.summary ?? c?.records?.[0]?.summary ?? null,
  }
}

function toPeriods(home: EspnCompetitor | undefined, away: EspnCompetitor | undefined, labeller: (i: number) => string): PeriodScore[] | null {
  const h = home?.linescores ?? []
  const a = away?.linescores ?? []
  const n = Math.max(h.length, a.length)
  if (n === 0) return null
  return Array.from({ length: n }, (_, i) => ({
    label: labeller(i),
    home: typeof h[i]?.value === 'number' ? h[i]!.value! : null,
    away: typeof a[i]?.value === 'number' ? a[i]!.value! : null,
  }))
}

/**
 * Evento ESPN → `Fixture`. `labeller` nombra los parciales, que es lo único
 * que de verdad cambia entre fútbol ("1T", "2T") y NBA ("Q1"…"OT").
 */
export function toFixture(
  eventId: string,
  comp: EspnCompetition,
  sport: 'futbol' | 'baloncesto',
  competitionRef: ExternalRef | null,
  endpoint: string,
  labeller: (i: number) => string,
): Fixture {
  const competitors = comp.competitors ?? []
  const home = competitors.find((c) => c.homeAway === 'home') ?? competitors[0]
  const away = competitors.find((c) => c.homeAway === 'away') ?? competitors[1]
  const kickoff = comp.date ?? comp.startDate
  if (!kickoff) {
    throw new ProviderError({
      kind: 'parse', provider: ESPN, endpoint,
      message: `partido ${eventId} de ESPN sin fecha`,
    })
  }
  return {
    ref: ref(ESPN, comp.id ?? eventId),
    sport,
    competitionRef,
    kickoff: new Date(kickoff).toISOString(),
    status: toFixtureStatus(comp.status),
    statusDetail: comp.status?.type?.detail ?? comp.status?.type?.shortDetail ?? null,
    round: comp.round?.displayName ?? null,
    venue: toVenue(comp.venue),
    home: toSide(home, endpoint),
    away: toSide(away, endpoint),
    periods: toPeriods(home, away, labeller),
  }
}

/** "W-D-L" o "W-L" de ESPN → forma tipada. Devuelve null si no viene. */
export function parseRecord(summary: string | null | undefined, hasDraws: boolean): RecentForm | null {
  if (!summary) return null
  const parts = summary.split('-').map((p) => Number(p.trim()))
  if (parts.some((p) => !Number.isFinite(p))) return null
  const [won, second, third] = parts
  const drawn = hasDraws ? (second ?? 0) : null
  const lost = hasDraws ? (third ?? 0) : (second ?? 0)
  return {
    results: [], // ESPN no da la secuencia aquí, solo el agregado.
    played: (won ?? 0) + (drawn ?? 0) + (lost ?? 0),
    won: won ?? 0,
    drawn,
    lost: lost ?? 0,
  }
}

/**
 * Entrada de clasificación → `Standing`.
 *
 * `hasDraws` separa fútbol (empates, puntos) de NBA (sin empates, se ordena
 * por porcentaje). Meter ambos en el mismo molde sin ese interruptor daría
 * "0 empates" en la NBA, que es falso: allí el empate no existe.
 */
export function toStanding(
  entry: EspnStandingsEntry,
  index: number,
  hasDraws: boolean,
  group: string | null,
  endpoint: string,
): Standing {
  const team = entry.team
  if (!team?.id) {
    throw new ProviderError({
      kind: 'parse', provider: ESPN, endpoint, message: 'clasificación sin equipo',
    })
  }
  const s = statMap(entry.stats)
  const num = (k: string): number | null => (k in s ? s[k] : null)
  return {
    rank: num('rank') ?? entry.note?.rank ?? index + 1,
    teamRef: ref(ESPN, team.id),
    teamName: team.displayName ?? team.name ?? team.abbreviation ?? 'Desconocido',
    played: num('gamesPlayed') ?? 0,
    won: num('wins') ?? 0,
    drawn: hasDraws ? (num('ties') ?? 0) : null,
    lost: num('losses') ?? 0,
    goalsFor: num('pointsFor'),
    goalsAgainst: num('pointsAgainst'),
    points: hasDraws ? num('points') : null,
    winPct: num('winPercent'),
    form: null,
    group,
    description: entry.note?.description ?? null,
  }
}

/** Etiqueta de competición ESPN → `Competition`. */
export function toCompetition(
  leagueId: string,
  name: string,
  sport: Competition['sport'],
  opts: { shortName?: string | null; season?: number | null; seasonLabel?: string | null; logoUrl?: string | null; type?: Competition['type'] } = {},
): Competition {
  return {
    ref: ref(ESPN, leagueId),
    sport,
    name,
    shortName: opts.shortName ?? null,
    country: null,
    logoUrl: opts.logoUrl ?? null,
    season: opts.season ?? null,
    seasonLabel: opts.seasonLabel ?? null,
    type: opts.type ?? 'league',
  }
}
