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
      const { data, error } = await supabase
        .from('value_bets')
        .select(`
          *,
          match:matches(home_team:teams!home_team_id(code), away_team:teams!away_team_id(code))
        `)
        .eq('is_active', true)
        .in('grade', ['high', 'medium'])
        .order('expected_value', { ascending: false })
        .limit(limit)

      if (error) throw error
      setValueBets(data ?? [])
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
