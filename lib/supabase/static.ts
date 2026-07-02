import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase para Server Components públicos SIN cookies.
 * Al no tocar cookies(), la página puede usar ISR (`export const revalidate`)
 * en lugar de renderizarse dinámicamente en cada visita.
 * La app no tiene autenticación, así que no se pierde nada.
 */
export const createStaticSupabaseClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
