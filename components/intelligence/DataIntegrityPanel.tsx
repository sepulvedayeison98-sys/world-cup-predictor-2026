'use client'

import { CheckCircle, XCircle, AlertTriangle, ShieldCheck, Zap, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { runChiefAnalystAgent, type ChiefAnalystReport } from '@/lib/agents/chiefAnalystAgent'
import { runMarketMovementAgent } from '@/lib/agents/marketMovementAgent'
import { ReliabilityIndicator } from './ReliabilityIndicator'
import { ModelComparisonTable } from './ModelComparisonTable'
import { RISK_COLOR } from '@/lib/agents/riskAssessmentAgent'

interface Props {
  prediction: any | null
  homeStats: any | null
  awayStats: any | null
  match: any
  injuries: any[]
  odds: any[]
}

const FIELD_LABEL: Record<string, string> = {
  elo:            'ELO Rating',
  xg:             'xG / xGA',
  form:           'Forma reciente',
  odds:           'Cuotas',
  injuries:       'Lesiones',
  advanced_stats: 'Estadísticas avanzadas',
}

export function DataIntegrityPanel({ prediction, homeStats, awayStats, match, injuries, odds }: Props) {
  const report: ChiefAnalystReport = runChiefAnalystAgent({
    prediction, homeStats, awayStats, match, injuries, odds,
  })
  const mktReport = runMarketMovementAgent({ odds, prediction })

  const { dataIntegrity, predictionEngine, riskAssessment } = report
  const homeCode = match?.home_team?.code ?? 'LOC'
  const awayCode = match?.away_team?.code ?? 'VIS'
  const riskCfg  = RISK_COLOR[riskAssessment.level]

  const ALIGN_COLOR: Record<string, string> = {
    fuerte:    'text-emerald-400',
    moderado:  'text-amber-400',
    débil:     'text-red-400',
    sin_datos: 'text-zinc-500',
  }

  return (
    <div className="space-y-5">

      {/* Resumen ejecutivo */}
      <div className="card p-4 border-l-2 border-l-emerald-500">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Resumen del Chief Analyst</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{report.executiveSummary}</p>
          </div>
        </div>
        {report.topInsights.length > 0 && (
          <ul className="mt-3 space-y-1 pl-6">
            {report.topInsights.map((insight, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <Zap className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-400">{insight}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fiabilidad del dato */}
      <div className="card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Integridad del Dataset
        </h3>
        <ReliabilityIndicator score={dataIntegrity.score} tier={dataIntegrity.tier} />

        {/* Campos presentes / ausentes */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {Object.entries(dataIntegrity.fieldsPresent).map(([field, present]) => (
            <div key={field} className="flex items-center gap-1.5">
              {present
                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                : <XCircle    className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
              }
              <span className={cn('text-[11px]', present ? 'text-zinc-300' : 'text-zinc-600')}>
                {FIELD_LABEL[field] ?? field}
              </span>
            </div>
          ))}
        </div>

        {/* Antigüedad de datos */}
        {Object.keys(dataIntegrity.dataAgeHours).length > 0 && (
          <div className="border-t border-zinc-800 pt-2 space-y-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Antigüedad del dato</p>
            {Object.entries(dataIntegrity.dataAgeHours).map(([source, hours]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 capitalize">{source}</span>
                <span className={cn(
                  'text-[11px] mono font-medium',
                  hours < 12 ? 'text-emerald-400' : hours < 48 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {hours < 1 ? `${Math.round(hours * 60)}min` : `${hours.toFixed(0)}h`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recomendaciones */}
        {dataIntegrity.recommendations.length > 0 && (
          <div className="border-t border-zinc-800 pt-2 space-y-1">
            {dataIntegrity.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-500/60 shrink-0 mt-0.5" />
                <span className="text-[10px] text-zinc-600">{rec}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparador de modelos */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Comparador Multi-Modelo
          </h3>
          <span className="text-[10px] text-zinc-600">
            Acuerdo: {(predictionEngine.agreement * 100).toFixed(0)}%
          </span>
        </div>
        <ModelComparisonTable
          models={predictionEngine.models}
          homeCode={homeCode}
          awayCode={awayCode}
        />
      </div>

      {/* Señal de mercado */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Señal de Mercado</h3>
          </div>
          {mktReport.summary.signal !== 'sin_datos' && (
            <span className={cn('text-[10px] font-bold uppercase', ALIGN_COLOR[mktReport.alignment])}>
              {mktReport.alignment}
            </span>
          )}
        </div>

        {mktReport.summary.signal === 'sin_datos' ? (
          <p className="text-[11px] text-zinc-600">Sin datos de cuotas disponibles.</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-bold', mktReport.summary.signalColor)}>
                {mktReport.summary.signalLabel}
              </span>
              <span className="text-[10px] text-zinc-600">
                {mktReport.summary.bookmakerCount} casas · Consenso {Math.round(mktReport.summary.consensusStrength * 100)}%
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">{mktReport.alignmentNote}</p>

            {mktReport.valueDiscrepancies.length > 0 && (
              <div className="space-y-1 border-t border-zinc-800 pt-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Modelo vs Mercado</p>
                {mktReport.valueDiscrepancies.map((d) => (
                  <div key={d.outcome} className="flex items-center gap-1.5">
                    {d.edge > 0
                      ? <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                      : <ArrowDownRight className="h-3 w-3 text-red-400" />
                    }
                    <span className="text-[10px] text-zinc-400 flex-1">
                      {d.outcome === 'home' ? homeCode : d.outcome === 'away' ? awayCode : 'X'}
                      {' '}· Modelo {Math.round(d.modelProb * 100)}% vs Mercado {Math.round(d.marketProb * 100)}%
                    </span>
                    <span className={cn('text-[10px] mono font-bold', d.edge > 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {d.edge > 0 ? '+' : ''}{(d.edge * 100).toFixed(1)}pp
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Evaluación de riesgo */}
      <div className={cn('card p-4 border', riskCfg.border, riskCfg.bg)}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Evaluación de Riesgo
          </h3>
          <span className={cn('text-xs font-bold uppercase', riskCfg.text)}>
            {riskAssessment.level}
          </span>
        </div>

        <p className={cn('text-[11px] leading-relaxed mb-3', riskCfg.text)}>
          {riskAssessment.summary}
        </p>

        {riskAssessment.anomalies.length > 0 && (
          <div className="space-y-1 mb-2">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Anomalías</p>
            {riskAssessment.anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-400">{a}</span>
              </div>
            ))}
          </div>
        )}

        {riskAssessment.hiddenRisks.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Riesgos latentes</p>
            {riskAssessment.hiddenRisks.map((r, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-zinc-400">{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fuentes */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-700">
        <span>Fuentes:</span>
        {dataIntegrity.sourcesUsed.map((s, i) => (
          <span key={i} className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">{s}</span>
        ))}
      </div>
    </div>
  )
}
