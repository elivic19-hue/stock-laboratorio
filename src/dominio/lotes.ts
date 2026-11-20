import type { Movimiento } from '../datos/tipos'
import { yaCaducado } from './caducidad'
import { aFecha, diasEntre } from './formato'
import { DIAS_AVISO_CADUCIDAD } from './resumen'

/**
 * Historial de lotes de un producto (ficha → «Lotes»): cada entrada que llegó con lote o con
 * caducidad, también el stock inicial si se dio de alta con ellos. Como las retiradas no dicen de
 * qué lote salen (duda 7b), no se calcula cuánto queda de cada lote: solo lo que se sabe.
 */

export type EstadoLote =
  /** Alguien lo dio por terminado. */
  | 'desechado'
  | 'agotado'
  /** Con la caducidad pasada y sin cerrar. */
  | 'caducado'
  /** Caduca en los próximos 30 días (como «Caducan <30 d»). */
  | 'caduca-pronto'
  | 'vigente'
  | 'sin-caducidad'

export interface LoteDelHistorial {
  /** La entrada con la que llegó el lote. */
  entrada: Movimiento
  estado: EstadoLote
}

/** Entradas con lote o caducidad, de la más reciente a la más antigua. */
export function historialLotes(movimientos: readonly Movimiento[], hoy: Date): LoteDelHistorial[] {
  return movimientos
    .filter((m) => m.tipo === 'entrada' && (m.lote !== undefined || m.caducidad !== undefined))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((entrada) => ({ entrada, estado: estadoLote(entrada, hoy) }))
}

export function estadoLote(entrada: Movimiento, hoy: Date): EstadoLote {
  if (entrada.loteCerrado) return entrada.loteCerrado.como
  if (!entrada.caducidad) return 'sin-caducidad'
  if (yaCaducado(entrada.caducidad, hoy)) return 'caducado'
  if (diasEntre(hoy, aFecha(entrada.caducidad)) <= DIAS_AVISO_CADUCIDAD) return 'caduca-pronto'
  return 'vigente'
}
