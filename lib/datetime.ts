/**
 * Formateo de fechas/horas en zona horaria de Colombia (UTC-5).
 * Toda la app muestra los horarios en hora colombiana con la etiqueta "COL"
 * para evitar ambigüedad, independientemente de la zona del navegador.
 */

const TZ = 'America/Bogota'

export const COL_TZ_LABEL = 'COL'

/** "2 jul" */
export function formatColDate(iso: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, day: 'numeric', month: 'short',
  }).format(new Date(iso)).replace('.', '')
}

/** "14:00" */
export function formatColTime(iso: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

/** "2 jul · 14:00" */
export function formatColDateTime(iso: string | Date): string {
  return `${formatColDate(iso)} · ${formatColTime(iso)}`
}

/** "2 de julio" */
export function formatColLongDate(iso: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, day: 'numeric', month: 'long',
  }).format(new Date(iso))
}

/** "jueves 2 jul · 14:00" */
export function formatColFull(iso: string | Date): string {
  const weekday = new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ, weekday: 'long',
  }).format(new Date(iso))
  return `${weekday} ${formatColDateTime(iso)}`
}

/**
 * "Hoy" en Colombia, como `YYYY-MM-DD`.
 *
 * `new Date().toLocaleDateString('en-CA')` parecía equivalente y no lo es:
 * usa la zona de QUIEN EJECUTA. Los componentes de cliente también se
 * renderizan en el servidor, y allí la zona es UTC — así que entre las 19:00
 * y la medianoche de Colombia el servidor ya cree que es el día siguiente.
 * El efecto es que la página de partidos abre en la fecha de mañana justo en
 * la franja en que se juega la liga colombiana, y los partidos de la noche
 * desaparecen de "hoy".
 *
 * Al fijar la zona, cliente y servidor coinciden siempre.
 */
export function todayCol(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}
