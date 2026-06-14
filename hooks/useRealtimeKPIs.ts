/**
 * Hook personalizado para suscribirse a cambios en tiempo real de los KPIs del Dashboard
 * Utiliza Supabase Realtime para mantener los datos sincronizados sin recargar la página
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DashboardKPIs } from '@/types'

interface UseRealtimeKPIsOptions {
  initialKPIs: DashboardKPIs
  competitionId?: string
}

export function useRealtimeKPIs({ initialKPIs, competitionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }: UseRealtimeKPIsOptions) {
  const supabase = createClient()
  const [kpis, setKPIs] = useState<DashboardKPIs>(initialKPIs)
  const [isLive, setIsLive] = useState(false)

  // Función para recalcular KPIs basándose en cambios específicos
  const updateKPIsFromPayload = useCallback(async (table: string, payload: any) => {
    // Para optimizar, solo re-fetch los datos que realmente cambiaron
    try {
      if (table === 'matches') {
        // Actualiza el conteo de partidos analizados
        const { count: totalMatches } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', competitionId)

        const { count: analyzedMatches } = await supabase
          .from('predictions')
          .select('*', { count: 'exact', head: true })
          .eq('is_published', true)

        setKPIs(prev => ({
          ...prev,
          total_matches: totalMatches ?? 0,
          analyzed_matches: analyzedMatches ?? 0,
        }))
      }

      if (table === 'value_bets') {
        // Actualiza los picks activos y apuestas de valor
        const { data: valueBets } = await supabase
          .from('value_bets')
          .select('*')
          .eq('is_active', true)
          .in('grade', ['high', 'medium'])

        const pending = valueBets?.filter(b => b.result === 'pending').length ?? 0
        const won = valueBets?.filter(b => b.result === 'won').length ?? 0

        setKPIs(prev => ({
          ...prev,
          active_picks: valueBets?.length ?? 0,
          value_bets_detected: valueBets?.length ?? 0,
          value_bets_pending: pending,
          value_bets_won: won,
        }))
      }

      if (table === 'predictions') {
        // Actualiza la precisión y predicciones correctas
        const { data: predictions } = await supabase
          .from('predictions')
          .select('was_correct')
          .not('was_correct', 'is', null)

        const correctPredictions = predictions?.filter(p => p.was_correct).length ?? 0
        const totalPredictions = predictions?.length ?? 0
        const accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0

        setKPIs(prev => ({
          ...prev,
          correct_predictions: correctPredictions,
          total_predictions: totalPredictions,
          historical_accuracy: accuracy,
        }))
      }
    } catch (error) {
      console.error(`Error actualizando KPIs desde tabla ${table}:`, error)
    }
  }, [supabase, competitionId])

  useEffect(() => {
    setIsLive(true)

    // Suscribirse a cambios en la tabla 'matches'
    const matchesChannel = supabase
      .channel('dashboard:matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          console.log('Cambio en matches:', payload)
          updateKPIsFromPayload('matches', payload)
        }
      )
      .subscribe()

    // Suscribirse a cambios en la tabla 'predictions'
    const predictionsChannel = supabase
      .channel('dashboard:predictions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'predictions' },
        (payload) => {
          console.log('Cambio en predictions:', payload)
          updateKPIsFromPayload('predictions', payload)
        }
      )
      .subscribe()

    // Suscribirse a cambios en la tabla 'value_bets'
    const valueBetsChannel = supabase
      .channel('dashboard:value_bets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'value_bets' },
        (payload) => {
          console.log('Cambio en value_bets:', payload)
          updateKPIsFromPayload('value_bets', payload)
        }
      )
      .subscribe()

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      supabase.removeChannel(matchesChannel)
      supabase.removeChannel(predictionsChannel)
      supabase.removeChannel(valueBetsChannel)
      setIsLive(false)
    }
  }, [supabase, updateKPIsFromPayload])

  return { kpis, isLive }
}
