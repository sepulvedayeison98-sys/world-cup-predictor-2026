'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Save, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { formatColDateTime } from '@/lib/datetime'
import { PHASE_LABELS } from '@/lib/constants'

/**
 * Panel de administración de resultados. No aparece en la navegación:
 * acceso directo por URL (/admin) + CRON_SECRET como clave.
 * Al finalizar un partido, el backend dispara la cadena completa
 * (stats → standings → perfiles → bracket → recalibración).
 */

async function fetchAdminMatches() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id, match_number, phase, status, kickoff_time, home_score, away_score,
      home_penalties, away_penalties,
      home_team:teams!matches_home_team_id_fkey(code, short_name),
      away_team:teams!matches_away_team_id_fkey(code, short_name)
    `)
    .eq('competition_id', process.env.NEXT_PUBLIC_COMPETITION_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    .neq('phase', 'group')
    .order('kickoff_time', { ascending: true })
  if (error) throw error
  return data ?? []
}

export default function AdminPage() {
  const queryClient = useQueryClient()
  const [secret, setSecret] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [homePens, setHomePens] = useState('')
  const [awayPens, setAwayPens] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    setSecret(localStorage.getItem('wc_admin_secret') ?? '')
  }, [])

  const { data: matches, isLoading } = useQuery({
    queryKey: ['admin-matches'],
    queryFn: fetchAdminMatches,
    staleTime: 15_000,
  })

  const match = useMemo(
    () => (matches ?? []).find((m: any) => m.id === selected),
    [matches, selected],
  )
  const isDraw = homeScore !== '' && homeScore === awayScore

  async function submit(status: 'live' | 'finished') {
    if (!match) return
    setSaving(true)
    setResult(null)
    localStorage.setItem('wc_admin_secret', secret)
    try {
      const res = await fetch('/api/admin/result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          matchId: match.id,
          status,
          homeScore: Number(homeScore),
          awayScore: Number(awayScore),
          ...(isDraw && homePens !== '' ? { homePenalties: Number(homePens), awayPenalties: Number(awayPens) } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok && res.status !== 207) {
        setResult({ ok: false, msg: json.error ?? `Error ${res.status}` })
      } else if (json.chainError) {
        setResult({ ok: false, msg: `Resultado guardado, pero falló un paso: ${json.chainError}` })
      } else {
        const b = json.chain?.bracket
        const extra = b?.created?.length
          ? ` · Cruces creados: ${b.created.join(', ')}`
          : b?.pendingPenalties?.length
            ? ` · ⚠️ Partidos ${b.pendingPenalties.join(', ')} esperan penales`
            : ''
        setResult({
          ok: true,
          msg: status === 'finished'
            ? `Finalizado. Predicciones recalibradas (${json.chain?.recalibrated ?? '—'})${extra}`
            : 'Marcado como EN VIVO.',
        })
        queryClient.invalidateQueries({ queryKey: ['admin-matches'] })
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-3xl">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
          Administración
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Cargar Resultados</h1>
        <p className="text-sm text-zinc-400">
          Al finalizar un partido se actualiza todo en cadena: estadísticas, perfiles,
          cuadro eliminatorio y predicciones.
        </p>
      </div>

      {/* Clave */}
      <div className="card p-4 flex items-center gap-3">
        <KeyRound className="h-4 w-4 text-zinc-500 shrink-0" />
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Clave de administración (CRON_SECRET)"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Selector de partido */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Partido</p>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded bg-zinc-800" />
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {(matches ?? []).map((m: any) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelected(m.id)
                  setHomeScore(m.home_score?.toString() ?? '')
                  setAwayScore(m.away_score?.toString() ?? '')
                  setHomePens(m.home_penalties?.toString() ?? '')
                  setAwayPens(m.away_penalties?.toString() ?? '')
                  setResult(null)
                }}
                className={cn(
                  'w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors',
                  selected === m.id
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700',
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-zinc-200">
                    {m.home_team?.code} vs {m.away_team?.code}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    #{m.match_number} · {PHASE_LABELS[m.phase] ?? m.phase}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {m.status === 'finished' && (
                    <span className="mono font-bold text-white">{m.home_score}–{m.away_score}</span>
                  )}
                  <span className={cn(
                    'rounded px-1.5 py-0.5 font-semibold uppercase',
                    m.status === 'live' ? 'bg-red-500/10 text-red-400'
                      : m.status === 'finished' ? 'bg-zinc-800 text-zinc-500'
                      : 'bg-zinc-800 text-zinc-400',
                  )}>
                    {m.status === 'live' ? 'En vivo' : m.status === 'finished' ? 'Final' : formatColDateTime(m.kickoff_time)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Formulario de marcador */}
      {match && (
        <div className="card p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Marcador · {match.home_team?.short_name} vs {match.away_team?.short_name}
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-emerald-400">{match.home_team?.code}</span>
              <input
                type="number" min={0} max={99} value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-3 text-center text-2xl font-black mono text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <span className="text-zinc-600 text-xl font-bold mt-5">–</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-blue-400">{match.away_team?.code}</span>
              <input
                type="number" min={0} max={99} value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-3 text-center text-2xl font-black mono text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {isDraw && homeScore !== '' && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <p className="text-[11px] text-amber-400 font-medium">
                Empate en eliminatoria — ingresa la definición por penales:
              </p>
              <div className="flex items-center justify-center gap-4">
                <input
                  type="number" min={0} max={99} value={homePens}
                  onChange={(e) => setHomePens(e.target.value)}
                  placeholder={match.home_team?.code}
                  className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-center text-lg font-bold mono text-white focus:outline-none"
                />
                <span className="text-zinc-600 text-[10px]">penales</span>
                <input
                  type="number" min={0} max={99} value={awayPens}
                  onChange={(e) => setAwayPens(e.target.value)}
                  placeholder={match.away_team?.code}
                  className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-2 text-center text-lg font-bold mono text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => submit('live')}
              disabled={saving || !secret || homeScore === '' || awayScore === ''}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              En vivo
            </button>
            <button
              onClick={() => submit('finished')}
              disabled={saving || !secret || homeScore === '' || awayScore === ''}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Finalizar partido
            </button>
          </div>

          {result && (
            <div className={cn(
              'flex items-start gap-2 rounded-lg border p-3 text-sm',
              result.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300',
            )}>
              {result.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{result.msg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
