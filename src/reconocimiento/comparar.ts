/**
 * Comparación de una foto con las fotos de referencia (CLAUDE.md §5, pasos 3 a 5).
 * Funciones puras: no saben nada del modelo ni de la cámara, y se prueban con Vitest.
 */

export interface Referencia {
  productoId: string
  /** Normalizado (L2). */
  embedding: readonly number[]
}

export interface PuntuacionProducto {
  productoId: string
  /** Media de las MEJORES_COINCIDENCIAS similitudes coseno más altas (de −1 a 1). */
  puntuacion: number
  /** Confianza relativa (softmax con temperatura), de 0 a 1. Suman 1 entre todos los productos. */
  confianza: number
  /** Cuántas fotos de referencia tiene el producto. */
  referencias: number
}

export interface OpcionesReconocimiento {
  /** Puntuación mínima del mejor producto para proponerlo como seguro. */
  umbral: number
  /** Temperatura del softmax: más baja, más diferencia entre el primero y los demás. */
  temperatura: number
  /** Diferencia mínima de puntuación entre el primero y el segundo para no dudar. */
  margen?: number
}

export type EstadoReconocimiento = 'seguro' | 'dudoso' | 'sin-referencias'

export interface ResultadoReconocimiento {
  estado: EstadoReconocimiento
  /** Por qué duda, para el modo diagnóstico. */
  motivo?: 'puntuacion-baja' | 'muy-igualados'
  /** Todos los productos con referencias, de mejor a peor. */
  ranking: PuntuacionProducto[]
}

/** Se promedian las 3 mejores coincidencias de cada producto (o las que tenga). */
export const MEJORES_COINCIDENCIAS = 3

/** Por defecto, si el segundo está a menos de 0,03 del primero, se duda. Se calibra en el modo diagnóstico. */
export const MARGEN_POR_DEFECTO = 0.03

export function normalizarL2(vector: ArrayLike<number>): number[] {
  let suma = 0
  for (let i = 0; i < vector.length; i++) suma += (vector[i] ?? 0) ** 2
  const norma = Math.sqrt(suma)
  const resultado = Array.from(vector, (v) => (norma > 0 ? v / norma : 0))
  return resultado
}

/** Similitud coseno. Con vectores ya normalizados equivale al producto escalar. */
export function similitudCoseno(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error('Los vectores no tienen la misma longitud.')
  let producto = 0
  let normaA = 0
  let normaB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    producto += x * y
    normaA += x * x
    normaB += y * y
  }
  if (normaA === 0 || normaB === 0) return 0
  return producto / Math.sqrt(normaA * normaB)
}

/** Softmax con temperatura, estable numéricamente. */
export function softmax(valores: readonly number[], temperatura: number): number[] {
  if (valores.length === 0) return []
  const t = temperatura > 0 ? temperatura : 1e-6
  const maximo = Math.max(...valores)
  const exponenciales = valores.map((v) => Math.exp((v - maximo) / t))
  const total = exponenciales.reduce((a, b) => a + b, 0)
  return exponenciales.map((e) => e / total)
}

/** Puntuación de cada producto con referencias, ordenada de mejor a peor (con su confianza relativa). */
export function puntuarProductos(
  consulta: readonly number[],
  referencias: readonly Referencia[],
  temperatura: number,
): PuntuacionProducto[] {
  const porProducto = new Map<string, number[]>()
  for (const ref of referencias) {
    if (ref.embedding.length !== consulta.length) continue
    const lista = porProducto.get(ref.productoId) ?? []
    lista.push(similitudCoseno(consulta, ref.embedding))
    porProducto.set(ref.productoId, lista)
  }
  const puntuaciones = [...porProducto].map(([productoId, similitudes]) => {
    const mejores = similitudes.sort((a, b) => b - a).slice(0, MEJORES_COINCIDENCIAS)
    return {
      productoId,
      puntuacion: mejores.reduce((a, b) => a + b, 0) / mejores.length,
      referencias: similitudes.length,
    }
  })
  puntuaciones.sort((a, b) => b.puntuacion - a.puntuacion)
  const confianzas = softmax(
    puntuaciones.map((p) => p.puntuacion),
    temperatura,
  )
  return puntuaciones.map((p, i) => ({ ...p, confianza: confianzas[i] ?? 0 }))
}

/**
 * Reconoce la foto: el mejor producto es seguro si su puntuación llega al umbral y le saca al
 * segundo al menos el margen; si no, se duda y se enseñan las alternativas (§5, paso 5).
 */
export function reconocer(
  consulta: readonly number[],
  referencias: readonly Referencia[],
  { umbral, temperatura, margen = MARGEN_POR_DEFECTO }: OpcionesReconocimiento,
): ResultadoReconocimiento {
  const ranking = puntuarProductos(consulta, referencias, temperatura)
  const [primero, segundo] = ranking
  if (!primero) return { estado: 'sin-referencias', ranking }
  if (primero.puntuacion < umbral) return { estado: 'dudoso', motivo: 'puntuacion-baja', ranking }
  if (segundo && primero.puntuacion - segundo.puntuacion < margen) {
    return { estado: 'dudoso', motivo: 'muy-igualados', ranking }
  }
  return { estado: 'seguro', ranking }
}
