import type { Pedido, Producto, TipoMovimiento } from '../datos/tipos'
import { ErrorStock } from './errores'
import { formatearNumero } from './formato'
import { redondear } from './numeros'

export function esRetirada(tipo: TipoMovimiento): boolean {
  return tipo === 'retirada_foto' || tipo === 'retirada_manual'
}

/** En su mínimo o por debajo (CLAUDE.md §4: avisar cuando stockActual <= stockMinimo). */
export function estaBajoMinimo(producto: Pick<Producto, 'stockActual' | 'stockMinimo'>): boolean {
  return producto.stockActual <= producto.stockMinimo
}

/** Comprueba que la cantidad es válida y tiene el signo que corresponde al tipo de movimiento. */
export function validarCantidad(tipo: TipoMovimiento, cantidad: number): void {
  if (!Number.isFinite(cantidad) || cantidad === 0) {
    throw new ErrorStock('cantidad-no-valida', 'La cantidad tiene que ser un número distinto de cero.')
  }
  if (esRetirada(tipo) && cantidad > 0) {
    throw new ErrorStock('cantidad-no-valida', 'En una retirada la cantidad tiene que ser negativa.')
  }
  if (tipo === 'entrada' && cantidad < 0) {
    throw new ErrorStock('cantidad-no-valida', 'En una entrada la cantidad tiene que ser positiva.')
  }
}

/** Stock tras aplicar la cantidad. Nunca puede quedar negativo. */
export function calcularStockResultante(
  producto: Pick<Producto, 'stockActual' | 'unidadCorta'>,
  cantidad: number,
): number {
  // Redondeo para que 0,3 − 0,1 dé 0,2 y no 0,19999999999999998.
  const resultante = redondear(producto.stockActual + cantidad)
  if (resultante < 0) {
    throw new ErrorStock(
      'stock-insuficiente',
      `No hay stock suficiente: quedan ${formatearNumero(producto.stockActual)} ${producto.unidadCorta} ` +
        `y se intentan retirar ${formatearNumero(-cantidad)}.`,
    )
  }
  return resultante
}

/**
 * Productos que hay que pedir: en su mínimo o por debajo, no archivados y sin pedido en curso.
 *
 * Provisional (duda 6, pendiente de confirmar en la etapa 4): al marcar un producto como pedido
 * sale de esta lista y del contador, y pasa a «Pedidos en curso».
 */
export function productosAPedir(productos: readonly Producto[], pedidos: readonly Pedido[]): Producto[] {
  const conPedidoEnCurso = new Set(pedidos.filter((p) => p.estado === 'pedido').map((p) => p.productoId))
  return productos.filter((p) => !p.archivado && estaBajoMinimo(p) && !conPedidoEnCurso.has(p.id))
}

/**
 * Cantidad del movimiento de ajuste que deja el stock en `nuevoStock` (p. ej. tras un recuento).
 * Lanza un error si el valor no es válido o si no cambia nada.
 */
export function cantidadDeAjuste(stockActual: number, nuevoStock: number): number {
  if (!Number.isFinite(nuevoStock) || nuevoStock < 0) {
    throw new ErrorStock('cantidad-no-valida', 'El stock tiene que ser un número igual o mayor que cero.')
  }
  const cantidad = redondear(nuevoStock - stockActual)
  if (cantidad === 0) throw new ErrorStock('cantidad-no-valida', 'Ese es el stock que ya hay: no hay nada que ajustar.')
  return cantidad
}

export interface EfectoEntrada {
  stockResultante: number
  /** Estaba en su mínimo o por debajo y con la entrada lo supera. */
  superaMinimo: boolean
  /** Sigue en su mínimo o por debajo después de la entrada. */
  sigueBajoMinimo: boolean
}

/** Qué pasa con el producto si se registra una entrada de `cantidad` unidades. */
export function efectoEntrada(
  producto: Pick<Producto, 'stockActual' | 'stockMinimo'>,
  cantidad: number,
): EfectoEntrada {
  const stockResultante = redondear(producto.stockActual + Math.max(0, cantidad))
  const despues = { stockActual: stockResultante, stockMinimo: producto.stockMinimo }
  return {
    stockResultante,
    superaMinimo: estaBajoMinimo(producto) && !estaBajoMinimo(despues),
    sigueBajoMinimo: estaBajoMinimo(despues),
  }
}
