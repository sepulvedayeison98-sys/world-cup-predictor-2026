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
