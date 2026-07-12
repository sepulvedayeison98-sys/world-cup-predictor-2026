/**
 * Ingesta Sackmann — pruebas del parser CSV (función pura del servicio).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv } from '../services/tennis/sackmann'

test('parsea filas simples y descarta el retorno de carro', () => {
  const rows = parseCsv('a,b,c\r\n1,2,3\r\n')
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', '2', '3']])
})

test('soporta campos entre comillas con comas y comillas escapadas', () => {
  const rows = parseCsv('name,score\n"O\'Brien, John","6-4 ""ret."""\n')
  assert.deepEqual(rows[1], ["O'Brien, John", '6-4 "ret."'])
})

test('última línea sin salto final se conserva', () => {
  const rows = parseCsv('a,b\n1,2')
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[1], ['1', '2'])
})

test('líneas vacías intermedias no generan filas fantasma', () => {
  const rows = parseCsv('a,b\n\n1,2\n')
  assert.equal(rows.length, 2)
})
