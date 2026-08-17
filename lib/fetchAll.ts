/**
 * Trae TODAS las filas de una consulta PostgREST paginando por rangos.
 *
 * Supabase limita a 1000 filas por respuesta; competiciones grandes como
 * la NBA (~1230 partidos de temporada regular) superan ese tope y se
 * truncan silenciosamente. Este helper pagina hasta agotar los datos.
 */
const PAGE = 1000

export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const out: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return out
}

/**
 * Parte una lista en lotes. El caso de uso es el filtro `.in(...)`: PostgREST
 * lo manda en la URL, así que unos cientos de UUID la revientan. Trocear
 * también acota el tamaño de cada upsert.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
