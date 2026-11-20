import { useSyncExternalStore } from 'react'
import { ErrorStock } from '../dominio/errores'
import { ejecutarAutoprueba, type ResultadoAutoprueba } from './autoprueba'
import { normalizarL2 } from './comparar'
import { MENSAJES_PIXELES, revisarPixeles } from './pixeles'

/**
 * MobileNet v2 como extractor de características (CLAUDE.md §5, paso 2). Se carga una sola vez,
 * con un calentamiento, y se reutiliza. Los pesos van en public/models/: funciona sin conexión.
 *
 * TensorFlow.js se importa bajo demanda para que la app arranque igual de rápido.
 *
 * Desde el 20/11/2026 (docs/decisiones.md, «Reconocimiento: siempre el primero con 99 %»):
 * - Los píxeles se leen del lienzo (ImageData) y se pasan al modelo desde la memoria, en vez de
 *   subir el lienzo directamente a la GPU, que en algunos móviles llega vacío o atrasado.
 * - Las fotos negras o sin detalle se rechazan antes de calcular su vector.
 * - Al cargar, una autoprueba compara el resultado con los vectores correctos de unas imágenes de
 *   prueba. Si la GPU calcula mal, se pasa al procesador (más lento, pero correcto).
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
  /** Vector de lo que hay en el lienzo (224×224). Lanza ErrorStock si la foto es negra o sin detalle. */
  embedding(imagen: HTMLCanvasElement): Promise<Embedding>
  /** «webgl», «wasm» o «cpu». */
  motor: string
}

export type EstadoModelo =
  | { estado: 'sin-cargar' }
  | { estado: 'cargando' }
  | {
      estado: 'listo'
      motor: string
      msCarga: number
      autoprueba: ResultadoAutoprueba
      /** Motor que se descartó porque no pasó la autoprueba (la GPU de este móvil calcula mal). */
      motorDescartado?: string
    }
  | { estado: 'error'; mensaje: string }

/** La autoprueba ha fallado también con el procesador: no se puede reconocer en este móvil. */
class ErrorAutoprueba extends Error {}

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

  /** Carga el modelo en el motor actual, lo calienta y le pasa la autoprueba. */
  async function preparar() {
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

    async function calcular(pixeles: ImageData): Promise<number[]> {
      const salida = tf.tidy(() => modelo.infer(pixeles, true))
      try {
        const datos = await salida.data()
        const vector = normalizarL2(datos)
        if (vector.some((v) => !Number.isFinite(v)) || vector.every((v) => v === 0)) {
          throw new ErrorStock('foto-no-valida', 'El reconocimiento ha dado un resultado no válido. Vuelve a hacer la foto.')
        }
        return vector
      } finally {
        salida.dispose()
      }
    }

    const autoprueba = await ejecutarAutoprueba((rgba) =>
      calcular(new ImageData(new Uint8ClampedArray(rgba), TAMANO_ENTRADA, TAMANO_ENTRADA)),
    )
    return { calcular, autoprueba }
  }

  let preparado = await preparar()
  let motorDescartado: string | undefined
  if (!preparado.autoprueba.correcta && tf.getBackend() !== 'cpu') {
    console.warn(`La autoprueba del reconocimiento ha fallado con «${tf.getBackend()}»`, preparado.autoprueba)
    motorDescartado = tf.getBackend()
    await tf.setBackend('cpu')
    preparado = await preparar()
  }
  const { calcular, autoprueba } = preparado
  if (!autoprueba.correcta) {
    console.error('La autoprueba del reconocimiento ha fallado también con el procesador', autoprueba)
    throw new ErrorAutoprueba(
      'El reconocimiento calcula mal en este móvil (no ha pasado la autoprueba). Retira buscando a mano.',
    )
  }

  const motor = tf.getBackend()
  cambiarEstado({
    estado: 'listo',
    motor,
    msCarga: Math.round(performance.now() - inicio),
    autoprueba,
    ...(motorDescartado ? { motorDescartado } : {}),
  })

  return {
    motor,
    async embedding(imagen) {
      const t0 = performance.now()
      const ctx = imagen.getContext('2d')
      if (!ctx) throw new Error('El navegador no permite leer el lienzo.')
      const pixeles = ctx.getImageData(0, 0, imagen.width, imagen.height)
      const revision = revisarPixeles(pixeles.data)
      if (revision !== 'bien') throw new ErrorStock('foto-no-valida', MENSAJES_PIXELES[revision])
      const vector = await calcular(pixeles)
      return { vector, ms: performance.now() - t0 }
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
      cambiarEstado({
        estado: 'error',
        mensaje: error instanceof ErrorAutoprueba ? error.message : 'No se pudo cargar el modelo de reconocimiento.',
      })
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
