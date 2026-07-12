'use client'

import dynamic from 'next/dynamic'

/**
 * Carga diferida del radar de jugador (dieta de bundle). PlayerRadarChart
 * usa Recharts (~pesado); con dynamic + ssr:false, Recharts sale del bundle
 * inicial de /players/[id] y se descarga solo cuando el gráfico entra en
 * pantalla. El wrapper cliente es necesario porque la página es un Server
 * Component (no puede usar ssr:false directamente).
 */
export const PlayerRadarChartLazy = dynamic(
  () => import('./PlayerRadarChart').then((m) => m.PlayerRadarChart),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-zinc-900" />,
  },
)
