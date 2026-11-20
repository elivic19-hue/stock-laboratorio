// MobileNet v2 en Node (procesador), para calcular los vectores de la autoprueba y comprobarlos en
// los tests. Lee los pesos de public/models/ y hace lo mismo que mobilenet.infer(img, true) con
// inputRange [0, 1]: píxeles / 255 → nodo AvgPool → vector de 1280.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as tf from '@tensorflow/tfjs'

const CARPETA = join(import.meta.dirname, '..', 'public', 'models', 'mobilenet_v2_100_224')
const NODO_EMBEDDING = 'module_apply_default/MobilenetV2/Logits/AvgPool'

/** Carga el modelo desde los archivos (sin fetch). */
export async function cargarModeloEnNode() {
  await tf.setBackend('cpu')
  await tf.ready()
  const json = JSON.parse(readFileSync(join(CARPETA, 'model.json'), 'utf8'))
  const trozos = json.weightsManifest.flatMap((g) => g.paths.map((p) => readFileSync(join(CARPETA, p))))
  const total = Buffer.concat(trozos)
  const weightData = total.buffer.slice(total.byteOffset, total.byteOffset + total.byteLength)
  return tf.loadGraphModel({
    load: async () => ({
      modelTopology: json.modelTopology,
      format: json.format,
      generatedBy: json.generatedBy,
      convertedBy: json.convertedBy,
      weightSpecs: json.weightsManifest.flatMap((g) => g.weights),
      weightData,
    }),
  })
}

/** Vector (sin normalizar) de una imagen RGBA de 224×224. */
export async function vectorDePixeles(modelo, rgba) {
  const salida = tf.tidy(() => {
    const rgb = new Int32Array(224 * 224 * 3)
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgb[j] = rgba[i]
      rgb[j + 1] = rgba[i + 1]
      rgb[j + 2] = rgba[i + 2]
    }
    const img = tf.tensor3d(rgb, [224, 224, 3], 'int32')
    const x = tf.reshape(tf.add(tf.mul(tf.cast(img, 'float32'), 1 / 255), 0), [1, 224, 224, 3])
    return tf.squeeze(modelo.execute(x, NODO_EMBEDDING), [1, 2])
  })
  const datos = Array.from(await salida.data())
  salida.dispose()
  return datos
}
