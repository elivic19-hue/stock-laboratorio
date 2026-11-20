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

  it('lote y caducidad del stock inicial son opcionales; la caducidad se escribe como mes/año', () => {
    const conLote = validarFormularioProducto(
      { ...puntas, loteInicial: ' K4920113 ', caducidadInicial: '05 / 2028' },
      { esAlta: true },
    )
    expect(conLote.valido && conLote.datos).toMatchObject({
      stockInicial: 12,
      loteInicial: 'K4920113',
      caducidadInicial: '2028-05-31',
    })
    const sinLote = validarFormularioProducto(puntas, { esAlta: true })
    expect(sinLote.valido && 'loteInicial' in sinLote.datos).toBe(false)
    expect(sinLote.valido && 'caducidadInicial' in sinLote.datos).toBe(false)

    const malEscrita = validarFormularioProducto({ ...puntas, caducidadInicial: '13/2028' }, { esAlta: true })
    expect(malEscrita).toEqual({ valido: false, errores: { caducidadInicial: 'El mes tiene que estar entre 01 y 12.' } })
  })

  it('sin stock inicial no hay a qué poner lote ni caducidad', () => {
    const mensaje = 'Para guardar el lote o la caducidad, escribe cuántas unidades hay.'
    expect(validarFormularioProducto({ ...puntas, stockInicial: '0', loteInicial: 'K1' }, { esAlta: true })).toEqual({
      valido: false,
      errores: { stockInicial: mensaje },
    })
    expect(validarFormularioProducto({ ...puntas, stockInicial: '', caducidadInicial: '03/29' }, { esAlta: true })).toEqual({
      valido: false,
      errores: { stockInicial: mensaje },
    })
    // Si el stock inicial ya está mal, se queda su propio error.
    const stockMal = validarFormularioProducto({ ...puntas, stockInicial: 'x', loteInicial: 'K1' }, { esAlta: true })
    expect(!stockMal.valido && stockMal.errores).toEqual({ stockInicial: 'Tiene que ser un número.' })
  })

  it('en la edición no hay lote ni caducidad inicial', () => {
    const resultado = validarFormularioProducto(
      { ...puntas, codigo: 'F-001', loteInicial: 'K1', caducidadInicial: 'xx' },
      { esAlta: false },
    )
    expect(resultado.valido && 'loteInicial' in resultado.datos).toBe(false)
    expect(resultado.valido && 'caducidadInicial' in resultado.datos).toBe(false)
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
