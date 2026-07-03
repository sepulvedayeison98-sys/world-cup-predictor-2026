/**
 * Hook personalizado para suscribirse a cambios en tiempo real de apuestas de valor.
 * Mantiene la lista de apuestas de valor sincronizada.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ValueBet } from '@/types'

// La query solo embebe un resumen del partido (no el Match completo)
type ValueBetRow = Omit<ValueBet, 'match'> & {
  match: {
    kickoff_time: string
    home_team: { code: string } | null
    away_team: { code: string } | null
  } | null
}

interface UseRealtimeValueBetsOptions {
  limit?: number
}

export function useRealtimeValueBets({ limit = 5 }: UseRealtimeValueBetsOptions) {
  const supabase = createClient()
  const [valueBets, setValueBets] = useState<ValueBetRow[]>([])
  const [totalUpcoming, setTotalUpcoming] = useState(0)
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchValueBets = useCallback(async () => {
    try {
      setIsLoading(true)
      // Traemos las apuestas de valor activas (alto/medio) con la fecha del
      // partido y filtramos a PRÓXIMOS partidos en el cliente (PostgREST no
      // filtra fácil por columna de la tabla embebida). Mostramos las de MEJOR
      // EV primero y exponemos el total de oportunidades próximas.
      const { data, error } = await supabase
        .from('value_bets')
        .select(`
          *,
          match:matches(kickoff_time, home_team:teams!home_team_id(code), away_team:teams!away_team_id(code))
        `)
        .eq('is_active', true)
        .in('grade', ['high', 'medium'])
        .order('expected_value', { ascending: false })
        .limit(300)

      if (error) throw error
      const nowMs = Date.now()
      const upcoming = (data ?? [])
        .filter((b: any) => b.match?.kickoff_time && new Date(b.match.kickoff_time).getTime() > nowMs)
        .sort((a: any, b: any) => (b.expected_value ?? 0) - (a.expected_value ?? 0))
      setTotalUpcoming(upcoming.length)
      setValueBets(upcoming.slice(0, limit) as unknown as ValueBetRow[])
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

  return { valueBets, totalUpcoming, isLive, isLoading }
}
