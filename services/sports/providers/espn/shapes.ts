/**
 * Formas crudas de las respuestas de ESPN.
 *
 * Se declaran aquí, sueltas y con casi todo opcional, porque ESPN no publica
 * un contrato: los campos aparecen y desaparecen según el deporte, la liga y
 * si el partido ya empezó. Tipar optimista y validar en el adapter es más
 * honesto que fingir un esquema estricto que la fuente no garantiza.
 *
 * Nada de esto sale de la carpeta `espn/`: fuera solo circulan los modelos
 * normalizados de `core/types`.
 */

export interface EspnLogo { href?: string; rel?: string[] }
export interface EspnLink { href?: string; rel?: string[] }

export interface EspnTeamRaw {
  id?: string
  uid?: string
  slug?: string
  abbreviation?: string
  displayName?: string
  shortDisplayName?: string
  name?: string
  location?: string
  nickname?: string
  color?: string
  logos?: EspnLogo[]
  logo?: string
  venue?: {
    id?: string
    fullName?: string
    address?: { city?: string; country?: string; state?: string }
    capacity?: number
    grass?: boolean
    images?: { href?: string }[]
  }
  record?: { items?: { type?: string; summary?: string; stats?: { name?: string; value?: number }[] }[] }
  isActive?: boolean
}

export interface EspnTeamsResponse {
  sports?: { leagues?: { teams?: { team?: EspnTeamRaw }[] }[] }[]
}

export interface EspnTeamResponse {
  team?: EspnTeamRaw
}

export interface EspnStat { name?: string; value?: number; displayValue?: string }

export interface EspnStandingsEntry {
  team?: EspnTeamRaw
  note?: { description?: string; rank?: number }
  stats?: EspnStat[]
}

export interface EspnStandingsResponse {
  name?: string
  season?: number
  children?: {
    name?: string
    abbreviation?: string
    standings?: { entries?: EspnStandingsEntry[] }
  }[]
}

export interface EspnLinescore { value?: number; tiebreak?: number; winner?: boolean }

export interface EspnCompetitor {
  id?: string
  uid?: string
  homeAway?: 'home' | 'away'
  order?: number
  winner?: boolean
  score?: string | number
  team?: EspnTeamRaw
  athlete?: {
    id?: string
    displayName?: string
    shortName?: string
    flag?: string | { href?: string; alt?: string }
    flagAltText?: string
  }
  linescores?: EspnLinescore[]
  records?: { type?: string; summary?: string }[]
  curatedRank?: { current?: number }
}

export interface EspnStatus {
  type?: { name?: string; state?: string; completed?: boolean; description?: string; detail?: string; shortDetail?: string }
  period?: number
  displayClock?: string
}

export interface EspnCompetition {
  id?: string
  date?: string
  startDate?: string
  status?: EspnStatus
  competitors?: EspnCompetitor[]
  venue?: { fullName?: string; address?: { city?: string; country?: string }; capacity?: number }
  round?: { id?: string; displayName?: string }
  type?: { id?: string; text?: string; slug?: string }
  tournamentId?: number | string
  notes?: { headline?: string; type?: string }[]
}

export interface EspnEvent {
  id?: string
  uid?: string
  name?: string
  shortName?: string
  date?: string
  season?: { year?: number; type?: number }
  status?: EspnStatus
  competitions?: EspnCompetition[]
  /** Solo tenis: el evento es el torneo y los partidos cuelgan de aquí. */
  groupings?: {
    grouping?: { id?: string; slug?: string; displayName?: string }
    competitions?: EspnCompetition[]
  }[]
  venue?: { fullName?: string; displayName?: string; address?: { city?: string; country?: string } }
}

export interface EspnScoreboardResponse {
  leagues?: {
    id?: string
    name?: string
    abbreviation?: string
    slug?: string
    midsizeName?: string
    logos?: EspnLogo[]
    season?: { year?: number; displayName?: string }
    calendar?: string[]
  }[]
  events?: EspnEvent[]
}

export interface EspnRankAthlete {
  id?: string
  displayName?: string
  shortname?: string
  firstName?: string
  lastName?: string
  /**
   * ESPN es inconsistente aquí y hay que absorberlo: en el ranking `flag` es
   * la URL en crudo (string) y en el marcador es un objeto `{href}`. Tipar
   * solo una de las dos formas deja el país en null la mitad de las veces.
   */
  flag?: string | { href?: string; alt?: string }
  flagAltText?: string
  citizenshipCountry?: { abbreviation?: string; alternateId?: string; name?: string }
  headshot?: { href?: string }
  age?: number
}

export interface EspnRankingsResponse {
  rankings?: {
    id?: string
    name?: string
    type?: string
    update?: string
    ranks?: {
      current?: number
      previous?: number
      points?: number
      trend?: string
      athlete?: EspnRankAthlete
    }[]
  }[]
}

export interface EspnNewsResponse {
  header?: string
  articles?: {
    id?: number | string
    headline?: string
    description?: string
    published?: string
    lastModified?: string
    type?: string
    byline?: string
    links?: { web?: { href?: string }; mobile?: { href?: string } }
    images?: { url?: string; href?: string; width?: number; height?: number }[]
    categories?: { type?: string; description?: string }[]
  }[]
}
