import type { Movimiento, Pedido, Producto } from '../datos/tipos'
import { yaCaducado } from './caducidad'
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
  /** Lotes ya caducados de productos con stock que nadie ha dado por terminados. */
  caducados: number
}

function conStock(productos: readonly Producto[]): Set<string> {
  return new Set(productos.filter((p) => !p.archivado && p.stockActual > 0).map((p) => p.id))
}

/** Entrada con caducidad cuyo lote nadie ha dado por terminado (desechado o ya no queda). */
function loteAbierto(m: Movimiento): m is Movimiento & { caducidad: string } {
  return m.tipo === 'entrada' && m.caducidad !== undefined && m.loteCerrado === undefined
}

/**
 * Entradas con caducidad entre hoy y dentro de `dias` días cuyo producto aún tiene stock
 * (CLAUDE.md §4) y cuyo lote sigue abierto.
 */
export function entradasQueCaducanPronto(
  productos: readonly Producto[],
  movimientos: readonly Movimiento[],
  hoy: Date,
  dias: number = DIAS_AVISO_CADUCIDAD,
): Movimiento[] {
  const ids = conStock(productos)
  return movimientos
    .filter((m) => {
      if (!loteAbierto(m) || !ids.has(m.productoId)) return false
      const quedan = diasEntre(hoy, aFecha(m.caducidad))
      return quedan >= 0 && quedan <= dias
    })
    .sort(porCaducidad)
}

/**
 * Lotes ya caducados (duda 7b): entradas con la caducidad pasada, de productos con stock, que
 * nadie ha dado por terminadas. Como las retiradas no dicen de qué lote salen, cuentan todas
 * hasta que alguien las marque como desechadas o «ya no queda».
 */
export function lotesCaducados(
  productos: readonly Producto[],
  movimientos: readonly Movimiento[],
  hoy: Date,
): Movimiento[] {
  const ids = conStock(productos)
  return movimientos
    .filter((m) => loteAbierto(m) && ids.has(m.productoId) && yaCaducado(m.caducidad, hoy))
    .sort(porCaducidad)
}

function porCaducidad(a: Movimiento, b: Movimiento): number {
  return (a.caducidad ?? '').localeCompare(b.caducidad ?? '') || a.fecha.localeCompare(b.fecha)
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
    caducados: lotesCaducados(activos, movimientos, hoy).length,
  }
}
