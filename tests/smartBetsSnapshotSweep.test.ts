/**
 * El snapshot de Smart Bets no puede acumular mercados viejos.
 *
 * ── El fallo que lo motiva ────────────────────────────────────────────────
 * `snapshotScheduledPicks` guarda con `upsert(onConflict: 'match_id,market_id')`.
 * Eso refresca lo que sigue en el top-5 y añade lo nuevo, pero NO borra: un
 * mercado que deja de recomendarse conserva su fila para siempre. La tabla
 * acababa siendo la UNIÓN de todos los top-5 calculados alguna vez.
 *
 * Medido: un Deportivo Cali con 6 picks pendientes —tres del 24 de agosto y
 * tres del 30— y los rangos repetidos (dos rank 2, dos rank 3). Smart Bets
 * enseñaba los seis; la ficha del partido, que recalcula al abrirse, enseñaba
 * solo los de hoy. Las dos pestañas mostraban cosas distintas del mismo
 * partido, que es como se reportó.
 *
 * El barrido borra, dentro de los partidos reevaluados, toda fila sin
 * calificar que no se haya refrescado en la corrida. Este test fija las dos
 * protecciones que lo hacen seguro; sin ellas el barrido pasa de arreglar un
 * fallo a borrar historial.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(
  join(__dirname, '..', 'services', 'smartBetTracking.ts'), 'utf8',
)

// El barrido vive entre el upsert y el return; se aísla para no confundirlo
// con el borrado de ninguna otra función del archivo.
// lastIndexOf en el cierre: hay un `return { matchesSnapshotted: 0 …}` de
// salida temprana ANTES del barrido, y con indexOf el corte salía vacío —
// los cinco asserts pasaban a fallar por la razón equivocada.
const BARRIDO = SRC.slice(
  SRC.indexOf('const limpiables'),
  SRC.lastIndexOf('return { matchesSnapshotted'),
)
assert.ok(BARRIDO.length > 0, 'no se localizó el bloque del barrido en el archivo')

test('la corrida borra lo que se cayó del top-5', () => {
  assert.match(BARRIDO, /\.delete\(/,
    'sin borrado, el upsert deja para siempre los mercados que ya no se recomiendan')
  assert.match(BARRIDO, /\.lt\('snapshot_at', snapshotAt\)/,
    'lo obsoleto es lo que no se refrescó en esta corrida: se distingue por la marca de tiempo')
})

test('un pick ya calificado no se toca jamás', () => {
  // Sin este filtro el barrido reescribiría el historial: los picks resueltos
  // son la muestra con la que se publica la precisión de Smart Bets.
  assert.match(BARRIDO, /\.eq\('resolved', false\)/,
    'el borrado debe limitarse a los picks pendientes')
})

test('un partido cuyo upsert falló no se queda sin picks', () => {
  // Borrar lo viejo sin haber podido escribir lo nuevo dejaría el partido en
  // blanco hasta la siguiente corrida.
  assert.match(SRC, /failedMatches/,
    'hay que registrar qué partidos fallaron al escribirse')
  assert.match(BARRIDO, /filter\(\(id\) => !failedMatches\.has\(id\)\)/,
    'esos partidos deben quedar fuera del barrido')
})

test('solo se barren los partidos que la corrida volvió a evaluar', () => {
  // Un partido saltado (predicción sin publicar) no se recalculó, así que no
  // hay nada con lo que comparar: se deja como estaba.
  assert.match(SRC, /const evaluated = new Set<string>\(\)/,
    'hay que registrar qué partidos se evaluaron')
  assert.match(BARRIDO, /\[\.\.\.evaluated\]/,
    'el barrido debe partir de los evaluados, no de todos los programados')
})

test('la corrida informa de cuántos picks retiró', () => {
  // Un borrado silencioso es tan opaco como el fallo que arregla.
  assert.match(SRC, /picksRemoved: number/, 'el resultado debe declarar el recuento')
  assert.match(SRC, /return \{ matchesSnapshotted: snapshotted\.size, picksStored, picksFailed, picksRemoved \}/,
    'y devolverlo')
})
