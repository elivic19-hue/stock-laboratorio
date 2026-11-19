import { describe, expect, it } from 'vitest'
import type { Pedido, Producto } from '../datos/tipos'
import { ErrorStock } from './errores'
import {
  calcularStockResultante,
  cantidadDeAjuste,
  efectoEntrada,
  estaBajoMinimo,
  productosAPedir,
  validarCantidad,
} from './stock'

function producto(parcial: Partial<Producto>): Producto {
  return {
    id: 'p',
    codigo: 'R-001',
    nombre: 'Etanol absoluto',
    categoria: 'reactivo',
    formato: 'Botella 1 L',
    unidadCorta: 'bot.',
    armario: 'Armario inflamables',
    stockActual: 5,
    stockMinimo: 3,
    archivado: false,
    creadoEn: '2026-11-01T08:00:00.000Z',
    actualizadoEn: '2026-11-01T08:00:00.000Z',
    ...parcial,
  }
}

describe('estaBajoMinimo', () => {
  it('avisa al llegar al mínimo, no solo por debajo', () => {
    expect(estaBajoMinimo({ stockActual: 4, stockMinimo: 3 })).toBe(false)
    expect(estaBajoMinimo({ stockActual: 3, stockMinimo: 3 })).toBe(true)
    expect(estaBajoMinimo({ stockActual: 0, stockMinimo: 3 })).toBe(true)
  })
})

describe('validarCantidad', () => {
  it('exige retiradas negativas y entradas positivas', () => {
    expect(() => validarCantidad('retirada_foto', -1)).not.toThrow()
    expect(() => validarCantidad('retirada_manual', 2)).toThrow(ErrorStock)
    expect(() => validarCantidad('entrada', 6)).not.toThrow()
    expect(() => validarCantidad('entrada', -6)).toThrow(ErrorStock)
  })

  it('admite ajustes con cualquier signo, pero nunca cero ni valores no numéricos', () => {
    expect(() => validarCantidad('ajuste', -3)).not.toThrow()
    expect(() => validarCantidad('ajuste', 3)).not.toThrow()
    expect(() => validarCantidad('ajuste', 0)).toThrow(ErrorStock)
    expect(() => validarCantidad('entrada', Number.NaN)).toThrow(ErrorStock)
    expect(() => validarCantidad('entrada', Number.POSITIVE_INFINITY)).toThrow(ErrorStock)
  })
})

describe('calcularStockResultante', () => {
  it('suma y resta', () => {
    expect(calcularStockResultante({ stockActual: 12, unidadCorta: 'racks' }, -1)).toBe(11)
    expect(calcularStockResultante({ stockActual: 1, unidadCorta: 'bot.' }, 6)).toBe(7)
  })

  it('permite dejarlo exactamente a cero', () => {
    expect(calcularStockResultante({ stockActual: 2, unidadCorta: 'bid.' }, -2)).toBe(0)
  })

  it('nunca deja el stock en negativo y explica por qué', () => {
    const intento = () => calcularStockResultante({ stockActual: 2, unidadCorta: 'bot.' }, -3)
    expect(intento).toThrow(ErrorStock)
    expect(intento).toThrow('No hay stock suficiente: quedan 2 bot. y se intentan retirar 3.')
  })

  it('evita los errores de coma flotante', () => {
    expect(calcularStockResultante({ stockActual: 0.3, unidadCorta: 'L' }, -0.1)).toBe(0.2)
  })
})

describe('productosAPedir', () => {
  const etanol = producto({ id: 'etanol', stockActual: 1, stockMinimo: 3 })
  const guantes = producto({ id: 'guantes', stockActual: 1, stockMinimo: 2 })
  const puntas = producto({ id: 'puntas', stockActual: 12, stockMinimo: 5 })
  const archivado = producto({ id: 'viejo', stockActual: 0, stockMinimo: 1, archivado: true })
  const pedidoGuantes: Pedido = { id: 'x', productoId: 'guantes', estado: 'pedido', fechaPedido: '2026-11-14T09:00:00.000Z' }
  const recibidoEtanol: Pedido = {
    id: 'y',
    productoId: 'etanol',
    estado: 'recibido',
    fechaPedido: '2026-10-01T09:00:00.000Z',
    fechaRecepcion: '2026-10-05T09:00:00.000Z',
  }

  it('incluye lo que está en su mínimo o por debajo y no tiene pedido en curso', () => {
    const lista = productosAPedir([etanol, guantes, puntas, archivado], [pedidoGuantes, recibidoEtanol])
    expect(lista.map((p) => p.id)).toEqual(['etanol'])
  })
})

describe('cantidadDeAjuste', () => {
  it('es la diferencia entre el stock contado y el que había', () => {
    expect(cantidadDeAjuste(12, 10)).toBe(-2)
    expect(cantidadDeAjuste(0, 3)).toBe(3)
    expect(cantidadDeAjuste(0.3, 0.2)).toBe(-0.1)
  })

  it('no admite negativos ni un ajuste que no cambia nada', () => {
    expect(() => cantidadDeAjuste(5, -1)).toThrow(ErrorStock)
    expect(() => cantidadDeAjuste(5, Number.NaN)).toThrow(ErrorStock)
    expect(() => cantidadDeAjuste(5, 5)).toThrow('no hay nada que ajustar')
  })
})

describe('efectoEntrada', () => {
  it('avisa de que sale de «A pedir» si supera el mínimo', () => {
    expect(efectoEntrada({ stockActual: 1, stockMinimo: 3 }, 6)).toEqual({
      stockResultante: 7,
      superaMinimo: true,
      sigueBajoMinimo: false,
    })
  })

  it('llegar justo al mínimo no basta para salir', () => {
    expect(efectoEntrada({ stockActual: 1, stockMinimo: 3 }, 2)).toEqual({
      stockResultante: 3,
      superaMinimo: false,
      sigueBajoMinimo: true,
    })
  })

  it('si ya estaba por encima del mínimo no hay nada que avisar', () => {
    expect(efectoEntrada({ stockActual: 12, stockMinimo: 5 }, 10)).toEqual({
      stockResultante: 22,
      superaMinimo: false,
      sigueBajoMinimo: false,
    })
  })
})
