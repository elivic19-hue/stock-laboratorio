import { MAX_FOTOS_POR_PRODUCTO } from '../datos/StockRepository'

/** Fotos que se recomienda hacer de cada producto (CLAUDE.md §5: entre 5 y 10). */
export const FOTOS_RECOMENDADAS = 10
export const FOTOS_MINIMAS = 5

/**
 * Referencia del contador «n / 10» (duda 10): hasta llegar a las 10 recomendadas se cuenta sobre
 * 10; a partir de ahí, sobre el máximo de 20 que guarda cada producto.
 */
export function objetivoFotos(total: number): number {
  return total >= FOTOS_RECOMENDADAS ? MAX_FOTOS_POR_PRODUCTO : FOTOS_RECOMENDADAS
}
