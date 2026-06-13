'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * useRealtimeMatches
 *
 * Subscribes to Supabase Realtime for match updates.
 * Automatically invalidates React Query caches when data changes.
 *
 * Usage:
 *   useRealtimeMatches({ competitionId: 'xxx' })
 */
interface Options {
  competitionId: string
  onMatchUpdate?: (payload: any) => void
  onPredictionUpdate?: (payload: any) => void
}

export function useRealtimeMatches({
  competitionId,
  onMatchUpdate,
  onPredictionUpdate,
}: Options) {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  const invalidateMatches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['matches'] })
    queryClient.invalidateQueries({ queryKey: ['upcoming-matches'] })
  }, [queryClient])

  const invalidatePredictions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prediction'] })
    queryClient.invalidateQueries({ queryKey: ['prediction-history'] })
  }, [queryClient])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`realtime:${competitionId}`)

      // Match score / status changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `competition_id=eq.${competitionId}`,
        },
        (payload) => {
          invalidateMatches()
          // Invalidate specific match
          if (payload.new?.id) {
            queryClient.invalidateQueries({ queryKey: ['match', payload.new.id] })
          }
          onMatchUpdate?.(payload)
        }
      )

      // Prediction probability updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
        },
        (payload) => {
          invalidatePredictions()
          onPredictionUpdate?.(payload)
        }
      )

      // New value bets
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'value_bets',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['value-bets'] })
        }
      )

      // Injury updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'injuries',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['players'] })
          queryClient.invalidateQueries({ queryKey: ['injuries'] })
        }
      )

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug('[Realtime] Subscribed to competition:', competitionId)
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error — will attempt reconnect')
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [competitionId, queryClient, invalidateMatches, invalidatePredictions, onMatchUpdate, onPredictionUpdate])

  return {
    unsubscribe: () => {
      if (channelRef.current) {
        createClient().removeChannel(channelRef.current)
      }
    },
  }
}

/**
 * useLiveMatch
 *
 * Lightweight hook for subscribing to a single match in real-time.
 */
export function useLiveMatch(matchId: string, onUpdate?: (payload: any) => void) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!matchId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['match', matchId] })
          queryClient.invalidateQueries({ queryKey: ['match-stats', matchId] })
          onUpdate?.(payload)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_statistics',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['match-stats', matchId] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId, queryClient, onUpdate])
}
