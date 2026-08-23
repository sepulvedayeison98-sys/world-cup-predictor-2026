/**
 * La puerta de publicación de Copa Libertadores.
 *
 * Medido sobre los 111 partidos jugados de la edición 2026:
 *
 *                 modelo   siempre local   azar
 *   grupos         44-47%       —           33%
 *   eliminatoria   13%         13%          33%
 *
 * El motor de ligas modela una temporada continua y aplica +60 puntos de ELO
 * de ventaja local a TODOS los partidos. En una eliminatoria a ida y vuelta
 * esa ventaja no existe: de los 15 partidos de esa fase solo 2 los ganó el
 * local. El resultado es un 13% de acierto — por debajo del azar— con
 * cualquier calentamiento que se le ponga, así que no es ruido de muestra.
 *
 * `calibrateLibertadores` calcula el histórico completo (hace falta para el
 * ELO y para poder medir) pero solo PUBLICA la fase de grupos. Este test fija
 * esa regla: si alguien la relaja sin sustituir el modelo, salta aquí y no en
 * la página, publicando un 13% junto a la línea base del 33% que la propia
 * plataforma declara.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(
  join(__dirname, '..', 'services', 'sync', 'league-calibrate.ts'), 'utf8',
)

test('la calibración admite una política de publicación, no publica todo a ciegas', () => {
  assert.match(SRC, /shouldPublish/,
    'calibrateCompetition debe aceptar qué se publica')
  assert.match(SRC, /is_published: publica\(/,
    'is_published debe salir de la política, no ser una constante')
  // Dos bloques: histórico evaluado y próximos partidos. Si uno se queda
  // con `is_published: true` fijo, la puerta tendría una fuga.
  const fijos = SRC.match(/is_published:\s*true/g) ?? []
  assert.equal(fijos.length, 0,
    'ningún bloque debe publicar de forma incondicional')
})

test('Libertadores retiene la eliminatoria y publica los grupos', () => {
  // En esta competición la eliminatoria se ingesta con `round` NULL, así que
  // la regla es exactamente esa comparación.
  assert.match(SRC, /calibrateLibertadores[\s\S]*?\(m\)\s*=>\s*m\.round !== null/,
    'la puerta de Libertadores debe publicar solo lo que tiene ronda (grupos)')
})

test('las ligas no cambian de comportamiento', () => {
  // El valor por defecto publica todo: las seis ligas siguen igual que antes.
  assert.match(SRC, /shouldPublish[^\n]*=\s*\(\)\s*=>\s*true/,
    'por defecto se publica todo, para no alterar las ligas')
  assert.match(SRC, /calibrateCompetition\(supabase, key, competitionId, LEAGUE_MODEL_VERSION, true\)/,
    'calibrateLeagues no debe pasar política: hereda la de por defecto')
})

test('la corrida informa de cuántas predicciones retuvo', () => {
  // Retener en silencio sería tan opaco como publicar un mal número: cada
  // corrida tiene que decir cuántas se quedaron fuera.
  assert.match(SRC, /withheld/,
    'el resultado debe incluir el recuento de retenidas')
  assert.match(SRC, /Calculadas pero NO publicadas/,
    'el campo debe estar documentado')
})
