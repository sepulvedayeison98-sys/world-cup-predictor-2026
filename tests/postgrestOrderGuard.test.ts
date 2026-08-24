/**
 * Guardia contra `order(referencedTable)` + `limit()` en la misma consulta.
 *
 * ── El fallo que lo motiva, cometido DOS VECES ────────────────────────────
 * PostgREST **no ordena las filas del nivel superior por una columna de una
 * tabla embebida**. `order('kickoff_time', { referencedTable: 'matches' })`
 * ordena los registros embebidos dentro de cada fila, no las filas entre sí.
 * Combinado con `limit(N)`, el resultado son N filas CUALESQUIERA — no las N
 * más próximas.
 *
 * Lo peor es que no falla: devuelve datos plausibles. En /predictions la
 * página abría con partidos de marzo de 2027; en Smart Bets faltaba el
 * partido de esa misma noche mientras se listaban los de tres días después.
 * Ambas veces se reportó como «muestra partidos equivocados», no como un
 * error de consulta.
 *
 * ── La alternativa correcta ───────────────────────────────────────────────
 * Acotar por FILTRO sobre la columna embebida —`gte`/`lte` sobre una ventana
 * de fechas, que con `!inner` sí manda en el nivel superior— y ordenar en JS.
 * Así el recorte es el que se pretende y no un subconjunto arbitrario.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..')
const DIRS = ['app', 'components', 'services', 'lib'].map((d) => join(ROOT, d))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

test('ninguna consulta combina order(referencedTable) con limit()', () => {
  const fallos: string[] = []

  for (const dir of DIRS) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, 'utf8')
      const re = /\.order\([^)]*referencedTable[^)]*\)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        // Un `.limit(` en el encadenado que sigue es la combinación peligrosa.
        // Se mira una ventana corta: la cadena de la consulta acaba enseguida.
        const cola = src.slice(m.index + m[0].length, m.index + m[0].length + 120)
        if (!/^\s*(\.\w+\([^)]*\)\s*)*\.limit\(/.test(cola)) continue
        const linea = src.slice(0, m.index).split('\n').length
        fallos.push(`${relative(ROOT, file)}:${linea}`)
      }
    }
  }

  assert.deepEqual(
    fallos, [],
    'PostgREST no ordena el nivel superior por una columna embebida, así que ' +
    'estas consultas devuelven un subconjunto ARBITRARIO en vez del recorte ' +
    'que aparentan. Acota con un filtro de fechas sobre la embebida y ordena ' +
    `en JS:\n  ${fallos.join('\n  ')}`,
  )
})

test('las dos páginas que lo sufrieron acotan ahora por ventana de fechas', () => {
  // Regresión concreta: si alguien vuelve a meter order+limit aquí, el test
  // de arriba salta; este fija además que la solución sigue en su sitio.
  for (const rel of ['app/predictions/page.tsx', 'app/value-bets/page.tsx']) {
    const src = readFileSync(join(ROOT, rel), 'utf8')
    assert.match(src, /WINDOW_DAYS/,
      `${rel} debe acotar la consulta por una ventana de días`)
    assert.match(src, /lte\('match\.kickoff_time'/,
      `${rel} debe cerrar la ventana con un filtro sobre la tabla embebida`)
  }
})
