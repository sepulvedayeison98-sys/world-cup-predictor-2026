import type { MetadataRoute } from 'next'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { fetchAllRows } from '@/lib/fetchAll'
import { SITE_URL, LEAGUE_SLUGS, COMPETITION_ID } from '@/lib/constants'
import { ACTIVE_COMPETITIONS } from '@/lib/sports'
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
    // >1000 filas (Mundial + ligas + NBA) → fetchAllRows
    fetchAllRows<{ id: string; kickoff_time: string }>((from, to) =>
      supabase
        .from('matches')
        .select('id, kickoff_time')
        .in('competition_id', competitionIds)
        .order('kickoff_time', { ascending: false })
        .range(from, to) as any,
    ),
    supabase.from('teams').select('id').eq('competition_id', NBA_COMPETITION_ID),
    supabase.from('players').select('id').limit(1000),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/dashboard`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/mundial`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/mundial/rankings`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/matches`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/predictions`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/value-bets`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/inteligencia`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/groups`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/bracket`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/champion`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/scorers`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${SITE_URL}/players`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE_URL}/simulation`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
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
    // Los partidos del Mundial pesan más durante el torneo
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
