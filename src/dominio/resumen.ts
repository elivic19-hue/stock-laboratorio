import type { Movimiento, Pedido, Producto } from '../datos/tipos'
import { aFecha, diasEntre } from './formato'
import { productosAPedir } from './stock'

export const DIAS_AVISO_CADUCIDAD = 30

export interface ResumenStock {
  /** Productos no archivados. */
  productos: number
  reactivos: number
  fungible: number
  /** En su mínimo o por debajo y sin pedido en curso (celda «Bajo mínimo» y contador de la barra). */
  aPedir: number
  /** Entradas que caducan en los próximos 30 días de productos que aún tienen stock. */
  caducanPronto: number
}

/**
 * Entradas con caducidad entre hoy y dentro de `dias` días cuyo producto aún tiene stock
 * (CLAUDE.md §4). Pendiente de decidir (duda 7): contar también lo ya caducado y estimar qué
 * lotes quedan.
 */
export function entradasQueCaducanPronto(
  productos: readonly Producto[],
  movimientos: readonly Movimiento[],
  hoy: Date,
  dias: number = DIAS_AVISO_CADUCIDAD,
): Movimiento[] {
  const conStock = new Set(productos.filter((p) => !p.archivado && p.stockActual > 0).map((p) => p.id))
  return movimientos.filter((m) => {
    if (m.tipo !== 'entrada' || !m.caducidad || !conStock.has(m.productoId)) return false
    const quedan = diasEntre(hoy, aFecha(m.caducidad))
    return quedan >= 0 && quedan <= dias
  })
}

export function calcularResumen(
  productos: readonly Producto[],
  pedidos: readonly Pedido[],
  movimientos: readonly Movimiento[],
  hoy: Date,
): ResumenStock {
  const activos = productos.filter((p) => !p.archivado)
  return {
    productos: activos.length,
    reactivos: activos.filter((p) => p.categoria === 'reactivo').length,
    fungible: activos.filter((p) => p.categoria === 'fungible').length,
    aPedir: productosAPedir(activos, pedidos).length,
    caducanPronto: entradasQueCaducanPronto(activos, movimientos, hoy).length,
  }
}
