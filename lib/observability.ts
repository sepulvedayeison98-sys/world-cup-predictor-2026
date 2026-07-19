/**
 * Observabilidad del sistema (Fase B del Plan Maestro): escritores de las tablas
 * `model_registry` (versionado + métricas del modelo) y `data_health` (salud de
 * las fuentes de datos), que hasta ahora existían pero no se poblaban.
 *
 * Regla de oro de este módulo: NUNCA lanza. Un fallo de observabilidad jamás
 * debe tumbar el sync o la recalibración que lo invoca (mismo patrón que
 * lib/syncLog.ts). Es puramente aditivo: no cambia ninguna predicción.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface ModelMetrics {
  accuracy_1x2?: number | null
  brier_score?: number | null
  correct_predictions?: number | null
  predictions_evaluated?: number | null
  mae_goals?: number | null
}

/**
 * Registra/actualiza las métricas de una versión del modelo en `model_registry`.
 * Idempotente por (model_name, version): actualiza si ya existe, inserta si no.
 * Fail-open.
 */
export async function recordModelRegistry(
  modelName: string,
  version: string,
  metrics: ModelMetrics,
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const row = {
      model_name: modelName,
      version,
      accuracy_1x2: metrics.accuracy_1x2 ?? null,
      brier_score: metrics.brier_score ?? null,
      correct_predictions: metrics.correct_predictions ?? null,
      predictions_evaluated: metrics.predictions_evaluated ?? null,
      mae_goals: metrics.mae_goals ?? null,
      last_evaluated_at: new Date().toISOString(),
    }
    const { data: existing } = await supabase
      .from('model_registry').select('id')
      .eq('model_name', modelName).eq('version', version).maybeSingle()
    if (existing?.id) {
      await supabase.from('model_registry').update(row).eq('id', existing.id)
    } else {
      await supabase.from('model_registry').insert(row)
    }
  } catch (err) {
    console.error('[observability] model_registry (no bloqueante):', err)
  }
}

export interface DataHealthUpdate {
  ok: boolean
  latencyMs?: number | null
  coveragePct?: number | null
  error?: unknown
}

/**
 * Registra la salud de una fuente de datos en `data_health` (upsert por source).
 * En éxito refresca `last_ok_at`; en fallo `last_error_at` + `error_rate`.
 * Fail-open.
 */
export async function recordDataHealth(source: string, update: DataHealthUpdate): Promise<void> {
  try {
    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const common = {
      source,
      latency_ms: update.latencyMs ?? null,
      coverage_pct: update.coveragePct ?? null,
      updated_at: now,
    }
    // Se registra solo la marca temporal correspondiente: en fallo NO se pisa
    // last_ok_at (el upsert solo actualiza las columnas provistas).
    if (update.ok) {
      await supabase.from('data_health').upsert(
        { ...common, error_rate: 0, last_ok_at: now }, { onConflict: 'source' })
    } else {
      await supabase.from('data_health').upsert(
        { ...common, error_rate: 1, last_error_at: now }, { onConflict: 'source' })
    }
  } catch (err) {
    console.error('[observability] data_health (no bloqueante):', err)
  }
}
