import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con SERVICE ROLE (bypassa RLS).
 * SOLO para uso en servidor (rutas /api/sync, cron). NUNCA importar en
 * componentes cliente: expondria la clave secreta.
 *
 * Requiere las env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (panel Supabase -> Settings -> API -> service_role)
 */
let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno. ' +
      'Agregalas a .env.local (y a Vercel) para que el sync pueda escribir.'
    )
  }

  if (cached) return cached
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
