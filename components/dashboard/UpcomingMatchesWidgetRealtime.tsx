/**
 * Versión en tiempo real del componente UpcomingMatchesWidget
 * Utiliza el hook useRealtimeMatches para mantener los datos sincronizados
 */

'use client'

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
            {isLive ? 'En Vivo' : 'Desconectado'}
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
            <p className="text-sm text-zinc-500">No hay partidos próximos.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
