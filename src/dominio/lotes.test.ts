import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../datos/tipos'
import { estadoLote, historialLotes } from './lotes'

const HOY = new Date(2026, 10, 20, 10, 0)

let n = 0
function mov(cambios: Partial<Movimiento>): Movimiento {
  n++
  return {
    id: `m${n}`,
    productoId: 'p',
    tipo: 'entrada',
    cantidad: 2,
    stockResultante: 2,
    usuario: 'JA',
    fecha: `2026-11-${String(n).padStart(2, '0')}T09:00:00.000Z`,
    ...cambios,
  }
}

describe('historialLotes', () => {
  it('solo entradas con lote o caducidad, de la más reciente a la más antigua', () => {
    const antigua = mov({ lote: 'A1', caducidad: '2028-05-31' })
    const sinLote = mov({})
    const retirada = mov({ tipo: 'retirada_manual', cantidad: -1, lote: 'A1' })
    const soloCaducidad = mov({ caducidad: '2027-03-31' })
    const inicial = mov({ lote: 'K9', nota: 'Stock inicial' })
    const historial = historialLotes([antigua, sinLote, retirada, soloCaducidad, inicial], HOY)
    expect(historial.map((l) => l.entrada.id)).toEqual([inicial.id, soloCaducidad.id, antigua.id])
  })
})

describe('estadoLote', () => {
  it('cerrado: desechado o agotado, aunque esté caducado', () => {
    const cierre = { usuario: 'JA', fecha: '2026-11-19T10:00:00.000Z' }
    expect(estadoLote(mov({ caducidad: '2026-10-31', loteCerrado: { como: 'desechado', ...cierre } }), HOY)).toBe('desechado')
    expect(estadoLote(mov({ caducidad: '2026-10-31', loteCerrado: { como: 'agotado', ...cierre } }), HOY)).toBe('agotado')
  })

  it('por la caducidad: caducado al acabar su mes, «caduca pronto» a 30 días o menos', () => {
    expect(estadoLote(mov({ caducidad: '2026-10-31' }), HOY)).toBe('caducado')
    expect(estadoLote(mov({ caducidad: '2026-11-30' }), HOY)).toBe('caduca-pronto') // aún vale este mes
    expect(estadoLote(mov({ caducidad: '2026-12-31' }), HOY)).toBe('vigente')
    expect(estadoLote(mov({ lote: 'X' }), HOY)).toBe('sin-caducidad')
  })
})
