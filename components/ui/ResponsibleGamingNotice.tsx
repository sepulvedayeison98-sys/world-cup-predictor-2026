import { ShieldAlert } from 'lucide-react'

interface Props {
  /** Cuotas del partido; se usa para describir con precisión su origen */
  odds?: { bookmaker?: string }[]
}

export function ResponsibleGamingNotice({ odds }: Props) {
  const hasReal = (odds ?? []).some(o => o.bookmaker === 'Pinnacle')
  const hasDerived = (odds ?? []).some(o => o.bookmaker && o.bookmaker !== 'Pinnacle')

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 flex gap-2.5">
      <ShieldAlert className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
      <div className="space-y-1 text-[11px] leading-relaxed text-zinc-500">
        {hasReal ? (
          <p>
            Las cuotas de <span className="text-zinc-400">Pinnacle</span> son reales y en tiempo real
            {hasDerived && ' — las de casas colombianas son derivadas de la línea justa de Pinnacle (estimadas)'}.
            Verifica siempre en tu casa de apuestas antes de jugar.
          </p>
        ) : (
          <p>
            Las cuotas mostradas son de demostración y pueden no corresponder a
            mercados reales en vivo. Verifica siempre en tu casa de apuestas.
          </p>
        )}
        <p>
          Las probabilidades son estimaciones estadísticas, no garantías de
          resultado. Si decides apostar, hazlo de forma responsable, solo con
          dinero que puedas permitirte perder y únicamente si eres mayor de
          18 años (+18).
        </p>
      </div>
    </div>
  )
}
