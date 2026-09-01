/**
 * Puente entre nuestras competiciones y las claves de deporte de
 * The Odds API, más el emparejamiento de equipos por nombre.
 *
 * ── Por qué no vale el mapeo que ya existía ───────────────────────────────
 * `lib/teamMapping.ts` traduce nombre → código FIFA de tres letras y está
 * escrito a mano para las 48 selecciones del Mundial. Para clubes no sirve:
 * son cientos, cambian cada temporada y no tienen código FIFA. Aquí el
 * emparejamiento se hace contra los equipos que la propia base tiene EN ESA
 * competición, normalizando el nombre por los dos lados.
 *
 * ── Coste de la API ───────────────────────────────────────────────────────
 * El plan gratuito de The Odds API son 500 créditos al mes y cada llamada a
 * /odds cuesta (regiones × mercados) = 1 × 2 = 2 créditos con nuestros
 * parámetros. Multiplicar eso por siete competiciones y seis corridas
 * diarias son ~2.500 al mes: imposible. Por eso el sync solo pide las
 * competiciones que tienen partido próximo y lee los créditos restantes de
 * la cabecera de la respuesta en vez de estimarlos.
 */
import { LEAGUE_SLUGS, LIBERTADORES_COMPETITION_ID } from '@/lib/constants'

/**
 * Clave de deporte de The Odds API por slug de liga nuestra.
 *
 * Estas claves NO se dan por buenas a ciegas: antes de gastar créditos el
 * sync pide /v4/sports (gratuito, no consume cuota) y descarta las que no
 * existan o no estén activas, dejándolas anotadas en el resultado. Así, si
 * The Odds API renombra un deporte o una liga está fuera de temporada, se
 * ve en el log en vez de convertirse en un 422 silencioso.
 */
export const ODDS_SPORT_BY_SLUG: Record<string, string> = {
  'premier-league': 'soccer_epl',
  'la-liga': 'soccer_spain_la_liga',
  'serie-a': 'soccer_italy_serie_a',
  'bundesliga': 'soccer_germany_bundesliga',
  'ligue-1': 'soccer_france_ligue_one',
  'liga-betplay': 'soccer_colombia_primera_a',
}

/** Clave de deporte por competition_id de la base. */
export function oddsSportByCompetition(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [slug, id] of Object.entries(LEAGUE_SLUGS)) {
    const sport = ODDS_SPORT_BY_SLUG[slug]
    if (sport) map.set(id, sport)
  }
  map.set(LIBERTADORES_COMPETITION_ID, 'soccer_conmebol_copa_libertadores')
  return map
}

/**
 * Normaliza un nombre de equipo para comparar entre fuentes.
 *
 * Quita acentos, puntuación y los sufijos/prefijos societarios que cada
 * fuente escribe a su manera ("FC Barcelona" / "Barcelona FC" / "Barcelona").
 *
 * Deliberadamente NO se tocan palabras que forman parte del nombre y
 * distinguen clubes reales: "Deportivo" separa al Deportivo Cali del
 * América de Cali, y "Real" al Real Sociedad de la Sociedad Deportiva. Una
 * normalización más agresiva empareja equipos distintos, que es peor que no
 * emparejar: una cuota colgada del partido equivocado no se detecta a
 * simple vista.
 */
const AFIJOS = /\b(fc|cf|afc|sc|ac|as|ss|ssc|cd|ud|rc|rcd|club|calcio|futbol|football)\b/g

export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')                     // puntuación
    .replace(AFIJOS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface TeamRef { id: string; name: string; short_name?: string | null }

/**
 * Índice de nombres normalizados → id de equipo, para UNA competición.
 *
 * Un nombre normalizado que apunte a dos equipos distintos se descarta de
 * los dos: es ambiguo y emparejar al azar colgaría la cuota del partido
 * equivocado.
 */
export function buildTeamIndex(teams: TeamRef[]): Map<string, string> {
  const conflictivos = new Set<string>()
  const index = new Map<string, string>()
  for (const t of teams) {
    for (const raw of [t.name, t.short_name]) {
      if (!raw) continue
      const key = normalizeTeamName(raw)
      if (!key) continue
      const previo = index.get(key)
      if (previo && previo !== t.id) conflictivos.add(key)
      else index.set(key, t.id)
    }
  }
  for (const key of conflictivos) index.delete(key)
  return index
}

/**
 * Resuelve el equipo de un nombre de The Odds API contra el índice.
 *
 * Dos pasadas: igualdad exacta del normalizado y, si falla, contención en
 * un único sentido y con un solo candidato ("Wolverhampton Wanderers" vs
 * "Wolverhampton"). Con más de un candidato devuelve null — antes ninguna
 * cuota que una cuota mal asignada.
 */
export function matchTeam(index: Map<string, string>, sourceName: string): string | null {
  const key = normalizeTeamName(sourceName)
  if (!key) return null
  const exacto = index.get(key)
  if (exacto) return exacto

  const candidatos = new Set<string>()
  for (const [k, id] of index) {
    if (k.includes(key) || key.includes(k)) candidatos.add(id)
  }
  return candidatos.size === 1 ? [...candidatos][0] : null
}
