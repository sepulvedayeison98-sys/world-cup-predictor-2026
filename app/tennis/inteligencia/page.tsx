import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchLatestBacktest } from '@/services/tennis/queries'
import { StatCard, shortDate } from '@/components/tennis/ui'

export const metadata: Metadata = {
  title: 'Inteligencia Tenis | Veredicto',
  description: 'Métricas medidas del motor tennis-1.0: precisión, Brier y log-loss del backtest walk-forward, comparadas con la línea base de ranking.',
}

export const revalidate = 600

const pct = (v: number | null | undefined) => (v != null ? `${(v * 100).toFixed(2)}%` : '—')
const num = (v: number | null | undefined, d = 3) => (v != null ? v.toFixed(d) : '—')

export default async function TennisIntelligencePage() {
  const bt = await fetchLatestBacktest('ATP')
  const base = bt?.metadata?.baseline as { sample?: number; accuracy?: number; modelAccuracyOnSample?: number } | undefined
  const warm = bt?.metadata?.warmed_up as { sample?: number; accuracy?: number; brier?: number } | undefined
  const noVerdict = bt?.metadata?.no_verdict as number | undefined

  const beatsRanking = base?.modelAccuracyOnSample != null && base?.accuracy != null
    ? base.modelAccuracyOnSample >= base.accuracy : null

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/tennis" className="text-xs font-semibold uppercase tracking-widest text-lime-500 hover:text-lime-400">← Tenis</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Inteligencia · motor tennis-1.0</h1>
        <p className="text-sm text-zinc-400">
          Números <span className="text-zinc-200">medidos, no prometidos</span>. Backtest
          walk-forward: para cada partido el motor predice con lo conocido hasta
          ese momento y solo después incorpora el resultado — cero fuga.
          {bt?.date_from && bt?.date_to && (
            <> Ventana: {shortDate(bt.date_from)} – {shortDate(bt.date_to)}.</>
          )}
        </p>
      </div>

      {!bt ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-10 text-center text-sm text-zinc-400">
          Aún no hay una corrida de backtest registrada.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Precisión" value={pct(bt.accuracy)} hint={`${bt.sample_size.toLocaleString('es-ES')} veredictos · azar 50%`} accent />
            <StatCard label="Brier (2 clases)" value={num(bt.brier_score)} hint="azar 0,500 · menor es mejor" />
            <StatCard label="Log-loss" value={num(bt.log_loss)} hint="azar 0,693 · menor es mejor" />
            <StatCard label="Sin veredicto" value={noVerdict != null ? noVerdict.toLocaleString('es-ES') : '—'} hint="debutantes: no se inventa 50/50" />
          </div>

          {/* Comparación honesta contra la línea base de ranking */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Motor vs. ranking puro</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-sm text-zinc-400">
                Sobre el mismo subconjunto donde ambos jugadores tienen ranking
                oficial ({base?.sample?.toLocaleString('es-ES') ?? '—'} partidos),
                comparamos el motor contra la regla ingenua
                <span className="text-zinc-300"> «gana el mejor clasificado»</span>:
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">Motor tennis-1.0</p>
                  <p className="mt-1 text-2xl font-bold text-lime-400 mono">{pct(base?.modelAccuracyOnSample)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500">Línea base (ranking)</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-300 mono">{pct(base?.accuracy)}</p>
                </div>
              </div>
              <p className={`mt-4 rounded-lg border px-3 py-2 text-xs ${beatsRanking ? 'border-lime-500/30 bg-lime-500/10 text-lime-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                {beatsRanking === null ? 'Comparación no disponible.'
                  : beatsRanking
                    ? 'El motor supera al ranking puro en precisión sobre este subconjunto.'
                    : 'Hallazgo honesto: en precisión cruda el motor aún NO supera al ranking puro. Sí bate al azar en Brier y log-loss (calidad probabilística, clave para valor esperado). Cerrar esta brecha es la línea de trabajo de tennis-1.1 (arranque en frío del ELO con pocas temporadas, peso de la forma, calibración por superficie).'}
              </p>
            </div>
          </section>

          {warm?.sample ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Jugadores con historial maduro</h2>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">
                  Restringido a partidos donde ambos jugadores acumulan ≥5 encuentros
                  previos vistos por el modelo ({warm.sample.toLocaleString('es-ES')} partidos):
                </p>
                <div className="mt-3 flex gap-6">
                  <div><span className="text-[11px] uppercase tracking-wider text-zinc-500">Precisión</span><p className="mt-1 text-xl font-bold text-white mono">{pct(warm.accuracy)}</p></div>
                  <div><span className="text-[11px] uppercase tracking-wider text-zinc-500">Brier</span><p className="mt-1 text-xl font-bold text-white mono">{num(warm.brier)}</p></div>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      <p className="text-[11px] text-zinc-600">
        Modelo <span className="mono">{bt?.model_version ?? 'tennis-1.0'}</span> · fuente TML-Database
        (CC BY-NC-SA). Sin cuotas de tenis todavía: ROI/yield no se calculan (no se
        fabrican). Métricas persistidas en <span className="mono">tennis_backtests</span>.
      </p>
    </div>
  )
}
