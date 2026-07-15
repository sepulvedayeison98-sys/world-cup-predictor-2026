import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchTennisRanking } from '@/services/tennis/queries'
import { RankingTable } from '@/components/tennis/RankingTable'
import { shortDate } from '@/components/tennis/ui'

export const metadata: Metadata = {
  title: 'Ranking ATP | Veredicto',
  description: 'Clasificación ATP completa a la fecha más reciente, con datos reales de cada jugador.',
}

export const revalidate = 600

export default async function TennisRankingPage() {
  const { date, rows } = await fetchTennisRanking('ATP')

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link href="/tennis" className="text-xs font-semibold uppercase tracking-widest text-lime-500 hover:text-lime-400">← Tenis</Link>
        <h1 className="mt-1 text-2xl font-bold text-white">Ranking ATP</h1>
        <p className="text-sm text-zinc-400">
          Última posición oficial conocida de cada jugador
          {date ? <> (datos hasta <span className="text-zinc-300">{shortDate(date)}</span>)</> : ''}.
          La fuente registra el ranking por partido, no como foto semanal, así
          que esta tabla toma la observación más reciente de cada jugador —
          verdad real de la fuente, no un orden del modelo. Toca a cualquiera
          para ver su perfil.
        </p>
      </div>

      <RankingTable rows={rows} />

      <p className="text-[11px] text-zinc-600">
        Fuente: TML-Database (esquema Sackmann, CC BY-NC-SA). {rows.length} jugadores clasificados.
      </p>
    </div>
  )
}
