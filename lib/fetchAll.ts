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
