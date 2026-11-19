import type { Movimiento, Pedido } from '../datos/tipos'
import { formatearMesAnio } from './formato'

export interface DescripcionMovimiento {
  /** «Retirada · foto», «Entrada · pedido», «Ajuste» */
  titulo: string
  /** «MG · lote K4920113 · cad. 05/2028 · Albarán 25-1187» */
  detalle: string
}

/** Texto de un movimiento para el historial de la ficha. */
export function describirMovimiento(m: Movimiento, pedidos: readonly Pedido[] = []): DescripcionMovimiento {
  const detalle: string[] = [m.usuario]
  let titulo: string
  switch (m.tipo) {
    case 'retirada_foto':
      titulo = 'Retirada · foto'
      if (m.confianza !== undefined) detalle.push(`confianza ${Math.round(m.confianza * 100)} %`)
      break
    case 'retirada_manual':
      titulo = 'Retirada · manual'
      break
    case 'entrada': {
      // La entrada que cerró un pedido lleva su misma fecha de recepción.
      const cerroPedido = pedidos.some((p) => p.productoId === m.productoId && p.fechaRecepcion === m.fecha)
      titulo = cerroPedido ? 'Entrada · pedido' : 'Entrada'
      break
    }
    case 'ajuste':
      titulo = 'Ajuste'
      break
  }
  if (m.lote) detalle.push(`lote ${m.lote}`)
  if (m.caducidad) detalle.push(`cad. ${formatearMesAnio(m.caducidad)}`)
  if (m.nota) detalle.push(m.nota)
  return { titulo, detalle: detalle.join(' · ') }
}
