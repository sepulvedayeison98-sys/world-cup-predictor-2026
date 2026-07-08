/**
 * Versión en tiempo real del componente UpcomingMatchesWidget
 * Utiliza el hook useRealtimeMatches para mantener los datos sincronizados
 */

'use client'

import Link from 'next/link'
import { useRealtimeMatches } from '@/hooks/useRealtimeMatches'
import { MatchCard } from '@/components/matches/MatchCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UpcomingMatchesWidgetRealtime() {
  const { matches, isLive, isLoading } = useRealtimeMatches({ limit: 6 })

  return (
    <Card className="relative">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Próximos Partidos
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Con predicciones del motor</span>
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full',
            isLive
              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              : 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/20'
          )}>
            <Radio className={cn('h-2.5 w-2.5', isLive && 'animate-pulse')} />
            {isLive ? 'En Vivo' : 'Actualización manual'}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))
          ) : matches.length > 0 ? (
            matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))
          ) : (
            // Q8: el vacío explica qué pasó, qué viene y ofrece una acción
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-6 text-center">
              <p className="text-sm font-medium text-zinc-300">
                No hay partidos en las próximas horas
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                La actividad regresa con la próxima fecha del calendario.
              </p>
              <div className="mt-3 flex justify-center gap-4 text-xs font-semibold">
                <Link href="/matches" className="text-emerald-400 hover:text-emerald-300">
                  Ver agenda completa →
                </Link>
                <Link href="/ligas" className="text-zinc-400 hover:text-zinc-200">
                  Explorar ligas →
                </Link>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
