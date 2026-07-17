import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchTennisMatchDetail, type TennisMatchPlayer } from '@/services/tennis/queries'
import { SurfaceBadge, roundLabel, shortDate, countryFlag, handLabel } from '@/components/tennis/ui'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Partido ATP | Veredicto',
  description: 'Detalle de un partido real del circuito ATP: resultado, forma reciente y cara a cara.',
}

export const revalidate = 600

function FormChips({ form }: { form: ('W' | 'L')[] }) {
  if (form.length === 0) return <span className="text-xs text-zinc-600">sin partidos previos</span>
  return (
    <div className="flex items-center gap-1">
      {form.map((r, i) => (
        <span key={i} className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
          r === 'W' ? 'bg-lime-500/20 text-lime-300' : 'bg-red-500/15 text-red-300')}>
          {r === 'W' ? 'V' : 'D'}
        </span>
      ))}
    </div>
  )
}

function PlayerBlock({ p, isWinner, align }: { p: TennisMatchPlayer | null; isWinner: boolean; align: 'left' | 'right' }) {
  if (!p) return <div className="flex-1 text-zinc-500">—</div>
  return (
    <div className={cn('flex-1', align === 'right' && 'text-right')}>
      <Link href={`/tennis/jugadores/${p.id}`} className="inline-flex items-center gap-2 hover:text-lime-400">
        {align === 'left' && <span aria-hidden>{countryFlag(p.country_code)}</span>}
        <span className={cn('font-bold', isWinner ? 'text-lime-400' : 'text-zinc-200')}>{p.name}</span>
        {align === 'right' && <span aria-hidden>{countryFlag(p.country_code)}</span>}
      </Link>
      <p className="mt-1 text-[11px] text-zinc-500">
        {[p.rankPosition != null ? `ATP #${p.rankPosition}` : null, handLabel(p.plays_hand)].filter(Boolean).join(' · ')}
      </p>
      {(p.serveIndex != null || p.returnIndex != null) && (
        <p className="mt-1 text-[11px] text-zinc-500">
          <span className="uppercase tracking-wider text-zinc-600">Saque </span>
          <span className="mono font-bold text-lime-300">{p.serveIndex ?? '—'}</span>
          <span className="uppercase tracking-wider text-zinc-600"> · Resto </span>
          <span className="mono font-bold text-lime-300">{p.returnIndex ?? '—'}</span>
        </p>
      )}
      <div className={cn('mt-2 flex', align === 'right' && 'justify-end')}>
        <FormChips form={p.formBefore} />
      </div>
    </div>
  )
}

export default async function TennisMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const m = await fetchTennisMatchDetail(id)
  if (!m) notFound()

  const p1Won = m.winner_id != null && m.p1?.id === m.winner_id
  const p2Won = m.winner_id != null && m.p2?.id === m.winner_id

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/tennis/partidos" className="text-xs font-semibold uppercase tracking-widest text-lime-500 hover:text-lime-400">← Resultados</Link>
        <h1 className="mt-1 text-xl font-bold text-white">{m.tournament.name ?? 'Partido'}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-400">
          <SurfaceBadge surface={m.surface} />
          {m.round && <span>{roundLabel(m.round)}</span>}
          <span>·</span>
          <span>{shortDate(m.scheduled_at)}</span>
          {m.tournament.level && <><span>·</span><span>{m.tournament.level}</span></>}
          {m.best_of && <><span>·</span><span>al mejor de {m.best_of}</span></>}
          {m.status === 'retired' && <><span>·</span><span className="text-amber-400">Abandono</span></>}
        </p>
      </div>

      {/* Marcador */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start gap-4">
          <PlayerBlock p={m.p1} isWinner={p1Won} align="left" />
          <div className="shrink-0 px-2 text-center">
            <p className="mono text-lg font-bold text-zinc-100">{m.score ?? (m.status === 'retired' ? 'Ret.' : '—')}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">resultado</p>
          </div>
          <PlayerBlock p={m.p2} isWinner={p2Won} align="right" />
        </div>

        {/* H2H */}
        {m.h2h && m.p1 && m.p2 && (
          <div className="mt-4 flex items-center justify-center gap-3 border-t border-zinc-800 pt-4">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">Cara a cara</span>
            <span className="mono text-sm font-bold text-zinc-200">{m.h2h.p1Wins}–{m.h2h.p2Wins}</span>
            <Link href={`/tennis/h2h?p1=${m.p1.id}&p2=${m.p2.id}`} className="text-xs text-lime-500 hover:text-lime-400">ver historial →</Link>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-600">
        Fuente: TML-Database (esquema Sackmann, CC BY-NC-SA). La forma reciente
        es la de cada jugador ANTES de este partido. Los índices de saque/resto
        (0-100, escalado transparente de métricas reales) son del histórico
        completo del jugador — como el ranking, última verdad conocida, no una
        foto pre-partido. Cero datos fabricados.
      </p>
    </div>
  )
}
