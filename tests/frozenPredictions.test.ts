/**
 * Una predicción de un partido JUGADO no se vuelve a escribir.
 *
 * ── El fallo que lo motiva ────────────────────────────────────────────────
 * `recalibrate.ts` traía este guard:
 *
 *     if (!pred?.id && !isUpcoming) continue
 *
 * Solo bloquea el INSERT. Con la fila ya creada —que es el caso de todo
 * partido que alguna vez estuvo programado— caía al UPDATE y reescribía las
 * probabilidades de un partido terminado usando el estado ACTUAL del
 * modelo: ELO de hoy, lesiones de hoy, cuotas de hoy.
 *
 * Medido en el Mundial: sus 91 predicciones se reescribían a diario un mes
 * después de acabar el torneo (última escritura el 23 de agosto para
 * partidos del 19 de julio). Como `was_correct` conserva la calificación
 * original, la fila acababa enseñando las probabilidades de hoy junto al
 * acierto de entonces, y en 7 casos se contradicen: un 0-2 con el 54% al
 * visitante marcado como fallo.
 *
 * Publicar una precisión obliga a que lo medido siga siendo lo mostrado. Por
 * eso la predicción se congela en el pitido inicial.
 *
 * Las calibraciones de liga NO tienen este problema y por eso no se tocan:
 * recomputan con un backtest walk-forward que, por construcción, solo usa
 * partidos anteriores al que predice.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(
  join(__dirname, '..', 'services', 'sync', 'recalibrate.ts'), 'utf8',
)

test('recalibrate salta los partidos que ya se jugaron', () => {
  assert.match(SRC, /if \(!isUpcoming\) continue/,
    'debe saltar todo partido no programado ni en vivo, antes de escribir nada')
})

test('el guard incompleto no vuelve a colarse', () => {
  // La forma exacta que tenía el fallo: bloquea el insert pero deja pasar el
  // update. Si reaparece, la contaminación vuelve en silencio.
  assert.doesNotMatch(SRC, /if \(!pred\?\.id && !isUpcoming\) continue/,
    'ese guard solo bloquea el INSERT; el UPDATE seguía reescribiendo el pasado')
})

test('el salto ocurre ANTES de calcular y de escribir', () => {
  const guard = SRC.indexOf('if (!isUpcoming) continue')
  assert.ok(guard > 0, 'el guard debe existir')

  // Nada que escriba una predicción puede aparecer antes del guard dentro
  // del bucle: ni el update, ni el insert, ni la instantánea de features.
  for (const marca of ['computeModelPrediction(', ".from('predictions')", "prediction_features"]) {
    const pos = SRC.indexOf(marca)
    assert.ok(pos > guard,
      `"${marca}" aparece antes del guard: un partido jugado llegaría a escribirse`)
  }
})
