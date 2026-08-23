/**
 * Guardia de ZONA HORARIA en las fechas que ve el usuario.
 *
 * ── El fallo que lo motiva ────────────────────────────────────────────────
 * La lista de Smart Bets pintaba «AME vs JUN · 26 de ago, 11:25 p. m.» para
 * un partido que se juega a las 18:25 de Colombia. Formateaba sin fijar la
 * zona, así que en el servidor —que corre en UTC— salía la hora UTC: cinco
 * horas de más. Para los partidos de la tarde colombiana eso los empuja
 * PASADA LA MEDIANOCHE y aparecen con la fecha del día siguiente, que es
 * justo lo que hace imposible saber qué se juega hoy.
 *
 * No es un fallo que se vea en local: la máquina de desarrollo suele estar
 * en la zona correcta y el error solo aparece en producción. Por eso hace
 * falta un test y no basta con revisarlo a ojo.
 *
 * ── La regla ──────────────────────────────────────────────────────────────
 * Todo `new Date(...).toLocale*()` que se pinte debe fijar `timeZone`, o
 * usar los helpers de `lib/datetime.ts`, que ya lo hacen.
 *
 * Excepción legítima: una fecha SIN hora (`'2026-08-23'`) anclada a mediodía
 * —`new Date('2026-08-23T12:00:00')`— es la misma fecha en cualquier zona
 * razonable, así que no necesita `timeZone`. El ancla a mediodía ES la
 * protección.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..')
const DIRS = ['app', 'components'].map((d) => join(ROOT, d))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** Fija la zona por sí misma o la delega en un ancla a mediodía. */
function estaProtegido(fuente: string, idx: number, argumento: string): boolean {
  // Ancla a mediodía: la fecha no puede cambiar de día por el huso.
  if (/T12:00:00/.test(argumento)) return true
  // `timeZone` dentro de la misma llamada. La ventana es generosa porque las
  // opciones suelen ir en varias líneas.
  return /timeZone/.test(fuente.slice(idx, idx + 300))
}

test('ninguna fecha visible se formatea sin fijar la zona horaria', () => {
  const fallos: string[] = []

  for (const dir of DIRS) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, 'utf8')
      const re = /new Date\(([^)]*)\)\s*\.toLocale\w*\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        if (estaProtegido(src, m.index, m[1])) continue
        const linea = src.slice(0, m.index).split('\n').length
        fallos.push(`${relative(ROOT, file)}:${linea}`)
      }
    }
  }

  assert.deepEqual(
    fallos, [],
    'Estas fechas se formatean con la zona del servidor (UTC en producción) y ' +
    'mostrarán la hora corrida cinco horas. Usa los helpers de lib/datetime.ts ' +
    `o añade timeZone: 'America/Bogota':\n  ${fallos.join('\n  ')}`,
  )
})

test('los helpers de lib/datetime fijan todos la zona de Colombia', () => {
  // Son la salida recomendada del test anterior: si alguno dejara de fijar la
  // zona, la guardia de arriba pasaría y el fallo volvería por la puerta de
  // atrás.
  const src = readFileSync(join(ROOT, 'lib', 'datetime.ts'), 'utf8')
  const formateadores = src.match(/export function format\w+/g) ?? []
  assert.ok(formateadores.length >= 4, 'deberían existir varios formateadores')

  const intls = src.match(/new Intl\.DateTimeFormat\([^)]*\{[\s\S]*?\}/g) ?? []
  assert.ok(intls.length > 0, 'los helpers deben usar Intl.DateTimeFormat')
  for (const bloque of intls) {
    assert.match(bloque, /timeZone/, `un formateador no fija la zona:\n${bloque}`)
  }
})
