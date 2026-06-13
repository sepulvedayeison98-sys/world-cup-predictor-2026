'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { User, Bell, Shield, LogOut, Loader2, Check } from 'lucide-react'

interface Props {
  user: any
  profile: any
}

export function SettingsForm({ user, profile }: Props) {
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const saveProfile = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id)
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const Section = ({ icon: Icon, title, children, color = 'text-emerald-400' }: any) => (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <Icon className={cn('h-4 w-4', color)} />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  )

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )

  return (
    <div className="max-w-2xl space-y-4">

      {/* Profile */}
      <Section icon={User} title="Perfil">
        <Field label="Email">
          <input
            disabled
            value={user.email ?? ''}
            className="w-full rounded-lg bg-zinc-800/50 border border-zinc-800 px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
          />
        </Field>
        <Field label="Nombre completo">
          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Tu nombre"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 outline-none transition-colors"
          />
        </Field>
        <Field label="Rol">
          <span className={cn(
            'inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold border',
            profile?.role === 'admin'   ? 'text-red-400 bg-red-500/10 border-red-500/20' :
            profile?.role === 'analyst' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' :
            'text-zinc-400 bg-zinc-800 border-zinc-700'
          )}>
            {profile?.role ?? 'user'}
          </span>
        </Field>
        {error && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{error}</p>
        )}
        <button
          onClick={saveProfile}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> :
           saved  ? <Check className="h-4 w-4" /> : null}
          {saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notificaciones" color="text-amber-400">
        {[
          { key: 'notifications',     label: 'Notificaciones generales' },
          { key: 'lineup_alerts',     label: 'Alertas de alineaciones oficiales' },
          { key: 'value_bet_alerts',  label: 'Alertas de apuestas de valor' },
          { key: 'injury_alerts',     label: 'Alertas de lesiones de última hora' },
        ].map(opt => (
          <div key={opt.key} className="flex items-center justify-between py-1">
            <span className="text-sm text-zinc-300">{opt.label}</span>
            <button
              className={cn(
                'relative h-5 w-9 rounded-full border transition-colors',
                profile?.preferences?.[opt.key] !== false
                  ? 'bg-emerald-500/20 border-emerald-500/30'
                  : 'bg-zinc-800 border-zinc-700'
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full transition-transform',
                profile?.preferences?.[opt.key] !== false
                  ? 'translate-x-4 bg-emerald-400'
                  : 'translate-x-0.5 bg-zinc-500'
              )} />
            </button>
          </div>
        ))}
      </Section>

      {/* Model config (analysts/admins only) */}
      {profile?.role && ['admin', 'analyst'].includes(profile.role) && (
        <Section icon={Shield} title="Motor de Predicción" color="text-violet-400">
          <p className="text-xs text-zinc-500">
            Los pesos del modelo se configuran por partido desde el endpoint{' '}
            <code className="mono text-[11px] bg-zinc-800 px-1.5 py-0.5 rounded text-violet-400">
              POST /api/predictions
            </code>
          </p>
          <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
            <p className="text-[10px] text-zinc-600 mb-1">Ejemplo de request</p>
            <pre className="text-[10px] mono text-zinc-400 overflow-x-auto">{`{
  "match_id": "uuid",
  "publish": true,
  "weights": {
    "form": 0.20,
    "squadQuality": 0.15,
    "elo": 0.10
    // ...resto de pesos
  }
}`}</pre>
          </div>
          <p className="text-[10px] text-zinc-600">
            Versión actual del modelo:{' '}
            <span className="text-violet-400 mono font-semibold">v1.0.0</span>
          </p>
        </Section>
      )}

      {/* Danger zone */}
      <Section icon={LogOut} title="Sesión" color="text-red-400">
        <button
          onClick={signOut}
          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </Section>
    </div>
  )
}
