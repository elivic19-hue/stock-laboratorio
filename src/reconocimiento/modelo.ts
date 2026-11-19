import { useSyncExternalStore } from 'react'
import { normalizarL2 } from './comparar'

/**
 * MobileNet v2 como extractor de características (CLAUDE.md §5, paso 2). Se carga una sola vez,
 * con un calentamiento, y se reutiliza. Los pesos van en public/models/: funciona sin conexión.
 *
 * TensorFlow.js se importa bajo demanda para que la app arranque igual de rápido.
 */

export const TAMANO_ENTRADA = 224
const RUTA_MODELO = 'models/mobilenet_v2_100_224/model.json'

export interface Embedding {
  /** Vector normalizado (L2). */
  vector: number[]
  /** Milisegundos que ha tardado la inferencia. */
  ms: number
}

export interface Extractor {
  embedding(imagen: HTMLCanvasElement): Promise<Embedding>
  /** «webgl», «wasm» o «cpu». */
  motor: string
}

export type EstadoModelo =
  | { estado: 'sin-cargar' }
  | { estado: 'cargando' }
  | { estado: 'listo'; motor: string; msCarga: number }
  | { estado: 'error'; mensaje: string }

let estadoActual: EstadoModelo = { estado: 'sin-cargar' }
let carga: Promise<Extractor> | null = null
const oyentes = new Set<() => void>()

function cambiarEstado(nuevo: EstadoModelo): void {
  estadoActual = nuevo
  for (const oyente of oyentes) oyente()
}

async function crearExtractor(): Promise<Extractor> {
  const inicio = performance.now()
  const [tf, mobilenet] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/mobilenet')])
  await tf.ready()
  const modelo = await mobilenet.load({
    version: 2,
    alpha: 1.0,
    modelUrl: new URL(RUTA_MODELO, document.baseURI).href,
    inputRange: [0, 1],
  })

  // Calentamiento: la primera inferencia compila los programas de la GPU y es mucho más lenta.
  tf.tidy(() => {
    const salida = modelo.infer(tf.zeros([TAMANO_ENTRADA, TAMANO_ENTRADA, 3]), true)
    salida.dataSync()
  })

  const motor = tf.getBackend()
  cambiarEstado({ estado: 'listo', motor, msCarga: Math.round(performance.now() - inicio) })

  return {
    motor,
    async embedding(imagen) {
      const t0 = performance.now()
      const salida = tf.tidy(() => modelo.infer(imagen, true))
      const datos = await salida.data()
      salida.dispose()
      return { vector: normalizarL2(datos), ms: performance.now() - t0 }
    },
  }
}

/** Carga el modelo (solo la primera vez) y lo devuelve. Si falla, el siguiente intento vuelve a probar. */
export function cargarModelo(): Promise<Extractor> {
  if (!carga) {
    cambiarEstado({ estado: 'cargando' })
    carga = crearExtractor().catch((error: unknown) => {
      console.error('No se pudo cargar el modelo de reconocimiento', error)
      carga = null
      cambiarEstado({ estado: 'error', mensaje: 'No se pudo cargar el modelo de reconocimiento.' })
      throw error
    })
  }
  return carga
}

/** Empieza a cargar el modelo cuando el navegador está libre, para tenerlo listo al abrir la cámara. */
export function precargarModelo(): void {
  const empezar = () => void cargarModelo().catch(() => undefined)
  if ('requestIdleCallback' in window) window.requestIdleCallback(empezar, { timeout: 3000 })
  else setTimeout(empezar, 1000)
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function useEstadoModelo(): EstadoModelo {
  return useSyncExternalStore(suscribir, () => estadoActual)
}
