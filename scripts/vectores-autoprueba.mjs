// Calcula con el procesador (resultado exacto) los vectores de los patrones de la autoprueba y los
// guarda en src/reconocimiento/vectoresAutoprueba.ts. Hay que volver a ejecutarlo si cambian los
// patrones (src/reconocimiento/patrones.ts) o el modelo:
//
//   npm run autoprueba
//
// El test scripts/vectores-autoprueba.test.mjs comprueba que el archivo guardado sigue cuadrando.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NOMBRES_PATRONES, pixelesPatron } from '../src/reconocimiento/patrones.ts'
import { cargarModeloEnNode, vectorDePixeles } from './modelo-en-node.mjs'

const DESTINO = join(import.meta.dirname, '..', 'src', 'reconocimiento', 'vectoresAutoprueba.ts')

function normalizar(v) {
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0))
  return v.map((x) => x / n)
}

/** Vector normalizado → bytes (0-255) con su escala, en base64 (los valores nunca son negativos). */
function cuantizar(v) {
  const maximo = Math.max(...v)
  const bytes = Uint8Array.from(v, (x) => Math.round((x / maximo) * 255))
  return { escala: maximo / 255, bytes: Buffer.from(bytes).toString('base64') }
}

const modelo = await cargarModeloEnNode()
const lineas = []
for (const nombre of NOMBRES_PATRONES) {
  const { escala, bytes } = cuantizar(normalizar(await vectorDePixeles(modelo, pixelesPatron(nombre))))
  lineas.push(`  ${nombre}: {\n    escala: ${escala},\n    bytes:\n      '${bytes}',\n  },`)
  console.log(`${nombre}: listo`)
}

writeFileSync(
  DESTINO,
  `// Generado por scripts/vectores-autoprueba.mjs (npm run autoprueba): no editar a mano.
// Vector correcto de cada patrón de la autoprueba, calculado con el procesador y cuantizado a un
// byte por componente (valor = byte × escala).
import type { NombrePatron } from './patrones'

export const VECTORES_AUTOPRUEBA: Record<NombrePatron, { escala: number; bytes: string }> = {
${lineas.join('\n')}
}
`,
)
console.log(`Guardado en ${DESTINO}`)
