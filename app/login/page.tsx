import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'
import { Trophy } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Iniciar sesión | World Cup Predictor',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30">
            <Trophy className="h-7 w-7 text-emerald-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">World Cup Predictor</h1>
            <p className="text-sm text-zinc-500">FIFA 2026 · Motor de predicción</p>
          </div>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-zinc-600">
          Motor de análisis deportivo · Modelo v1.0.0
        </p>
      </div>
    </div>
  )
}
