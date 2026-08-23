import type { Metadata } from 'next'
import Link from 'next/link'
import { createStaticSupabaseClient } from '@/lib/supabase/static'
import { PredictionsTable } from '@/components/predictions/PredictionsTable'
import {
  MODEL_VERSION, ALL_LEAGUE_COMPETITION_IDS, LEAGUE_COMPETITION_IDS,
  LIBERTADORES_COMPETITION_ID,
} from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Predicciones',
  description: 'Predicciones del motor para las competiciones de fútbol en curso, con su precisión medida y sus líneas base.',
}

// ISR: cacheado y revalidado cada 120s (sin cookies → renderizado estático)
export const revalidate = 120

/**
 * Predicciones de FÚTBOL.
 *
 * ── Qué se arregló ────────────────────────────────────────────────────────
 * Esta página filtraba por `COMPETITION_ID`, el Mundial. Tenía sentido
 * cuando el Mundial era la única competición; desde que terminó en julio y
 * la plataforma se centró en las ligas, mostraba un torneo archivado bajo un
 * menú —Análisis— que es transversal. Ahora sirve a las competiciones de
 * fútbol en curso.
 *
 * ── Dos límites reales que dan forma a la página ─────────────────────────
 *  1. PostgREST corta en 1.000 filas. Las competiciones activas suman ~2.100
 *     predicciones, así que pedirlas "todas" devolvería una muestra
 *     truncada en silencio — el mismo error que ya falseó la precisión del
 *     inicio en su día.
 *  2. `PredictionsTable` no pagina: pinta lo que le llegue. Dos mil filas en
 *     el DOM no se leen ni se cargan rápido.
 *
 * Por eso se separan dos cosas que antes eran una: los CONTADORES se miden
 * por conteo exacto sobre todo el historial de liga, y la LISTA es una
 * ventana acotada que se declara. Calcular la precisión sobre lo listado
 * habría dado un número tan preciso como falso.
 *
 * NBA y tenis quedan fuera: esta tabla es 1X2 (local/empate/visitante) y en
 * esos deportes no hay empate. Cada uno tiene su propia página.
 */

/** Partidos por delante y resueltos que se listan. Ver nota sobre el tope. */
const UPCOMING_SHOWN = 60
const RECENT_SHOWN = 40
/**
 * Días a cada lado que se piden a la base. Acota la consulta muy por debajo
 * del tope de 1.000 filas de PostgREST (seis ligas juegan ~250 partidos al
 * mes) y basta de sobra para llenar la ventana que se muestra.
 */
const WINDOW_DAYS = 30

const SELECT = `
  *,
  match:matches!inner(
    competition_id, kickoff_time, venue, city, status, phase, home_score, away_score,
    home_team:teams!matches_home_team_id_fkey(name, short_name, code, fifa_ranking),
    away_team:teams!matches_away_team_id_fkey(name, short_name, code, fifa_ranking)
  ),
  exact_score_predictions(home_score, away_score, probability, rank)
`

