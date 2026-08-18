import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Plantilla del equipo, agrupada por puesto, con las bajas señaladas donde
 * el usuario las va a buscar: sobre el jugador, no en una lista aparte.
 *
 * ── Dos decisiones que vienen del dato real, no del diseño ───────────────
 *
 *  1. El puesto llega en CUATRO formatos distintos. `/players/squads`
 *     devuelve "Goalkeeper", pero las fichas creadas desde una alineación
 *     traen "G", alguna dice "Forward" y quince jugadores no traen puesto.
 *     La ingesta guarda el texto original tal cual —eso es lo correcto— y
 *     la normalización vive aquí, en el único sitio que necesita agrupar.
 *
 *  2. La lesión no lleva impacto numérico. `impact_score` se ingesta en
 *     NULL a propósito (ver migración 059): sabemos que el jugador está
 *     fuera porque la fuente lo dice, no cuánto pesa su ausencia. Así que
 *     se muestra el motivo y ya; ninguna barra, ninguna puntuación.
 */

export interface SquadPlayer {
  id: string
  name: string
  number: number | null
  position_raw: string | null
  age: number | null
  photo_url: string | null
  nationality: string | null
}

export interface SquadInjury {
  player_id: string
  reason_raw: string | null
  injury_type: string | null
}

/** Los cuatro puestos, en orden de alineación. */
const GROUPS = [
  { key: 'gk', label: 'Porteros' },
  { key: 'df', label: 'Defensas' },
  { key: 'mf', label: 'Centrocampistas' },
  { key: 'fw', label: 'Delanteros' },
  { key: 'na', label: 'Sin puesto declarado' },
] as const

type GroupKey = (typeof GROUPS)[number]['key']

/** Normaliza las variantes que de verdad aparecen en la base. */
export function positionGroup(raw: string | null): GroupKey {
  const p = (raw ?? '').trim().toLowerCase()
  if (!p) return 'na'
  if (p === 'goalkeeper' || p === 'g' || p === 'gk') return 'gk'
  if (p === 'defender' || p === 'd' || p === 'df') return 'df'
  if (p === 'midfielder' || p === 'm' || p === 'mf') return 'mf'
  if (p === 'attacker' || p === 'forward' || p === 'f' || p === 'fw') return 'fw'
  return 'na'
}

/** Motivos completos que no siguen el patrón «<parte> Injury». */
const REASON_ES: Record<string, string> = {
  'illness': 'Enfermedad',
  'suspended': 'Sancionado',
  'red card': 'Expulsión',
  'yellow cards': 'Acumulación de amarillas',
  'coach decision': 'Decisión técnica',
  'personal reasons': 'Motivos personales',
  'national selection': 'Con su selección',
  'cruciate ligament rupture': 'Ligamento cruzado',
  'broken ankle': 'Tobillo roto',
  'injury': 'Lesión',
}

/** Partes del cuerpo, para el patrón «<parte> Injury». */
const BODY_ES: Record<string, string> = {
  knee: 'Rodilla', ankle: 'Tobillo', foot: 'Pie', thigh: 'Muslo',
  calf: 'Gemelo', groin: 'Aductor', hamstring: 'Isquiotibiales',
  muscle: 'Muscular', muscular: 'Muscular', back: 'Espalda',
  shoulder: 'Hombro', ribs: 'Costillas', rib: 'Costilla', head: 'Cabeza',
  hip: 'Cadera', toe: 'Dedo del pie', wrist: 'Muñeca', elbow: 'Codo',
  neck: 'Cuello', achilles: 'Tendón de Aquiles', hand: 'Mano',
  chest: 'Pecho', abdominal: 'Abdominal', hernia: 'Hernia',
  concussion: 'Conmoción', fracture: 'Fractura', 'metatarsal': 'Metatarso',
}

/**
 * Motivo de la baja en español.
 *
 * Tres pasadas, y el orden importa. Primero los motivos completos que no
 * son lesiones («Suspended», «Coach decision»). Luego el patrón dominante
 * de la fuente, «<parte del cuerpo> Injury», que se resuelve traduciendo la
 * parte. Y si nada casa, **se devuelve el original tal cual**: un motivo que
 * no conocemos debe verse como lo publica la fuente, no convertirse en un
 * genérico que borra la información. Esa es la razón de que la primera
 * versión mostrara "Ribs Injury" en crudo — preferible a inventarse algo.
 */
