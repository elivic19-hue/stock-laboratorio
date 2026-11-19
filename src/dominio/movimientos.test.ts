import { describe, expect, it } from 'vitest'
import type { Movimiento, Pedido } from '../datos/tipos'
import { describirMovimiento } from './movimientos'

const base: Movimiento = {
  id: 'm',
  productoId: 'p',
  tipo: 'retirada_foto',
  cantidad: -1,
  stockResultante: 11,
  usuario: 'MG',
  fecha: '2026-11-19T07:12:00.000Z',
}

describe('describirMovimiento', () => {
  it('retiradas con foto y manuales', () => {
    expect(describirMovimiento({ ...base, confianza: 0.94 })).toEqual({
      titulo: 'Retirada · foto',
      detalle: 'MG · confianza 94 %',
    })
    expect(describirMovimiento({ ...base, tipo: 'retirada_manual' })).toEqual({
      titulo: 'Retirada · manual',
      detalle: 'MG',
    })
  })

  it('entradas con lote, caducidad en mes/año y nota; «pedido» si cerró uno', () => {
    const entrada: Movimiento = {
      ...base,
      tipo: 'entrada',
      cantidad: 10,
      usuario: 'LP',
      lote: 'K4920113',
      caducidad: '2028-05-31',
      nota: 'Albarán 25-1187',
    }
    const pedido: Pedido = {
      id: 'x',
      productoId: 'p',
      estado: 'recibido',
      fechaPedido: '2026-11-10T08:00:00.000Z',
      fechaRecepcion: entrada.fecha,
    }
    expect(describirMovimiento(entrada)).toEqual({
      titulo: 'Entrada',
      detalle: 'LP · lote K4920113 · cad. 05/2028 · Albarán 25-1187',
    })
    expect(describirMovimiento(entrada, [pedido]).titulo).toBe('Entrada · pedido')
  })

  it('dice si el lote se cerró y quién', () => {
    const entrada: Movimiento = {
      ...base,
      tipo: 'entrada',
      cantidad: 4,
      lote: 'A0907-23',
      loteCerrado: { como: 'desechado', usuario: 'AR', fecha: '2026-11-19T08:00:00.000Z' },
    }
    expect(describirMovimiento(entrada).detalle).toBe('MG · lote A0907-23 · lote desechado (AR)')
  })

  it('ajustes con su motivo', () => {
    expect(describirMovimiento({ ...base, tipo: 'ajuste', cantidad: -2, nota: 'Recuento' })).toEqual({
      titulo: 'Ajuste',
      detalle: 'MG · Recuento',
    })
  })
})
