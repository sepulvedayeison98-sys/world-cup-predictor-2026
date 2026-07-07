import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Registra un fallo de sincronización en sync_logs (Semana 1 · vigilancia).
 * Antes los errores solo iban a console.error y los fallos pasaban
 * inadvertidos por días. Nunca lanza: un fallo del log no debe tumbar
 * la ruta que lo llama.
 */
export async function logSyncError(
  source: string,
  entityType: string,
  err: unknown,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('sync_logs').insert({
      source,
      entity_type: entityType,
      status: 'error',
      records_processed: 0,
      records_failed: 1,
      error_message: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      metadata: JSON.parse(JSON.stringify(metadata)),
    })
  } catch (logErr) {
    console.error('[logSyncError] no se pudo registrar:', logErr)
  }
}
