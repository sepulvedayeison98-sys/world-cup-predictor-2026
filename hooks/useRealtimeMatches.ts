'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const COMPETITION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

interface Options {
  limit?: number
  competitionId?: string
}

/**
 * useRealtimeMatches
 *
 * Trae los próximos partidos (con equipos y predicción embebida) y se mantiene
 * sincronizado vía Supabase Realtime. Devuelve { matches, isLive, isLoading }.
 */
export function useRealtimeMatches({ limit = 6, competitionId = COMPETITION_ID }: Options = {}) {
  const supabase = createClient()
  const [matches, setMatches] = useState<any[]>([])
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMatches = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('matches')
        .select(
          '*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), predictions(*)'
        )
        .eq('competition_id', competitionId)
        .in('status', ['scheduled', 'live'])
        .gte('kickoff_time', since)
        .order('kickoff_time', { ascending: true })
        .limit(limit)

      if (error) throw error
      setMatches(data ?? [])
    } catch (err) {
      console.error('Error cargando próximos partidos:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, competitionId, limit])

  useEffect(() => {
    fetchMatches()
    setIsLive(true)

    const channel = supabase
      .channel('realtime:upcoming-matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `competition_id=eq.${competitionId}` },
        () => fetchMatches()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions' },
        () => fetchMatches()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      setIsLive(false)
    }
  }, [supabase, competitionId, fetchMatches])

  return { matches, isLive, isLoading }
}

/**
 * useLiveMatch — suscripción ligera a un único partido en tiempo real.
 * Invalida las queries de React Query del partido cuando cambia.
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
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['match', matchId] })
          queryClient.invalidateQueries({ queryKey: ['match-stats', matchId] })
          onUpdate?.(payload)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_statistics', filter: `match_id=eq.${matchId}` },
        () => queryClient.invalidateQueries({ queryKey: ['match-stats', matchId] })
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId, queryClient, onUpdate])
}
