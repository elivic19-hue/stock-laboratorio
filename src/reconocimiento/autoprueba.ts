import { normalizarL2, similitudCoseno } from './comparar'
import { NOMBRES_PATRONES, pixelesPatron, type NombrePatron } from './patrones'
import { VECTORES_AUTOPRUEBA } from './vectoresAutoprueba'

/**
 * Autoprueba del modelo (docs/decisiones.md, «Reconocimiento: siempre el primero con 99 %»):
 * antes de usarlo, el móvil calcula los vectores de unas imágenes de prueba y los compara con los
 * correctos. Así se detecta una tarjeta gráfica que calcula mal, o que arrastra restos del cálculo
 * anterior, antes de que estropee las fotos de referencia.
 */

/**
 * Con la GPU en media precisión estos patrones dan 0,991 (bordes nítidos y colores saturados: más
 * error que una foto, que da 0,999); una imagen que llega vacía o atrasada da menos de 0,6.
 */
export const SIMILITUD_MINIMA_AUTOPRUEBA = 0.95

/** Repetir la misma imagen tiene que dar lo mismo. */
export const SIMILITUD_MINIMA_REPETICION = 0.999

export interface ResultadoAutoprueba {
  correcta: boolean
  /** La peor similitud con el vector correcto (de 0 a 1). */
  similitud: number
  /** La primera imagen, repetida al final, da el mismo vector. */
  estable: boolean
}

/** Vector correcto (normalizado) de un patrón. */
export function vectorEsperado(nombre: NombrePatron): number[] {
  const { escala, bytes } = VECTORES_AUTOPRUEBA[nombre]
  return normalizarL2(Array.from(atob(bytes), (caracter) => caracter.charCodeAt(0) * escala))
}

/**
 * Calcula los patrones con `calcular` (que recibe píxeles RGBA de 224×224 y devuelve el vector
 * normalizado), repite el primero al final y lo compara todo con los vectores correctos.
 */
export async function ejecutarAutoprueba(
  calcular: (rgba: Uint8ClampedArray) => Promise<readonly number[]>,
): Promise<ResultadoAutoprueba> {
  // Si el cálculo falla (p. ej. da valores no numéricos), la prueba no se pasa, pero no se corta.
  const intentar = async (nombre: NombrePatron) => {
    try {
      return await calcular(pixelesPatron(nombre))
    } catch (error) {
      console.warn(`Autoprueba: no se pudo calcular «${nombre}»`, error)
      return undefined
    }
  }
  let similitud = 1
  let primero: readonly number[] | undefined
  for (const nombre of NOMBRES_PATRONES) {
    const vector = await intentar(nombre)
    if (nombre === NOMBRES_PATRONES[0]) primero = vector
    similitud = Math.min(similitud, vector ? similitudSegura(vector, vectorEsperado(nombre)) : 0)
  }
  const [nombrePrimero] = NOMBRES_PATRONES
  const repetido = nombrePrimero ? await intentar(nombrePrimero) : undefined
  const estable =
    primero !== undefined && repetido !== undefined && similitudSegura(primero, repetido) >= SIMILITUD_MINIMA_REPETICION
  return { correcta: estable && similitud >= SIMILITUD_MINIMA_AUTOPRUEBA, similitud, estable }
}

function similitudSegura(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return 0
  const s = similitudCoseno(a, b)
  return Number.isFinite(s) ? s : 0
}
