'use client'

/**
 * DOMINIO TENNIS — selector de dos jugadores para el cara a cara (Fase 6).
 * Usa <datalist> nativo (autocompletado por nombre sin JS pesado) y navega
 * a /tennis/h2h?p1=&p2= con los ids resueltos. Cero dependencias externas.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface P { id: string; name: string }

export function H2HPicker({ players, initial1, initial2 }: {
  players: P[]; initial1?: string; initial2?: string
}) {
  const router = useRouter()
  const nameOf = (id?: string) => players.find((p) => p.id === id)?.name ?? ''
  const [a, setA] = useState(nameOf(initial1))
  const [b, setB] = useState(nameOf(initial2))
  const [err, setErr] = useState('')

  const resolve = (name: string) =>
    players.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())

  const go = () => {
    const p1 = resolve(a), p2 = resolve(b)
    if (!p1 || !p2) { setErr('Elige dos jugadores de la lista.'); return }
    if (p1.id === p2.id) { setErr('Elige dos jugadores distintos.'); return }
    setErr('')
    router.push(`/tennis/h2h?p1=${p1.id}&p2=${p2.id}`)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
        <input
          list="tennis-players" value={a} onChange={(e) => setA(e.target.value)}
          placeholder="Jugador 1" aria-label="Jugador 1"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500/50 focus:outline-none"
        />
        <span className="hidden text-center text-xs font-bold text-zinc-600 sm:block">vs</span>
        <input
          list="tennis-players" value={b} onChange={(e) => setB(e.target.value)}
          placeholder="Jugador 2" aria-label="Jugador 2"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-lime-500/50 focus:outline-none"
        />
        <button
          onClick={go}
          className="rounded-lg border border-lime-500/40 bg-lime-500/15 px-4 py-2 text-sm font-semibold text-lime-300 transition-colors hover:bg-lime-500/25"
        >
          Comparar
        </button>
      </div>
      <datalist id="tennis-players">
        {players.map((p) => <option key={p.id} value={p.name} />)}
      </datalist>
      {err && <p className="mt-2 text-xs text-amber-400">{err}</p>}
    </div>
  )
}
