import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../datos/tipos'
import { claveLote, lotesAbiertos, lotesDeProducto, nombreDeLote, normalizarLote, referenciaDeLote } from './lotes'

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
    fecha: `2026-11-${String(n % 28 + 1).padStart(2, '0')}T09:00:00.000Z`,
    ...cambios,
  }
}
const cierre = { usuario: 'JA', fecha: '2026-11-19T10:00:00.000Z' }

describe('claves de lote', () => {
  it('el código sin espacios y en mayúsculas; sin código, la caducidad', () => {
    expect(normalizarLote(' k49 20113 ')).toBe('K4920113')
    expect(claveLote({ lote: 'k4920113' })).toBe('K4920113')
    expect(claveLote({ caducidad: '2028-05-31' })).toBe('cad:2028-05-31')
    expect(claveLote({ lote: '  ', caducidad: '2028-05-31' })).toBe('cad:2028-05-31')
    expect(claveLote({})).toBeNull()
  })
})

describe('lotesDeProducto', () => {
  it('junta las entradas del mismo lote y resta las retiradas que lo dicen', () => {
    const lotes = lotesDeProducto(
      [
        mov({ lote: 'K49', caducidad: '2028-05-31', cantidad: 4 }),
        mov({ lote: 'k49', caducidad: '2028-05-31', cantidad: 2 }), // segunda entrega del mismo lote
        mov({ tipo: 'retirada_foto', cantidad: -1, lote: 'K49' }),
        mov({ tipo: 'retirada_manual', cantidad: -2, lote: 'K49' }),
        mov({ tipo: 'retirada_manual', cantidad: -1 }), // sin lote: solo cuenta para el producto
        mov({ caducidad: '2027-01-31', cantidad: 3 }), // sin código
        mov({ tipo: 'retirada_manual', cantidad: -1, caducidad: '2027-01-31' }),
        mov({ cantidad: 5 }), // entrada sin lote ni caducidad: no es un lote
        mov({ tipo: 'retirada_manual', cantidad: -1, lote: 'NUNCA-ENTRO' }),
      ],
      HOY,
    )
    expect(lotes.map((l) => [l.clave, l.entrado, l.salido, l.quedan])).toEqual([
      ['cad:2027-01-31', 3, 1, 2], // caduca antes: va primero
      ['K49', 6, 3, 3],
    ])
    expect(lotes[1]).toMatchObject({ lote: 'K49', caducidad: '2028-05-31', archivado: false, estado: 'vigente' })
    expect(lotes[1]?.entradas).toHaveLength(2)
  })

  it('archivado si todas sus entradas están cerradas; el desechado manda en el estado', () => {
    const [agotado] = lotesDeProducto([mov({ lote: 'A', loteCerrado: { como: 'agotado', ...cierre } })], HOY)
    expect(agotado).toMatchObject({ archivado: true, estado: 'agotado', cierre: { como: 'agotado' } })
    const [mezcla] = lotesDeProducto(
      [
        mov({ lote: 'B', loteCerrado: { como: 'agotado', ...cierre } }),
        mov({ lote: 'B', loteCerrado: { como: 'desechado', ...cierre, ajusteId: 'x' } }),
      ],
      HOY,
    )
    expect(mezcla?.estado).toBe('desechado')
    const [abierto] = lotesDeProducto(
      [mov({ lote: 'C', loteCerrado: { como: 'agotado', ...cierre } }), mov({ lote: 'C' })],
      HOY,
    )
    expect(abierto?.archivado).toBe(false)
  })

  it('estado por la caducidad: caducado al acabar su mes, «caduca pronto» a 30 días o menos', () => {
    const estado = (caducidad?: string) => lotesDeProducto([mov({ lote: 'X', ...(caducidad ? { caducidad } : {}) })], HOY)[0]?.estado
    expect(estado('2026-10-31')).toBe('caducado')
    expect(estado('2026-11-30')).toBe('caduca-pronto')
    expect(estado('2026-12-31')).toBe('vigente')
    expect(estado()).toBe('sin-caducidad')
  })
})

describe('lotesAbiertos', () => {
  it('en el orden en que toca gastarlos: lo que caduca antes, primero; sin caducidad, al final', () => {
    const lotes = lotesAbiertos(
      [
        mov({ lote: 'SIN-CAD' }),
        mov({ lote: 'TARDE', caducidad: '2029-01-31' }),
        mov({ lote: 'PRONTO', caducidad: '2027-01-31' }),
        mov({ lote: 'CERRADO', caducidad: '2026-12-31', loteCerrado: { como: 'agotado', ...cierre } }),
      ],
      HOY,
    )
    expect(lotes.map((l) => l.clave)).toEqual(['PRONTO', 'TARDE', 'SIN-CAD'])
  })

  it('nombre y referencia para guardar en la retirada', () => {
    const [conCodigo, sinCodigo] = lotesAbiertos(
      [mov({ lote: 'K49', caducidad: '2027-01-31' }), mov({ caducidad: '2028-03-31' })],
      HOY,
    )
    expect(conCodigo && nombreDeLote(conCodigo)).toBe('K49')
    expect(conCodigo && referenciaDeLote(conCodigo)).toEqual({ lote: 'K49' })
    expect(sinCodigo && nombreDeLote(sinCodigo)).toBe('cad. 03/2028')
    expect(sinCodigo && referenciaDeLote(sinCodigo)).toEqual({ caducidad: '2028-03-31' })
  })
})
