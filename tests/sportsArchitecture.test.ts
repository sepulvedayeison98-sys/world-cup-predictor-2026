/**
 * Tests de ARQUITECTURA de la capa de proveedores.
 *
 * Lo que se verifica aquí no es comportamiento, sino que las dependencias
 * apuntan en la dirección correcta. Un comentario que dice "este módulo es
 * neutro" envejece mal; un test que lee los `import` de verdad, no.
 *
 * Tres invariantes, y las tres se rompen solas si nadie las vigila:
 *
 *   1. `core/` no depende de NADA del proyecto salvo de sí mismo.
 *   2. Los servicios de un deporte no importan otro deporte.
 *   3. Los adapters no filtran hacia arriba las formas crudas del proveedor.
 *
 * Ejecutar con: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..')
const SPORTS = join(ROOT, 'services', 'sports')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

/** Especificadores de todo `import … from '…'` de un archivo. */
function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  const re = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(m[1])
  return out
}

const ALL_FILES = walk(SPORTS)
const rel = (f: string) => relative(ROOT, f)

test('la capa existe y tiene los cinco módulos previstos', () => {
  assert.ok(ALL_FILES.length > 0, 'services/sports no puede estar vacío')
  for (const mod of ['core', 'football', 'nba', 'tennis', 'odds', 'news', 'providers']) {
    assert.ok(ALL_FILES.some((f) => f.includes(join('sports', mod))), `falta el módulo ${mod}`)
  }
})

test('core/ es NEUTRO: no importa nada del proyecto fuera de core/', () => {
  const coreFiles = ALL_FILES.filter((f) => f.includes(join('sports', 'core')))
  assert.ok(coreFiles.length >= 6, 'core debería tener al menos types/errors/http/cache/ports/registry')

  for (const file of coreFiles) {
    for (const spec of importsOf(file)) {
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue // paquete de npm: permitido

      // `registry.ts` es la ÚNICA excepción justificada: su trabajo es
      // precisamente conocer a los proveedores para poder elegir entre ellos.
      const isRegistry = file.endsWith('registry.ts')
      const targetsProviders = spec.includes('providers/')
      if (isRegistry && targetsProviders) continue

      assert.ok(
        spec.startsWith('./') && !spec.includes('..'),
        `${rel(file)} importa "${spec}": core solo puede depender de core`,
      )
    }
  }
})

test('core/ no toca Supabase, ni motores, ni componentes', () => {
  const prohibido = [
    'supabase', 'predictionEngine', 'leagueEngine', 'tennis/engine', 'nba/engine',
    'smartBets', 'valueBets', 'components/', 'lib/constants', 'next/',
  ]
  for (const file of ALL_FILES.filter((f) => f.includes(join('sports', 'core')))) {
    for (const spec of importsOf(file)) {
      for (const p of prohibido) {
        assert.ok(!spec.includes(p),
          `${rel(file)} importa "${spec}": la capa neutra no puede conocer ${p}`)
      }
    }
  }
})

test('ningún servicio de un deporte importa el dominio de otro', () => {
  // La matriz completa: cada deporte y lo que le está vedado. Es la misma
  // barrera que ya existe en .eslintrc.json, verificada también en test para
  // que no dependa de que alguien ejecute el linter.
  const matriz: Record<string, string[]> = {
    football: ['/nba/', 'nba.service', 'lib/nba', '/tennis/', 'tennis.service', 'lib/tennis'],
    nba: ['/football/', 'football.service', 'lib/predictionEngine', 'lib/leagueEngine', '/tennis/', 'tennis.service', 'lib/tennis'],
    tennis: ['/football/', 'football.service', 'lib/predictionEngine', 'lib/leagueEngine', '/nba/', 'nba.service', 'lib/nba'],
  }

  for (const [dominio, vedados] of Object.entries(matriz)) {
    const files = ALL_FILES.filter((f) => f.includes(join('sports', dominio)))
    assert.ok(files.length > 0, `no se encontraron archivos de ${dominio}`)
    for (const file of files) {
      for (const spec of importsOf(file)) {
        for (const v of vedados) {
          assert.ok(!spec.includes(v),
            `${rel(file)} importa "${spec}": el dominio ${dominio} no puede depender de ${v}`)
        }
      }
    }
  }
})

test('los servicios no importan proveedores concretos: para eso está el registro', () => {
  // Si un servicio importara un adapter, cambiar de fuente dejaría de ser
  // mover una variable de entorno y volvería a ser editar código.
  const servicios = ALL_FILES.filter((f) => f.endsWith('.service.ts'))
  assert.ok(servicios.length >= 5, 'deberían existir cinco servicios')
  for (const file of servicios) {
    for (const spec of importsOf(file)) {
      assert.ok(!spec.includes('providers/'),
        `${rel(file)} importa "${spec}": los servicios resuelven por registro, no por import directo`)
    }
  }
})

test('las formas crudas de cada proveedor no salen de su carpeta', () => {
  // `shapes.ts` describe el JSON del proveedor. Si algo de fuera lo importa,
  // la forma externa se ha filtrado al resto de la aplicación y el adapter
  // ya no aísla nada.
  for (const file of ALL_FILES) {
    const dentroDeUnProveedor = /providers[/\\][^/\\]+[/\\]/.test(rel(file))
    for (const spec of importsOf(file)) {
      if (!spec.includes('shapes')) continue
      assert.ok(dentroDeUnProveedor && spec.startsWith('./'),
        `${rel(file)} importa "${spec}": las formas crudas no cruzan la frontera del adapter`)
    }
  }
})

test('todo adapter declara sus capacidades', () => {
  const providers = ALL_FILES.filter((f) => f.endsWith('.provider.ts'))
  assert.ok(providers.length >= 5, 'deberían existir al menos cinco adapters')
  for (const file of providers) {
    const src = readFileSync(file, 'utf8')
    assert.ok(src.includes('capabilities'),
      `${rel(file)} no declara capacidades: sin ellas el servicio no puede responder «no cubierto»`)
  }
})
