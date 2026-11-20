import { MEJORES_COINCIDENCIAS } from './comparar'

/**
 * Revisión de las fotos de referencia (Ajustes → Fotos de referencia). Solo usa los vectores
 * guardados: dice qué productos no se pueden reconocer y qué fotos están mal.
 *
 * - Cada foto se reconoce contra las demás (sin ella misma), igual que en Retirar: si sale otro
 *   producto, los dos se confunden.
 * - Fotos casi idénticas de productos distintos: con fotos reales no pasa (entre productos
 *   distintos, como mucho 0,91 con envases casi iguales); si pasa, son fotos sin el producto en el
 *   marco o vectores mal calculados.
 * - Fotos «negras»: parecidas al vector de una imagen negra (las fotos reales, como mucho 0,31).
 */

export const SIMILITUD_CASI_IDENTICA = 0.95
export const SIMILITUD_FOTO_NEGRA = 0.8

export interface FotoParaRevisar {
  id: string
  productoId: string
  /** Normalizado (L2). */
  embedding: readonly number[]
}

export interface RevisionProducto {
  productoId: string
  fotos: number
  /**
   * Fotos propias que salen como este producto al compararlas con las demás. Con una sola foto no
   * se puede comprobar (queda en 0).
   */
  reconocidas: number
  /** Producto que sale más veces en su lugar. */
  confundidoCon?: string
  /** Fotos casi idénticas a alguna de otro producto. */
  casiIdenticas: number
  /** El otro producto de esas fotos (el más frecuente). */
  casiIdenticasA?: string
  /** Fotos que parecen negras o vacías. */
  negras: number
}

export interface RevisionReferencias {
  /** Productos con fotos, en el orden de `productosActivos`. */
  productos: RevisionProducto[]
  /** Productos activos sin ninguna foto: no se pueden reconocer. */
  sinFotos: string[]
}

export function tieneProblemas(r: RevisionProducto): boolean {
  return r.fotos < 2 || r.reconocidas < r.fotos || r.casiIdenticas > 0 || r.negras > 0
}

export function revisarReferencias(
  fotos: readonly FotoParaRevisar[],
  productosActivos: readonly string[],
  { vectorNegro }: { vectorNegro: readonly number[] },
): RevisionReferencias {
  const activos = new Set(productosActivos)
  const longitud = vectorNegro.length
  const validas = fotos.filter((f) => activos.has(f.productoId) && f.embedding.length === longitud)
  const n = validas.length

  // Similitudes entre todas las fotos (los vectores están normalizados: basta el producto escalar).
  const sim: Float64Array[] = validas.map(() => new Float64Array(n))
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const s = punto(validas[i]?.embedding ?? [], validas[j]?.embedding ?? [])
      ;(sim[i] as Float64Array)[j] = s
      ;(sim[j] as Float64Array)[i] = s
    }
  }

  const indicesPorProducto = new Map<string, number[]>()
  validas.forEach((f, i) => {
    const lista = indicesPorProducto.get(f.productoId) ?? []
    lista.push(i)
    indicesPorProducto.set(f.productoId, lista)
  })

  const productos: RevisionProducto[] = []
  const sinFotos: string[] = []
  for (const productoId of productosActivos) {
    const propias = indicesPorProducto.get(productoId)
    if (!propias) {
      sinFotos.push(productoId)
      continue
    }
    let reconocidas = 0
    let casiIdenticas = 0
    let negras = 0
    const confusiones = new Map<string, number>()
    const identicasA = new Map<string, number>()
    for (const i of propias) {
      const fila = sim[i] as Float64Array
      if (propias.length >= 2) {
        const mejor = mejorProducto(fila, i, indicesPorProducto)
        if (mejor === productoId) reconocidas++
        else if (mejor) confusiones.set(mejor, (confusiones.get(mejor) ?? 0) + 1)
      }
      let otroIdentico: string | undefined
      for (let j = 0; j < n; j++) {
        const otro = validas[j]?.productoId
        if (otro && otro !== productoId && (fila[j] ?? 0) >= SIMILITUD_CASI_IDENTICA) {
          otroIdentico = otro
          break
        }
      }
      if (otroIdentico) {
        casiIdenticas++
        identicasA.set(otroIdentico, (identicasA.get(otroIdentico) ?? 0) + 1)
      }
      if (punto(validas[i]?.embedding ?? [], vectorNegro) >= SIMILITUD_FOTO_NEGRA) negras++
    }
    const confundidoCon = masFrecuente(confusiones)
    const casiIdenticasA = masFrecuente(identicasA)
    productos.push({
      productoId,
      fotos: propias.length,
      reconocidas,
      ...(confundidoCon ? { confundidoCon } : {}),
      casiIdenticas,
      ...(casiIdenticasA ? { casiIdenticasA } : {}),
      negras,
    })
  }
  return { productos, sinFotos }
}

/** Producto con mejor puntuación (media de sus mejores coincidencias) para la foto `excluida`. */
function mejorProducto(
  fila: Float64Array,
  excluida: number,
  indicesPorProducto: ReadonlyMap<string, number[]>,
): string | undefined {
  let mejor: string | undefined
  let mejorPuntuacion = -Infinity
  for (const [productoId, indices] of indicesPorProducto) {
    const similitudes = indices
      .filter((j) => j !== excluida)
      .map((j) => fila[j] ?? 0)
      .sort((a, b) => b - a)
      .slice(0, MEJORES_COINCIDENCIAS)
    if (similitudes.length === 0) continue
    const puntuacion = similitudes.reduce((a, b) => a + b, 0) / similitudes.length
    if (puntuacion > mejorPuntuacion) {
      mejorPuntuacion = puntuacion
      mejor = productoId
    }
  }
  return mejor
}

function masFrecuente(cuentas: ReadonlyMap<string, number>): string | undefined {
  let mejor: string | undefined
  let maximo = 0
  for (const [clave, cuenta] of cuentas) {
    if (cuenta > maximo) {
      maximo = cuenta
      mejor = clave
    }
  }
  return mejor
}

function punto(a: readonly number[], b: readonly number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0)
  return s
}
