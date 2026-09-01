/**
 * Una competición archivada no deja rastro en el sitio.
 *
 * ── Qué significa archivar ────────────────────────────────────────────────
 * Archivar es dejar de MOSTRAR y de ACTUALIZAR, nunca borrar. Las filas se
 * quedan en la base intactas —104 partidos, 48 selecciones, 91 predicciones
 * del Mundial— y hay una sola página de archivo, alcanzable por URL, con el
 * balance congelado. Todo lo demás desaparece: navegación, buscador,
 * sitemap, contadores y sincronizaciones.
 *
 * ── Por qué un test y no la revisión a ojo ────────────────────────────────
 * El rastro del Mundial estaba repartido en nueve rutas, dos componentes de
 * navegación, el sitemap, el buscador, la página de inteligencia, tres crons
 * y cinco servicios de sync. Buscar "Mundial" a mano encontraba unos y se
 * dejaba otros: la primera retirada dejó /bracket, /champion, /groups,
 * /scorers, /players y /simulation en pie y en el sitemap. Este test fija
 * las reglas que hacen que el archivo se sostenga solo.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  ACTIVE_COMPETITIONS,
  ARCHIVED_COMPETITION_IDS,
  ARCHIVED_COMPETITIONS,
  COMPETITIONS_NAV,
  HISTORIC_COMPETITIONS,
  competitionIdsOfSport,
  isArchivedCompetition,
} from '../lib/sports'
import { COMPETITION_ID } from '../lib/constants'

const ROOT = join(__dirname, '..')
const leer = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** Las rutas que el torneo ocupaba y que se consolidaron en /mundial. */
const RUTAS_ARCHIVADAS = [
  'app/mundial/balance',
  'app/mundial/rankings',
  'app/bracket',
  'app/champion',
  'app/groups',
  'app/scorers',
  'app/simulation',
  'app/players/page.tsx',
]

test('el Mundial figura como archivado y en ninguna otra categoría', () => {
  assert.ok(isArchivedCompetition(COMPETITION_ID), 'el Mundial debe estar archivado')
  assert.ok(!ACTIVE_COMPETITIONS.some((c) => c.id === COMPETITION_ID),
    'una archivada no puede estar activa')
  assert.ok(!HISTORIC_COMPETITIONS.some((c) => c.id === COMPETITION_ID),
    'archivada e histórica son estados distintos: histórica sigue enlazada en el sidebar')
  assert.equal(ARCHIVED_COMPETITIONS.length, ARCHIVED_COMPETITION_IDS.length,
    'toda archivada del registro debe tener id: sin id no hay nada que excluir')
})

test('los procesos transversales no procesan lo archivado', () => {
  // competitionIdsOfSport es la lista blanca de Smart Bets y de los sync
  // globales. Si una archivada se cuela, el torneo vuelve a los contadores.
  for (const sport of ['futbol', 'baloncesto', 'tenis'] as const) {
    for (const id of competitionIdsOfSport(sport)) {
      assert.ok(!ARCHIVED_COMPETITION_IDS.includes(id),
        `competitionIdsOfSport('${sport}') devuelve la competición archivada ${id}`)
    }
  }
})

test('las rutas del torneo ya no existen y redirigen a la página de archivo', () => {
  for (const rel of RUTAS_ARCHIVADAS) {
    assert.ok(!existsSync(join(ROOT, rel)),
      `${rel} sigue en pie: una ruta archivada no puede seguir sirviéndose`)
  }

  // Borrarlas sin redirigir rompería los enlaces que ya circulan. El 307
  // (permanent:false) es deliberado: el archivo es reversible y un 308 se
  // queda cacheado en el navegador para siempre.
  const config = leer('next.config.ts')
  assert.match(config, /async redirects\(\)/, 'next.config.ts debe declarar redirects')
  assert.match(config, /destination: '\/mundial'/, 'deben apuntar a la página de archivo')
  assert.match(config, /permanent: false/,
    'el redirect debe ser temporal: desarchivar no debe chocar con un 308 cacheado')
  for (const ruta of ['/bracket', '/champion', '/groups', '/scorers', '/players', '/simulation',
                      '/mundial/balance', '/mundial/rankings']) {
    assert.ok(config.includes(`'${ruta}'`), `falta el redirect de ${ruta}`)
  }
})

