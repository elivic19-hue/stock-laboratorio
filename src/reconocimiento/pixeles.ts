/**
 * Comprobación de la imagen antes de calcular su vector: una foto negra (la cámara aún no daba
 * imagen) o sin detalle (lente tapada, todo del mismo color) daría un vector que no es del
 * producto y que se parece al de cualquier otra foto fallida.
 */

export type RevisionPixeles = 'bien' | 'oscura' | 'plana'

/** Por debajo de esta luz media (de 0 a 255) la foto está prácticamente negra. */
export const LUZ_MINIMA = 12
/** Por debajo de esta desviación de la luz (de 0 a 255) la foto es casi de un solo color. */
export const DETALLE_MINIMO = 4

/** Luz media y su desviación típica (de 0 a 255) de unos píxeles RGBA. */
export function luzDePixeles(rgba: ArrayLike<number>): { media: number; desviacion: number } {
  let suma = 0
  let sumaCuadrados = 0
  let n = 0
  for (let i = 0; i + 2 < rgba.length; i += 4) {
    const luz = 0.299 * (rgba[i] ?? 0) + 0.587 * (rgba[i + 1] ?? 0) + 0.114 * (rgba[i + 2] ?? 0)
    suma += luz
    sumaCuadrados += luz * luz
    n++
  }
  if (n === 0) return { media: 0, desviacion: 0 }
  const media = suma / n
  return { media, desviacion: Math.sqrt(Math.max(0, sumaCuadrados / n - media * media)) }
}

export function revisarPixeles(rgba: ArrayLike<number>): RevisionPixeles {
  const { media, desviacion } = luzDePixeles(rgba)
  if (media < LUZ_MINIMA) return 'oscura'
  if (desviacion < DETALLE_MINIMO) return 'plana'
  return 'bien'
}

export const MENSAJES_PIXELES: Record<Exclude<RevisionPixeles, 'bien'>, string> = {
  oscura: 'La foto ha salido negra. Espera a que se vea la imagen de la cámara (o enciende la linterna) y vuelve a hacerla.',
  plana: 'La foto ha salido sin detalle, toda del mismo color. Comprueba que el producto está dentro del marco y vuelve a hacerla.',
}
