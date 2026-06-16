/**
 * Hook personalizado para suscribirse a cambios en tiempo real de apuestas de valor.
 * Mantiene la lista de apuestas de valor sincronizada.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ValueBet } from '@/types'

interface UseRealtimeValueBetsOptions {
  limit?: number
}

export function useRealtimeValueBets({ limit = 5 }: UseRealtimeValueBetsOptions) {
  const supabase = createClient()
  const [valueBets, setValueBets] = useState<ValueBet[]>([])
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchValueBets = useCallback(async () => {
    try {
      setIsLoading(true)
      // Traemos más de la cuenta y filtramos a próximos partidos en el cliente
      // (PostgREST no filtra fácil por columna de la tabla embebida).
      const { data, error } = await supabase
        .from('value_bets')
        .select(`
          *,
          match:matches(kickoff_time, home_team:teams!home_team_id(code), away_team:teams!away_team_id(code))
        `)
        .eq('is_active', true)
        .in('grade', ['high', 'medium'])
        .order('expected_value', { ascending: false })
        .limit(Math.max(limit * 8, 40))

      if (error) throw error
      const nowMs = Date.now()
      const upcoming = (data ?? [])
        .filter((b: any) => b.match?.kickoff_time && new Date(b.match.kickoff_time).getTime() > nowMs)
        .sort((a: any, b: any) => {
          const ta = new Date(a.match.kickoff_time).getTime()
          const tb = new Date(b.match.kickoff_time).getTime()
          if (ta !== tb) return ta - tb
          return (b.expected_value ?? 0) - (a.expected_value ?? 0)
        })
        .slice(0, limit)
      setValueBets(upcoming)
    } catch (error) {
      console.error('Error cargando apuestas de valor:', error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, limit])

  useEffect(() => {
    fetchValueBets()

    setIsLive(true)

    const valueBetsChannel = supabase
      .channel('realtime:value_bets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'value_bets' },
        (payload) => {
          console.log('Cambio en value_bets:', payload)
          fetchValueBets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(valueBetsChannel)
      setIsLive(false)
    }
  }, [supabase, fetchValueBets])

  return { valueBets, isLive, isLoading }
}
