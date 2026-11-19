// Descarga los pesos de MobileNet v2 (1.0, 224) de TF Hub a public/models/, para que la app los
// sirva ella misma y el reconocimiento funcione sin conexión desde la primera instalación
// (CLAUDE.md §3). Solo hace falta ejecutarlo una vez: los archivos se guardan en el repositorio.
//
//   npm run modelo
//
// Modelo: google/imagenet/mobilenet_v2_100_224/classification/2 (licencia Apache 2.0).
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ORIGEN = 'https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2'
const DESTINO = join(import.meta.dirname, '..', 'public', 'models', 'mobilenet_v2_100_224')

async function descargar(nombre) {
  const respuesta = await fetch(`${ORIGEN}/${nombre}?tfjs-format=file`, { redirect: 'follow' })
  if (!respuesta.ok) throw new Error(`${nombre}: HTTP ${respuesta.status}`)
  const datos = Buffer.from(await respuesta.arrayBuffer())
  writeFileSync(join(DESTINO, nombre), datos)
  const huella = createHash('sha256').update(datos).digest('hex')
  console.log(`${nombre}  ${(datos.length / 1024 / 1024).toFixed(2)} MB  sha256 ${huella}`)
  return datos
}

mkdirSync(DESTINO, { recursive: true })
const modelo = JSON.parse((await descargar('model.json')).toString('utf8'))
for (const grupo of modelo.weightsManifest) {
  for (const ruta of grupo.paths) await descargar(ruta)
}
console.log(`Modelo guardado en ${DESTINO}`)
