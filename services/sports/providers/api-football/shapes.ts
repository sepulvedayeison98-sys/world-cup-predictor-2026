/**
 * Formas crudas de API-Football v3.
 *
 * Casi todo opcional por la misma razón que en ESPN: la API rellena unos
 * campos u otros según el endpoint y el estado del partido. La validación
 * seria vive en el adapter, que es quien sabe qué necesita de verdad.
 *
 * Nada de esto cruza la frontera de `api-football/`.
 */

export interface AfTeamCore {
  id?: number
  name?: string
  code?: string | null
  country?: string
  founded?: number | null
  national?: boolean
  logo?: string
}

export interface AfTeamEntry {
  team?: AfTeamCore
  venue?: {
    id?: number
    name?: string
    address?: string | null
    city?: string | null
    capacity?: number | null
    surface?: string | null
    image?: string | null
  }
}

export interface AfLeague {
  league?: { id?: number; name?: string; type?: string; logo?: string }
  country?: { name?: string; code?: string | null; flag?: string | null }
  seasons?: { year?: number; start?: string; end?: string; current?: boolean }[]
}

export interface AfFixture {
  fixture?: {
    id?: number
    date?: string
    timestamp?: number
    venue?: { id?: number | null; name?: string | null; city?: string | null }
    status?: { long?: string; short?: string; elapsed?: number | null }
  }
  league?: { id?: number; name?: string; season?: number; round?: string }
  teams?: {
    home?: { id?: number; name?: string; logo?: string; winner?: boolean | null }
    away?: { id?: number; name?: string; logo?: string; winner?: boolean | null }
  }
  goals?: { home?: number | null; away?: number | null }
  score?: {
    halftime?: { home?: number | null; away?: number | null }
    fulltime?: { home?: number | null; away?: number | null }
    extratime?: { home?: number | null; away?: number | null }
    penalty?: { home?: number | null; away?: number | null }
  }
}

export interface AfStandingSplit {
  played?: number
  win?: number
  draw?: number
  lose?: number
  goals?: { for?: number; against?: number }
}

export interface AfStanding {
  rank?: number
  team?: AfTeamCore
  points?: number
  goalsDiff?: number
  group?: string
  form?: string | null
  status?: string
  description?: string | null
  all?: AfStandingSplit
  home?: AfStandingSplit
  away?: AfStandingSplit
}

export interface AfSquad {
  team?: AfTeamCore
  players?: {
    id?: number
    name?: string
    age?: number
    number?: number | null
    position?: string
    photo?: string
  }[]
}

export interface AfTeamStats {
  form?: string | null
  fixtures?: {
    played?: { home?: number; away?: number; total?: number }
    wins?: { home?: number; away?: number; total?: number }
    draws?: { home?: number; away?: number; total?: number }
    loses?: { home?: number; away?: number; total?: number }
  }
  goals?: {
    for?: { total?: { home?: number; away?: number; total?: number }; average?: { total?: string } }
    against?: { total?: { home?: number; away?: number; total?: number }; average?: { total?: string } }
  }
  clean_sheet?: { home?: number; away?: number; total?: number }
  failed_to_score?: { home?: number; away?: number; total?: number }
  penalty?: { scored?: { total?: number }; missed?: { total?: number } }
}

export interface AfPlayerStats {
  player?: { id?: number; name?: string; age?: number; nationality?: string; photo?: string }
  statistics?: {
    team?: AfTeamCore
    league?: { id?: number; name?: string; season?: number }
    games?: { appearences?: number; minutes?: number; position?: string; rating?: string | null }
    goals?: { total?: number | null; assists?: number | null; conceded?: number | null }
    shots?: { total?: number | null; on?: number | null }
    cards?: { yellow?: number; red?: number }
  }[]
}

export interface AfLineupSlot {
  player?: { id?: number; name?: string; number?: number; pos?: string; grid?: string | null }
}

export interface AfLineup {
  team?: AfTeamCore
  formation?: string
  coach?: { id?: number; name?: string; photo?: string }
  startXI?: AfLineupSlot[]
  substitutes?: AfLineupSlot[]
}

export interface AfInjury {
  player?: { id?: number; name?: string; photo?: string; type?: string; reason?: string }
  team?: AfTeamCore
  fixture?: { id?: number; date?: string; timestamp?: number }
  league?: { id?: number; season?: number; name?: string }
}
