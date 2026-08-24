import type { MetadataRoute } from 'next'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { fetchAllRows } from '@/lib/fetchAll'
import { SITE_URL, LEAGUE_SLUGS } from '@/lib/constants'
import { ACTIVE_COMPETITIONS, ARCHIVED_COMPETITION_IDS } from '@/lib/sports'
import { NBA_COMPETITION_ID } from '@/lib/nba/constants'

// Sitemap dinámico (playbook Sofascore, QW1): cada partido/equipo/liga es
// una URL indexable — "pronóstico X vs Y" es la búsqueda natural del
// producto. Se regenera cada hora.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createStaticSupabaseClient()
  const now = new Date()

  // Regla de oro: matches se consulta con la lista blanca de competiciones
  const competitionIds = ACTIVE_COMPETITIONS.filter((c) => c.id).map((c) => c.id as string)

  const [matches, nbaTeams, players] = await Promise.all([
    // >1000 filas (ligas + NBA + Libertadores) → fetchAllRows
    fetchAllRows<{ id: string; kickoff_time: string }>((from, to) =>
      supabase
        .from('matches')
        .select('id, kickoff_time')
        .in('competition_id', competitionIds)
        .order('kickoff_time', { ascending: false })
        .range(from, to) as any,
    ),
    supabase.from('teams').select('id').eq('competition_id', NBA_COMPETITION_ID),
    // `players` no tiene competition_id: el vínculo va por el equipo. El
    // filtro sobre la embebida con !inner sí manda en el nivel superior, así
    // que aquí sirve para dejar fuera a los jugadores de las selecciones del
    // Mundial archivado sin tocar a los de las ligas.
    (() => {
      const q = supabase.from('players').select('id, team:teams!inner(competition_id)').limit(1000)
      // Sin archivadas no hay nada que excluir, y `in.()` con la lista vacía
      // es sintaxis inválida para PostgREST.
      return ARCHIVED_COMPETITION_IDS.length > 0
        ? q.not('team.competition_id', 'in', `(${ARCHIVED_COMPETITION_IDS.join(',')})`)
        : q
    })(),
  ])

  // Sin rutas del Mundial: la competición está archivada. /mundial existe
  // como página de archivo pero lleva `robots: noindex` — anunciarla en el
  // sitemap y pedir que no se indexe serían instrucciones contradictorias.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/dashboard`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/matches`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/predictions`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/value-bets`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/inteligencia`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/copa-libertadores`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/ligas`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/nba`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/nba/rankings`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/nba/estadisticas`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/nba/tendencias`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/nba/predicciones`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    ...Object.keys(LEAGUE_SLUGS).map((slug) => ({
      url: `${SITE_URL}/ligas/${slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ]

  const matchRoutes: MetadataRoute.Sitemap = matches.map((m) => ({
    url: `${SITE_URL}/matches/${m.id}`,
    lastModified: new Date(m.kickoff_time),
    changeFrequency: 'daily',
    priority: 0.7,
  }))

  const teamRoutes: MetadataRoute.Sitemap = (nbaTeams.data ?? []).map((t: any) => ({
    url: `${SITE_URL}/nba/equipos/${t.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  const playerRoutes: MetadataRoute.Sitemap = (players.data ?? []).map((p: any) => ({
    url: `${SITE_URL}/players/${p.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.4,
  }))

  return [...staticRoutes, ...matchRoutes, ...teamRoutes, ...playerRoutes]
}
