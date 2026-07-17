'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Trophy, Globe, Users, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTIVE_COMPETITIONS } from '@/lib/sports'

interface TeamResult {
  id: string
  name: string
  code: string
  logo_url: string | null
  href: string
  context: string
}

interface PlayerResult {
  id: string
  name: string
  country_code: string | null
  href: string
  context: string
}

/**
 * Buscador global (auditoría I7): competiciones y equipos desde cualquier
 * pantalla. Overlay sobrio — sin comandos, sin efectos; escribe y llega.
 */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [teams, setTeams] = useState<TeamResult[]>([])
  const [players, setPlayers] = useState<PlayerResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setQ('')
      setTeams([])
      setPlayers([])
      // foco al abrir
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Búsqueda de equipos y tenistas con debounce corto
  useEffect(() => {
    if (q.trim().length < 2) { setTeams([]); setPlayers([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
        const body = await res.json()
        setTeams(body.teams ?? [])
        setPlayers(body.players ?? [])
      } catch {
        setTeams([])
        setPlayers([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [q])

  const go = useCallback((href: string) => {
    onClose()
    router.push(href)
  }, [onClose, router])

  if (!open) return null

  const competitions = ACTIVE_COMPETITIONS.filter((c) =>
    q.trim().length === 0 || c.name.toLowerCase().includes(q.trim().toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 px-4 pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Buscador global"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar equipo o competición…"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
            aria-label="Buscar equipo o competición"
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200"
            aria-label="Cerrar buscador"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {competitions.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                Competiciones
              </p>
              {competitions.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => go(c.href)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:bg-zinc-800 focus-visible:outline-none"
                >
                  {c.slug === 'mundial-2026'
                    ? <Trophy className="h-4 w-4 shrink-0 text-emerald-400" />
                    : <Globe className="h-4 w-4 shrink-0 text-zinc-500" />}
                  <span className="truncate font-medium">{c.name}</span>
                  {c.note && <span className="ml-auto shrink-0 text-[10px] text-zinc-500">{c.note}</span>}
                </button>
              ))}
            </>
          )}

          {q.trim().length >= 2 && (
            <>
              <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                Equipos
              </p>
              {loading && teams.length === 0 && (
                <p className="px-2 py-2 text-xs text-zinc-500">Buscando…</p>
              )}
              {!loading && teams.length === 0 && (
                <p className="px-2 py-2 text-xs text-zinc-500">
                  Sin equipos para “{q.trim()}”. Prueba con el nombre oficial.
                </p>
              )}
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => go(t.href)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:bg-zinc-800 focus-visible:outline-none"
                >
                  {t.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo_url} alt="" className="h-4 w-4 shrink-0 object-contain" />
                  ) : (
                    <Users className="h-4 w-4 shrink-0 text-zinc-500" />
                  )}
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-zinc-500">{t.context}</span>
                </button>
              ))}
              {players.length > 0 && (
                <>
                  <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                    Tenistas
                  </p>
                  {players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => go(p.href)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:bg-zinc-800 focus-visible:outline-none"
                    >
                      <Activity className="h-4 w-4 shrink-0 text-lime-400" />
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-zinc-500">{p.context}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
