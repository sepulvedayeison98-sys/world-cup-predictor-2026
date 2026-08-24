import { createAdminClient } from '@/lib/supabase/admin'
import { LIBERTADORES_COMPETITION_ID } from '@/lib/constants'

/**
 * Competiciones con sync de resultados en vivo vía ESPN.
 *
 * El Mundial salió de esta lista al archivarse: llevaba desde el 19 de julio
 * sin un solo partido que sincronizar y su única función era mantener viva
 * una consulta de 104 filas cada 15 minutos.
 */
const LIVE_SYNC_COMPETITION_IDS = [LIBERTADORES_COMPETITION_ID]

const MIN = 60 * 1000

export interface SyncWindow {
  now: string
  liveMatches: number
  activeMatches: number
  upcomingNext48h: number
  nextKickoffInMin: number | null
  shouldSyncResults: boolean
  shouldSyncOdds: boolean
  reason: string
}

/**
 * Calcula si conviene sincronizar ahora consultando solo nuestra base
 * (no gasta cuota de The Odds API). Usado por /api/sync/window (inspeccion)
 * y /api/sync/auto (ping externo que decide y sincroniza en una sola llamada).
 */
export async function getSyncWindow(): Promise<SyncWindow> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('matches')
    .select('id, kickoff_time, status')
    .in('competition_id', LIVE_SYNC_COMPETITION_IDS)
  if (error) throw error

  const now = Date.now()
  let liveMatches = 0
  let activeMatches = 0 // en ventana de juego (desde -15min hasta +150min del saque)
  let upcoming48 = 0 // programados en las proximas 48h
  let nextKickoff = Number.POSITIVE_INFINITY

  for (const m of (data ?? [])) {
    const k = new Date(m.kickoff_time).getTime()
    const finishedish = m.status === 'finished' || m.status === 'cancelled'

    if (m.status === 'live') liveMatches++
    if (!finishedish && now >= k - 15 * MIN && now <= k + 150 * MIN) activeMatches++
    if (m.status === 'scheduled' && k > now) {
      if (k <= now + 48 * 60 * MIN) upcoming48++
      if (k < nextKickoff) nextKickoff = k
    }
  }

  const shouldSyncResults = liveMatches > 0 || activeMatches > 0
  const shouldSyncOdds = upcoming48 > 0
  const nextKickoffInMin =
    nextKickoff === Number.POSITIVE_INFINITY ? null : Math.round((nextKickoff - now) / MIN)

  return {
    now: new Date(now).toISOString(),
    liveMatches,
    activeMatches,
    upcomingNext48h: upcoming48,
    nextKickoffInMin,
    shouldSyncResults,
    shouldSyncOdds,
    reason: shouldSyncResults
      ? `${activeMatches || liveMatches} partido(s) en ventana de juego`
      : nextKickoffInMin != null
        ? `sin partidos activos; proximo saque en ${nextKickoffInMin} min`
        : 'sin partidos programados',
  }
}
