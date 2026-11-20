import { describe, expect, it } from 'vitest'
import { VALORES_PRODUCTO_VACIOS, validarFormularioProducto, type ValoresProducto } from './formularioProducto'

const puntas: ValoresProducto = {
  ...VALORES_PRODUCTO_VACIOS,
  categoria: 'fungible',
  nombre: ' Puntas de pipeta 1000 µL ',
  formato: 'Rack 96 uds',
  unidadCorta: 'racks',
  armario: 'Armario 2',
  balda: 'Balda 3',
  stockMinimo: '5',
  cantidadPedidoSugerida: '10',
  stockInicial: '12',
}

describe('validarFormularioProducto', () => {
  it('convierte el formulario en datos de alta', () => {
    expect(validarFormularioProducto(puntas, { esAlta: true })).toEqual({
      valido: true,
      datos: {
        nombre: 'Puntas de pipeta 1000 µL',
        categoria: 'fungible',
        formato: 'Rack 96 uds',
        unidadCorta: 'racks',
        armario: 'Armario 2',
        balda: 'Balda 3',
        stockMinimo: 5,
        cantidadPedidoSugerida: 10,
        stockInicial: 12,
      },
    })
  })

  it('lee decimales con coma y deja fuera los opcionales vacíos', () => {
    const resultado = validarFormularioProducto(
      { ...puntas, balda: ' ', cantidadPedidoSugerida: '', stockMinimo: '2,5', stockInicial: '' },
      { esAlta: true },
    )
    expect(resultado.valido && resultado.datos).toMatchObject({ stockMinimo: 2.5, stockInicial: 0 })
    expect(resultado.valido && 'balda' in resultado.datos).toBe(false)
    expect(resultado.valido && 'cantidadPedidoSugerida' in resultado.datos).toBe(false)
  })

  it('el lote del stock inicial es opcional y va con el stock inicial', () => {
    const conLote = validarFormularioProducto({ ...puntas, loteInicial: ' K4920113 ' }, { esAlta: true })
    expect(conLote.valido && conLote.datos).toMatchObject({ stockInicial: 12, loteInicial: 'K4920113' })
    const sinLote = validarFormularioProducto(puntas, { esAlta: true })
    expect(sinLote.valido && 'loteInicial' in sinLote.datos).toBe(false)

    const sinStock = validarFormularioProducto({ ...puntas, stockInicial: '0', loteInicial: 'K1' }, { esAlta: true })
    expect(sinStock).toEqual({
      valido: false,
      errores: { loteInicial: 'El lote va con el stock inicial: escribe cuántas unidades hay.' },
    })
    // Si el stock inicial ya está mal, se marca ese campo y no el lote.
    const stockMal = validarFormularioProducto({ ...puntas, stockInicial: 'x', loteInicial: 'K1' }, { esAlta: true })
    expect(!stockMal.valido && Object.keys(stockMal.errores)).toEqual(['stockInicial'])
  })

  it('en la edición no hay lote inicial', () => {
    const resultado = validarFormularioProducto({ ...puntas, codigo: 'F-001', loteInicial: 'K1' }, { esAlta: false })
    expect(resultado.valido && 'loteInicial' in resultado.datos).toBe(false)
  })

  it('marca cada campo que falta o no es un número', () => {
    const resultado = validarFormularioProducto(
      { ...VALORES_PRODUCTO_VACIOS, stockInicial: '-1', cantidadPedidoSugerida: 'diez' },
      { esAlta: true },
    )
    expect(resultado.valido).toBe(false)
    if (!resultado.valido) {
      expect(Object.keys(resultado.errores).sort()).toEqual(
        ['armario', 'cantidadPedidoSugerida', 'formato', 'nombre', 'stockInicial', 'stockMinimo', 'unidadCorta'].sort(),
      )
    }
  })

  it('en la edición el código es obligatorio y no se mira el stock inicial', () => {
    const resultado = validarFormularioProducto({ ...puntas, codigo: '', stockInicial: 'x' }, { esAlta: false })
    expect(resultado.valido).toBe(false)
    if (!resultado.valido) expect(Object.keys(resultado.errores)).toEqual(['codigo'])
  })
})
