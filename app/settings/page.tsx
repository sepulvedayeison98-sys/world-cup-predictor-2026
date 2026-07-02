import type { Metadata } from 'next'
import { MODEL_VERSION } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Información | World Cup Predictor',
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Acerca de
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Información</h1>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">World Cup Predictor 2026</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Plataforma de análisis y predicción para el Mundial FIFA 2026.
            Las predicciones se generan con un modelo híbrido de 5 factores ponderados
            (xG y capacidad ofensiva 40%, ELO 25%, forma reciente 15%, mercado de
            apuestas 10% y lesiones/bajas 10%) resuelto sobre una distribución de
            Poisson de goles esperados.
          </p>
          <p className="text-xs text-zinc-500">Modelo v{MODEL_VERSION} · Acceso libre</p>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Aviso importante</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Las probabilidades mostradas son estimaciones estadísticas con fines informativos.
            No constituyen asesoramiento financiero ni garantía de resultados.
            Si decides apostar, hazlo de forma responsable y solo con lo que puedas permitirte perder.
          </p>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Tema</h2>
          <p className="text-sm text-zinc-400">
            Usa el botón de sol/luna en la barra superior para alternar entre modo claro y oscuro.
          </p>
        </div>
      </div>
    </div>
  )
}