test('la página de archivo sobrevive, congelada y fuera del índice', () => {
  const src = leer('app/mundial/page.tsx')
  assert.match(src, /export const revalidate = false/,
    'los datos no vuelven a cambiar: revalidar sería gastar por nada')
  assert.match(src, /robots:\s*\{\s*index:\s*false/,
    'una competición archivada no compite en buscadores con las que sí se cubren')
})

test('el sitemap no anuncia rutas archivadas', () => {
  const src = leer('app/sitemap.ts')
  for (const ruta of ['/mundial', '/bracket', '/champion', '/groups', '/scorers',
                      '/players`', '/simulation']) {
    assert.ok(!src.includes(`SITE_URL}${ruta}\``),
      `el sitemap sigue anunciando ${ruta}, que está archivada o redirige`)
  }
  // Los jugadores del sitemap se filtran por el equipo, que sí lleva
  // competición: sin ese filtro entraban las 48 selecciones del Mundial.
  assert.match(src, /ARCHIVED_COMPETITION_IDS/,
    'las URLs derivadas de la base deben excluir lo archivado')
})

test('el buscador no devuelve equipos de competiciones archivadas', () => {
  const src = leer('app/api/search/route.ts')
  assert.match(src, /ARCHIVED_COMPETITION_IDS/,
    'buscar un equipo no debe llevar a una competición que ya no se actualiza')
  // `\bCOMPETITION_ID\b` a secas, no ARCHIVED_COMPETITION_IDS: lo que no
  // puede volver es el caso especial "si es el Mundial, llévalo a su agenda".
  assert.doesNotMatch(src, /(?<![A-Z_])COMPETITION_ID(?![S_])/,
    'el buscador ya no debe tratar al Mundial como un caso especial')
})

test('ningún cron programado toca una competición archivada', () => {
  const dir = join(ROOT, '.github', 'workflows')
  // run-simulation.yml proyectaba el campeón del Mundial: sin `schedule:`,
  // solo a mano.
  //
  // sync-odds.yml estuvo en esta lista y salió: dejó de trabajar sobre el
  // torneo cuando services/sync/odds.ts pasó a recorrer las competiciones en
  // curso, así que volver a programarlo es correcto. Lo que sigue vigilado es
  // que no vuelva a apuntar al Mundial — eso lo cubre el assert de abajo
  // sobre COMPETITION_ID.
  for (const wf of ['run-simulation.yml']) {
    const src = readFileSync(join(dir, wf), 'utf8')
    assert.doesNotMatch(src, /^\s+schedule:/m,
      `${wf} sigue programado y su trabajo es sobre una competición archivada`)
    assert.match(src, /workflow_dispatch:/,
      `${wf} debe seguir siendo lanzable a mano`)
  }
  // La ingesta de cuotas puede correr programada, pero jamás sobre el archivo.
  //
  // Se mira el CÓDIGO, no los comentarios: la cabecera del archivo explica de
  // dónde viene el proceso y nombra ahí la clave vieja a propósito. Un test
  // que prohíba mencionarla obligaría a borrar la explicación del fallo.
  const oddsCodigo = leer('services/sync/odds.ts')
    .replace(/\/\*[\s\S]*?\*\//g, '')   // comentarios de bloque
    .replace(/^\s*\/\/.*$/gm, '')       // comentarios de línea
  assert.doesNotMatch(oddsCodigo, /\bCOMPETITION_ID\b/,
    'la ingesta de cuotas no debe volver a fijarse a la competición archivada')
  assert.doesNotMatch(oddsCodigo, /soccer_fifa_world_cup/,
    'la clave de deporte del Mundial no debe reaparecer en la ingesta de cuotas')
  // El sync de resultados en vivo sigue corriendo, pero ya no por el Mundial.
  assert.doesNotMatch(leer('lib/syncWindow.ts'), /\bCOMPETITION_ID\b/,
    'la ventana de sync en vivo no debe incluir la competición archivada')
  for (const rel of ['app/api/sync/auto/route.ts', 'app/api/sync/live/route.ts']) {
    assert.doesNotMatch(leer(rel), /syncESPNResults\b(?!Libertadores)/,
      `${rel} sigue sincronizando el calendario del Mundial en cada corrida`)
  }
})

test('ninguna página enlaza a una ruta archivada', () => {
  const rutas = ['/bracket', '/champion', '/groups', '/scorers', '/simulation',
                 '/mundial/balance', '/mundial/rankings']
  const fallos: string[] = []

  const walk = (dir: string): string[] => {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) out.push(...walk(full))
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
    }
    return out
  }

  for (const dir of ['app', 'components'].map((d) => join(ROOT, d))) {
    for (const file of walk(dir)) {
      // next.config.ts declara los redirects; los tests describen el estado.
      const src = readFileSync(file, 'utf8')
      for (const ruta of rutas) {
        // Solo enlaces reales: href="/bracket". Un comentario que la nombre
        // para explicar el archivo es exactamente lo que se quiere conservar.
        const re = new RegExp(`href=["'\`]${ruta}(["'\`/?])`)
        if (re.test(src)) fallos.push(`${relative(ROOT, file)} → ${ruta}`)
      }
    }
  }

  assert.deepEqual(fallos, [],
    `enlaces a rutas archivadas (llevan a un redirect, no a contenido):\n  ${fallos.join('\n  ')}`)
})

test('el registro sigue resolviendo nombre y deporte de lo archivado', () => {
  // Archivar no es amnesia: una ficha de partido del torneo tiene que poder
  // seguir diciendo "Mundial 2026" y "fútbol".
  const entry = COMPETITIONS_NAV.find((c) => c.id === COMPETITION_ID)
  assert.ok(entry, 'la entrada debe permanecer en el registro')
  assert.equal(entry?.name, 'Mundial 2026')
  assert.equal(entry?.sport, 'futbol')
})
