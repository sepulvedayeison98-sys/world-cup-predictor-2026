import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/settings/SettingsForm'

export const metadata: Metadata = {
  title: 'Configuración | World Cup Predictor',
}

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Cuenta y preferencias
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Configuración</h1>
      </div>
      <SettingsForm user={user} profile={profile} />
    </div>
  )
}