export default async function PredictionsPage() {
  const supabase = createStaticSupabaseClient()
  const now = Date.now()

  // Historial completo del fútbol de clubes: todas las temporadas de liga
  // más la Libertadores. Es la MISMA base con la que el inicio publica su
  // precisión de ligas, para que las dos cifras no se contradigan.
  const trackScope = [...ALL_LEAGUE_COMPETITION_IDS, LIBERTADORES_COMPETITION_ID]
  // La lista se ciñe a lo que está en juego ahora.
  const liveScope = [...Object.values(LEAGUE_COMPETITION_IDS), LIBERTADORES_COMPETITION_ID]

  const countIn = (scope: string[], extra?: (qb: any) => any) => {
    let qb = supabase
      .from('predictions')
      .select('id, match:matches!inner(competition_id)', { count: 'exact', head: true })
      .eq('is_published', true)
      .in('match.competition_id', scope)
    if (extra) qb = extra(qb)
    return qb
  }

  const [
    { count: total },
    { count: resolvedCount },
    { count: correctCount },
    { data: upcomingRaw },
    { data: recentRaw },
  ] = await Promise.all([
    // Contadores por conteo exacto: traer las filas y contarlas en JS es lo
    // que rompe con el tope de 1.000 de PostgREST.
    countIn(trackScope),
    countIn(trackScope, (qb) => qb.not('was_correct', 'is', null)),
    countIn(trackScope, (qb) => qb.eq('was_correct', true)),
    // Por delante y recién jugados, acotados por VENTANA DE FECHAS.
    //
    // No por `order` + `limit`: PostgREST no ordena las filas de arriba por
    // una columna de la tabla embebida (el comentario que ya había en este
    // archivo lo avisaba, y quitarlo hizo que la página abriera con partidos
    // de marzo de 2027). Con `!inner` el FILTRO sobre la embebida sí manda,
    // así que se recorta por tiempo —lo que además garantiza que el recorte
    // sea el correcto— y el orden final se hace aquí abajo.
    supabase
      .from('predictions')
      .select(SELECT)
      .eq('is_published', true)
      .in('match.competition_id', liveScope)
      .in('match.status', ['scheduled', 'live'])
      .gte('match.kickoff_time', new Date(now - 3 * 3600_000).toISOString())
      .lte('match.kickoff_time', new Date(now + WINDOW_DAYS * 86_400_000).toISOString()),
    supabase
      .from('predictions')
      .select(SELECT)
      .eq('is_published', true)
      .in('match.competition_id', liveScope)
      .eq('match.status', 'finished')
      .gte('match.kickoff_time', new Date(now - WINDOW_DAYS * 86_400_000).toISOString()),
  ])

  // Orden: lo más cercano en el tiempo primero, hacia los dos lados.
  //
  // Ordenar aquí y no en la consulta es obligatorio, no una preferencia:
  // PostgREST no ordena el nivel superior por una columna embebida. Y el
  // criterio es «lo más próximo arriba», no «lo más reciente»: descendente
  // servía para un torneo terminado, pero con la temporada en marcha ponía
  // primero los partidos MÁS LEJANOS —la página abría en marzo de 2027.
  const ms = (p: any) => (p.match?.kickoff_time ? new Date(p.match.kickoff_time).getTime() : 0)
  const upcoming = (upcomingRaw ?? []).slice().sort((a, b) => ms(a) - ms(b)).slice(0, UPCOMING_SHOWN)
  const recent = (recentRaw ?? []).slice().sort((a, b) => ms(b) - ms(a)).slice(0, RECENT_SHOWN)
  // El partido más próximo encabeza; el último jugado abre la parte de abajo.
  const ordered = [...upcoming, ...recent]

  const resolved = resolvedCount ?? 0
  const correct = correctCount ?? 0
  const accuracy = resolved > 0 ? ((correct / resolved) * 100).toFixed(1) : '—'

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Modelo v{MODEL_VERSION} · Activo
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Predicciones</h1>
        <p className="text-sm text-zinc-400">
          Ligas de fútbol y Copa Libertadores, ordenadas por fecha
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          El acierto se mide por el resultado (gana local / empate / gana visitante), no por el marcador exacto.
          El &quot;Pronóstico&quot; es el marcador estimado; en los partidos finalizados se muestra también el marcador real.
        </p>
      </div>

      {/* Contadores sobre TODO el historial de fútbol de clubes, no sobre lo
          listado abajo: es la misma base que la precisión del inicio. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total predicciones', value: (total ?? 0).toLocaleString('es-ES'), color: 'text-white' },
          { label: 'Resueltas',          value: resolved.toLocaleString('es-ES'), color: 'text-zinc-300' },
          { label: 'Correctas',          value: correct.toLocaleString('es-ES'), color: 'text-emerald-400' },
          { label: 'Precisión',          value: `${accuracy}%`, color: accuracy !== '—' && parseFloat(accuracy) >= 65 ? 'text-emerald-400' : 'text-amber-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <p className="text-[11px] text-zinc-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mono ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Q9: la precisión sin líneas base no dice nada — con ellas, demuestra habilidad */}
      <p className="-mt-3 text-[11px] leading-relaxed text-zinc-600">
        Referencias: elegir al azar acierta ~33% · apostar siempre por el local ~44%.
        Los contadores cubren todas las temporadas de liga y la Libertadores;
        la tabla muestra los {UPCOMING_SHOWN} próximos partidos y los {RECENT_SHOWN} últimos
        jugados de las competiciones en curso.{' '}
        <Link href="/mundial/balance" className="text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">
          El balance del Mundial 2026
        </Link>{' '}
        se conserva aparte.
      </p>

      <PredictionsTable predictions={ordered} />
    </div>
  )
}
