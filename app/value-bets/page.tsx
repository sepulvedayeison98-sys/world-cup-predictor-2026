import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ValueBetsFullTable } from '@/components/predictions/ValueBetsFullTable'

export const metadata: Metadata = {
  title: 'Apuestas de Valor | World Cup Predictor',
}

export default async function ValueBetsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bets } = await supabase
    .from('value_bets')
    .select(`
      *,
      match:matches(
        kickoff_time, venue, city, status,
        home_team:teams!matches_home_team_id_fkey(name, short_name, code),
        away_team:teams!matches_away_team_id_fkey(name, short_name, code)
      )
    `)
    .eq('is_active', true)
    .order('expected_value', { ascending: false })

  // Summary stats
  const totalEV = (bets ?? []).reduce((acc, b: any) => acc + (b.expected_value ?? 0), 0)
  const highValue = (bets ?? []).filter((b: any) => b.grade === 'high').length
  const mediumValue = (bets ?? []).filter((b: any) => b.grade === 'medium').length

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
          Motor de detección activo
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Apuestas de Valor</h1>
        <p className="text-sm text-zinc-400">
          Mercados con EV positivo detectado por el modelo
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total detectadas', value: (bets ?? []).length.toString(), color: 'text-white' },
          { label: 'Alto valor 🟢', value: highValue.toString(), color: 'text-emerald-400' },
          { label: 'Valor medio 🟡', value: mediumValue.toString(), color: 'text-amber-400' },
          { label: 'EV promedio', value: `${((totalEV / Math.max((bets ?? []).length, 1)) * 100).toFixed(1)}%`, color: 'text-violet-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <p className="text-[11px] text-zinc-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mono ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <p className="text-xs text-amber-400">
          ⚠️ Estas probabilidades son estimaciones del modelo. No constituyen asesoramiento financiero.
          Apuesta solo lo que puedas permitirte perder. El juego responsable es obligatorio.
        </p>
      </div>

      <ValueBetsFullTable bets={bets ?? []} />
    </div>
  )
}
