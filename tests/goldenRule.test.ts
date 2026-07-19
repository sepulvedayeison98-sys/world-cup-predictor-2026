/**
 * Guard automático de la REGLA DE ORO multi-competición (roadmap Fase A3).
 *
 * Invariante protegido: toda query a `matches`, `teams`, `team_statistics` o
 * `predictions` debe acotarse por competición (o por fila/entidad única), para
 * que Mundial, ligas de clubes, NBA y tenis —que conviven en las mismas tablas—
 * nunca mezclen métricas entre deportes.
 *
 * El test escanea el código de acceso a datos (app/, lib/, services/) y falla si
 * aparece una query a una tabla protegida SIN una guarda reconocible. Las
 * excepciones conscientes (queries globales/operativas que solo leen columnas
 * neutras) se marcan explícitamente con `regla-oro-ok` y quedan documentadas en
 * el propio código. Así el guardrail más crítico deja de depender de disciplina
 * humana: cualquier query nueva sin acotar rompe la CI.
 *
 * Módulo de pruebas puro — no importa nada de dominio ni toca Supabase.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app', 'lib', 'services']
const GUARDED = ['matches', 'teams', 'team_statistics', 'predictions']

// Tokens que demuestran acotación: por competición, por fila/entidad única, o
// por id externo. Cualquiera basta para considerar la query segura.
const GUARD_TOKENS = [
  'competition_id', '!inner',
  ".eq('id'", '.eq("id"', ".in('id'", '.in("id"',
  ".eq('match_id'", '.eq("match_id"', 'match_id',
  ".eq('api_football_id'", 'api_football_id',
]
// Mutaciones por fila (el payload lleva competition_id / son upserts idempotentes).
const MUTATIONS = ['.insert(', '.upsert(', '.update(', '.delete(']
// Escape consciente y documentado para queries globales sin métricas por deporte.
const ESCAPE = 'regla-oro-ok'

const FROM_RE = new RegExp(`\\.from\\((['"])(${GUARDED.join('|')})\\1\\)`)

function collectFiles(dir: string, out: string[]): void {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      collectFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full)
    }
  }
}

/** Ventana de la cadena fluida desde la línea `.from(...)` hasta su fin. */
function chainWindow(lines: string[], startIdx: number): string {
  let win = lines[startIdx]
  for (let j = startIdx + 1; j < Math.min(startIdx + 20, lines.length); j++) {
    const t = lines[j].trim()
    win += '\n' + lines[j]
    if (/\.(maybeSingle|single|then|csv)\(\)/.test(t)) break
    if (t === '') break
    if (/^(const |let |return |await |supabase|\}|if \(|for \()/.test(t) && !t.startsWith('.')) break
  }
  return win
}

test('regla de oro: ninguna query a tablas compartidas sin acotar por competición', () => {
  const files: string[] = []
  for (const r of ROOTS) collectFiles(r, files)

  const violations: string[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!FROM_RE.test(lines[i])) continue
      const win = chainWindow(lines, i)
      const safe =
        GUARD_TOKENS.some((tk) => win.includes(tk)) ||
        MUTATIONS.some((tk) => win.includes(tk)) ||
        win.includes(ESCAPE)
      if (!safe) violations.push(`${file}:${i + 1}  ${lines[i].trim()}`)
    }
  }

  assert.equal(
    violations.length, 0,
    `Query(s) a tabla compartida sin acotar por competición ni marca ${ESCAPE}:\n` +
      violations.join('\n') +
      `\n\nAcota con .eq('competition_id', …), matches!inner, o un filtro por id; ` +
      `si es una query global legítima sin métricas por deporte, añade un comentario ` +
      `"${ESCAPE}: <motivo>" en la línea .from(...).`,
  )
})
