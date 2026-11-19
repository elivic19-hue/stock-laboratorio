import type { Pedido, Producto } from '../datos/tipos'
import { formatearFecha, formatearNumero } from './formato'
import { productosAPedir } from './stock'
import { ubicacionCompleta } from './ubicacion'

/** Producto con un pedido en curso (sección «Pedidos en curso» de A pedir). */
export interface PedidoEnCurso {
  pedido: Pedido
  producto: Producto
}

/**
 * Lista de A pedir: lo más urgente primero (lo que menos tiene en proporción a su mínimo) y, a
 * igualdad, por código.
 */
export function listaAPedir(productos: readonly Producto[], pedidos: readonly Pedido[]): Producto[] {
  return productosAPedir(productos, pedidos).sort(
    (a, b) => proporcion(a) - proporcion(b) || a.codigo.localeCompare(b.codigo, 'es', { numeric: true }),
  )
}

function proporcion(p: Producto): number {
  return p.stockMinimo > 0 ? p.stockActual / p.stockMinimo : p.stockActual > 0 ? 1 : 0
}

/** Pedidos aún sin recibir, del más antiguo al más reciente, con su producto. */
export function pedidosEnCurso(productos: readonly Producto[], pedidos: readonly Pedido[]): PedidoEnCurso[] {
  const porId = new Map(productos.map((p) => [p.id, p]))
  return pedidos
    .filter((p) => p.estado === 'pedido')
    .flatMap((pedido) => {
      const producto = porId.get(pedido.productoId)
      return producto ? [{ pedido, producto }] : []
    })
    .sort((a, b) => a.pedido.fechaPedido.localeCompare(b.pedido.fechaPedido))
}

/** «6 bot.», o undefined si el producto no tiene cantidad sugerida. */
export function cantidadSugerida(p: Pick<Producto, 'cantidadPedidoSugerida' | 'unidadCorta'>): string | undefined {
  return p.cantidadPedidoSugerida === undefined
    ? undefined
    : `${formatearNumero(p.cantidadPedidoSugerida)} ${p.unidadCorta}`
}

/**
 * Texto limpio para mandar por WhatsApp, Teams o correo (CLAUDE.md §7.3):
 *
 *   A pedir · Lab. caracterización · 19/11/2026
 *
 *   • Etanol absoluto 1 L: pedir 6 bot.
 *     R-014 · Botella 1 L · quedan 1, mínimo 3
 */
export function textoListaPedir(productos: readonly Producto[], laboratorio: string, ahora: Date): string {
  const cabecera = ['A pedir', laboratorio.trim(), formatearFecha(ahora)].filter(Boolean).join(' · ')
  if (productos.length === 0) return `${cabecera}\n\nNo hay nada que pedir.`
  const lineas = productos.map((p) => {
    const sugerida = cantidadSugerida(p)
    const detalle = [
      p.codigo,
      p.formato.trim(),
      `quedan ${formatearNumero(p.stockActual)}, mínimo ${formatearNumero(p.stockMinimo)}`,
    ].filter(Boolean)
    return `• ${p.nombre}${sugerida ? `: pedir ${sugerida}` : ''}\n  ${detalle.join(' · ')}`
  })
  const total = productos.length === 1 ? '1 producto.' : `${productos.length} productos.`
  return `${cabecera}\n\n${lineas.join('\n')}\n\n${total}`
}

const BOM = String.fromCharCode(0xfeff)
const COLUMNAS_CSV = ['Código', 'Producto', 'Formato', 'Quedan', 'Mínimo', 'Pedir', 'Unidad', 'Ubicación']

/**
 * CSV para abrir en Excel en español: separado por punto y coma, con coma decimal y con marca
 * BOM para que reconozca los acentos.
 */
export function csvListaPedir(productos: readonly Producto[]): string {
  const filas = productos.map((p) => [
    p.codigo,
    p.nombre,
    p.formato,
    numeroCsv(p.stockActual),
    numeroCsv(p.stockMinimo),
    p.cantidadPedidoSugerida === undefined ? '' : numeroCsv(p.cantidadPedidoSugerida),
    p.unidadCorta,
    ubicacionCompleta(p),
  ])
  return BOM +[COLUMNAS_CSV, ...filas].map((fila) => fila.map(celdaCsv).join(';')).join('\r\n') + '\r\n'
}

/** Sin separador de miles y con coma decimal: 12500 · 2,5 */
function numeroCsv(valor: number): string {
  return String(valor).replace('.', ',')
}

function celdaCsv(valor: string): string {
  return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor
}