export function reasonLabel(raw: string | null): string | null {
  if (!raw) return null
  const p = raw.trim()
  if (!p) return null
  const low = p.toLowerCase()

  const exacto = REASON_ES[low]
  if (exacto) return exacto

  const m = /^(.+?)\s+(injury|problem|issues?|strain)$/i.exec(low)
  if (m) {
    const parte = BODY_ES[m[1].trim()]
    if (parte) return parte
  }

  return p
}

export interface TeamSquadProps {
  players: SquadPlayer[]
  injuries: SquadInjury[]
}

export function TeamSquad({ players, injuries }: TeamSquadProps) {
  const injuryByPlayer = new Map(injuries.map((i) => [i.player_id, i]))

  const byGroup = new Map<GroupKey, SquadPlayer[]>()
  for (const p of players) {
    const g = positionGroup(p.position_raw)
    const list = byGroup.get(g)
    if (list) list.push(p)
    else byGroup.set(g, [p])
  }
  // Dentro de cada puesto, por dorsal. Los que no tienen dorsal van al final:
  // ponerlos primero con un 0 fingido sería inventarles uno.
  for (const list of byGroup.values()) {
    list.sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'es'))
  }

  const bajas = players.filter((p) => injuryByPlayer.has(p.id))

  return (
    <section className="card p-4" aria-label="Plantilla">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-white">Plantilla</h2>
        <p className="text-xs text-zinc-500">
          {players.length} {players.length === 1 ? 'jugador' : 'jugadores'}
          {bajas.length > 0 && (
            <> · <span className="text-red-400">{bajas.length} {bajas.length === 1 ? 'baja' : 'bajas'}</span></>
          )}
        </p>
      </div>

      {/* Las bajas, arriba y en una línea: es lo primero que se busca antes
          de un partido. Si no hay ninguna la fila no existe — no se escribe
          "sin bajas", porque la fuente puede no haber publicado partes
          todavía y afirmarlo sería ir más allá de lo que sabemos. */}
      {bajas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true" />
          {bajas.map((p, i) => {
            const motivo = reasonLabel(injuryByPlayer.get(p.id)?.reason_raw ?? null)
            return (
              <span key={p.id} className="text-xs text-zinc-300">
                {/* El separador va DELANTE y desde el segundo: detrás dejaba
                    un «·» colgando al final de la lista. */}
                {i > 0 && <span className="mr-1.5 text-zinc-700">·</span>}
                {p.name}
                {motivo && <span className="text-zinc-500"> ({motivo})</span>}
              </span>
            )
          })}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {GROUPS.map(({ key, label }) => {
          const list = byGroup.get(key)
          if (!list || list.length === 0) return null
          return (
            <div key={key}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                {label} <span className="text-zinc-700">({list.length})</span>
              </p>
              <ul className="flex flex-col">
                {list.map((p) => {
                  const lesion = injuryByPlayer.get(p.id)
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-2.5 border-b border-zinc-800/60 py-1.5 last:border-0"
                    >
                      <span className="mono w-6 shrink-0 text-right text-[11px] text-zinc-600">
                        {p.number ?? '—'}
                      </span>
                      {/* El círculo se pinta siempre, con o sin foto: así la
                          fila mide lo mismo y una imagen que no carga se ve
                          como un hueco previsto, no como algo roto. */}
                      {p.photo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.photo_url} alt="" aria-hidden="true" loading="lazy" decoding="async"
                          className="h-6 w-6 shrink-0 rounded-full bg-zinc-800 object-cover"
                        />
                      ) : (
                        <span className="h-6 w-6 shrink-0 rounded-full bg-zinc-800" aria-hidden="true" />
                      )}
                      <span className={cn('truncate text-sm', lesion ? 'text-zinc-400' : 'text-zinc-200')}>
                        {p.name}
                      </span>
                      {lesion && (
                        <span
                          className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400"
                          title={reasonLabel(lesion.reason_raw) ?? 'Baja'}
                        >
                          baja
                        </span>
                      )}
                      <span className="mono ml-auto shrink-0 text-[11px] text-zinc-600">
                        {[p.nationality, p.age != null ? `${p.age}a` : null].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Procedencia: la plantilla la publica API-Football y no trae ni
          nacionalidad ni fecha de nacimiento en ese endpoint. Decirlo evita
          que la ausencia parezca un fallo nuestro. */}
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        Plantilla y partes de baja según API-Football. La edad es la del último
        sincronizado; el dorsal falta cuando la fuente no lo publica.
      </p>
    </section>
  )
}
