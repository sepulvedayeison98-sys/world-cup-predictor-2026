/**
 * Guard de la FRONTERA V3 (roadmap Fase A / ADR-004).
 *
 * Regla (ver docs/CAPA_ANALITICA_VS_PRODUCCION.md): la capa analítica V3
 * (`lib/models`, `lib/agents`, `lib/intelligence`) puede LEER datos y MOSTRAR
 * análisis, pero NUNCA persiste predicciones oficiales. El riesgo que cierra es
 * el "motor sombra": una segunda fuente de predicciones que divergiría de la
 * verdad publicada por el motor único.
 *
 * Enforcement (dos invariantes, ambos ciertos hoy):
 *   1. V3 no importa el cliente service-role (`@/lib/supabase/admin`) — que es
 *      la ÚNICA capacidad de escritura (RLS bloquea writes del rol anon).
 *   2. V3 no ejecuta mutaciones (.insert/.update/.upsert/.delete) sobre las
 *      tablas autoritativas.
 *
 * Módulo de pruebas puro.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const V3_ROOTS = ['lib/models', 'lib/agents', 'lib/intelligence']
const AUTHORITATIVE = ['predictions', 'value_bets', 'smart_bet_picks', 'match_verdicts']
const MUTATIONS = ['.insert(', '.update(', '.upsert(', '.delete(']
const ADMIN_IMPORT = /from\s+['"]@\/lib\/supabase\/admin['"]/

function collectFiles(dir: string, out: string[]): void {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) collectFiles(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
}

test('frontera V3: la capa analítica no importa el cliente de escritura', () => {
  const files: string[] = []
  for (const r of V3_ROOTS) collectFiles(r, files)

  const violations: string[] = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    if (ADMIN_IMPORT.test(src)) {
      violations.push(`${file}: importa @/lib/supabase/admin (capacidad de escritura)`)
    }
  }
  assert.equal(
    violations.length, 0,
    `La capa V3 debe permanecer sin capacidad de escritura (ADR-004):\n` + violations.join('\n'),
  )
})

test('frontera V3: la capa analítica no muta tablas autoritativas', () => {
  const files: string[] = []
  for (const r of V3_ROOTS) collectFiles(r, files)

  const fromRe = new RegExp(`\\.from\\((['"])(${AUTHORITATIVE.join('|')})\\1\\)`)
  const violations: string[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!fromRe.test(lines[i])) continue
      const win = lines.slice(i, Math.min(i + 12, lines.length)).join('\n')
      if (MUTATIONS.some((m) => win.includes(m))) {
        violations.push(`${file}:${i + 1}  ${lines[i].trim()}`)
      }
    }
  }
  assert.equal(
    violations.length, 0,
    `La capa V3 no puede escribir predicciones oficiales (ADR-004):\n` + violations.join('\n'),
  )
})
