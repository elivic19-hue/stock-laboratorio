// Prepara en public/ocr/ lo que necesita el lector de texto (Tesseract.js) para leer el número de lote
// de las etiquetas sin conexión: el worker y el motor (copiados de node_modules) y el modelo de texto
// (tessdata_fast, inglés: basta para números y letras; licencia Apache 2.0). Se sirven desde la
// propia app, como el modelo de reconocimiento, y se guardan en el repositorio.
//
//   npm run ocr
//
// Hay que volver a ejecutarlo si se actualiza tesseract.js.
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const RAIZ = join(import.meta.dirname, '..')
const DESTINO = join(RAIZ, 'public', 'ocr')
const MODELO = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata'

mkdirSync(DESTINO, { recursive: true })

// Solo el motor con SIMD y solo LSTM (todos los móviles actuales tienen SIMD): unos 3,9 MB.
const archivos = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
]
for (const [origen, nombre] of archivos) {
  copyFileSync(join(RAIZ, origen), join(DESTINO, nombre))
  console.log(`${nombre}  copiado`)
}

const respuesta = await fetch(MODELO, { redirect: 'follow' })
if (!respuesta.ok) throw new Error(`eng.traineddata: HTTP ${respuesta.status}`)
const datos = Buffer.from(await respuesta.arrayBuffer())
const comprimido = gzipSync(datos, { level: 9 })
writeFileSync(join(DESTINO, 'eng.traineddata.gz'), comprimido)
const huella = createHash('sha256').update(datos).digest('hex')
console.log(
  `eng.traineddata.gz  ${(datos.length / 1024 / 1024).toFixed(2)} MB → ${(comprimido.length / 1024 / 1024).toFixed(2)} MB  sha256 ${huella}`,
)
