import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../datos/tipos'
import { lotesAbiertos } from '../dominio/lotes'
import { distanciaEdicion, leerGs1, loteDeEtiqueta, loteEnCodigos, loteEnTexto, loteImpreso } from './etiquetas'

const GS = '\u001d'

describe('leerGs1', () => {
  it('DataMatrix de un frasco: GTIN, caducidad y lote seguidos', () => {
    expect(leerGs1(`0104022536033556172807311${'0'}K4920113`)).toEqual({
      gtin: '04022536033556',
      caducidad: '2028-07-31',
      lote: 'K4920113',
    })
    // Con prefijo de simbología, el día 00 (= fin de mes) y un número de serie detrás del lote.
    expect(leerGs1(`]d2${'01'}04022536033556${'17'}290300${'10'}A0907-23${GS}21000123`)).toEqual({
      gtin: '04022536033556',
      caducidad: '2029-03-31',
      lote: 'A0907-23',
    })
  })

  it('con paréntesis, como se imprime debajo del código', () => {
    expect(leerGs1('(01)04022536033556(17)280531(10)S1158730')).toEqual({
      gtin: '04022536033556',
      caducidad: '2028-05-31',
      lote: 'S1158730',
    })
  })

  it('no es GS1: una URL, un texto o un AI desconocido al principio', () => {
    expect(leerGs1('https://www.ejemplo.com/coa?lot=K4920113')).toBeNull()
    expect(leerGs1('ACETONITRILO HPLC')).toBeNull()
    expect(leerGs1('8812345')).toBeNull()
  })
})

describe('lote en la etiqueta', () => {
  let n = 0
  const entrada = (lote: string, caducidad?: string): Movimiento => ({
    id: `e${++n}`,
    productoId: 'p',
    tipo: 'entrada',
    cantidad: 2,
    stockResultante: 2,
    usuario: 'JA',
    fecha: `2026-11-0${n}T09:00:00.000Z`,
    lote,
    ...(caducidad ? { caducidad } : {}),
  })
  const lotes = lotesAbiertos(
    [entrada('K4920113', '2028-07-31'), entrada('S1158730', '2027-05-31'), entrada('A1')],
    new Date(2026, 10, 20),
  )

  it('elige el lote registrado que dice el código GS1', () => {
    expect(loteEnCodigos([`010402253603355617280731${'10'}K4920113`], lotes)).toBe('K4920113')
  })

  it('o el que aparece en un texto («LOT …») o dentro de una URL', () => {
    expect(loteDeEtiqueta(['Lot: S1158730 Exp 2027-05'])).toBe('S1158730')
    expect(loteEnCodigos(['Lot: s1158730'], lotes)).toBe('S1158730')
    expect(loteEnCodigos(['https://coa.ejemplo.com/?l=K4920113'], lotes)).toBe('K4920113')
  })

  it('no se fía de códigos cortos ni de lotes que no están registrados', () => {
    expect(loteEnCodigos(['XA1Z'], lotes)).toBeUndefined()
    expect(loteEnCodigos(['(10)ZZ999'], lotes)).toBeUndefined()
    expect(loteDeEtiqueta(['(10)ZZ999'])).toBe('ZZ999')
    expect(loteEnCodigos([], lotes)).toBeUndefined()
  })
})

describe('lote en el texto impreso (OCR)', () => {
  let n = 0
  const entrada = (lote: string, caducidad = '2028-01-31'): Movimiento => ({
    id: `o${++n}`,
    productoId: 'p',
    tipo: 'entrada',
    cantidad: 2,
    stockResultante: 2,
    usuario: 'JA',
    fecha: `2026-10-${String(n).padStart(2, '0')}T09:00:00.000Z`,
    lote,
    caducidad,
  })
  const lotes = lotesAbiertos(
    [entrada('4920113'), entrada('4920114', '2028-02-29'), entrada('22H1507'), entrada('K1')],
    new Date(2026, 10, 20),
  )

  it('encuentra el lote entre el resto del texto de la etiqueta', () => {
    const etiqueta = 'ACETONITRILO\nHPLC GRADIENT\nLot: 4920113\nExp. 2028-01\n2.5 L'
    expect(loteEnTexto(etiqueta, lotes)).toBe('4920113')
    expect(loteImpreso(etiqueta)).toBe('4920113')
  })

  it('tolera letras que parecen cifras y un carácter de más o de menos', () => {
    expect(loteEnTexto('LOT 492O1I3', lotes)).toBe('4920113') // O→0, I→1
    expect(loteEnTexto('Lote 49200113', lotes)).toBe('4920113') // una cifra de más
    expect(loteEnTexto('Lote 4920 114', lotes)).toBe('4920114') // partido por un espacio
    expect(loteEnTexto('Batch: 22H15O7', lotes)).toBe('22H1507') // alfanumérico: sin cambiar letras
  })

  it('no elige si dos lotes encajan igual o si nada se parece', () => {
    expect(loteEnTexto('Lote 4920118', lotes)).toBeUndefined() // a uno de 4920113 y de 4920114
    expect(loteEnTexto('Lote 7777777', lotes)).toBeUndefined()
    expect(loteEnTexto('K1 K1 K1', lotes)).toBeUndefined() // los códigos cortos no se buscan
    expect(loteEnTexto('', lotes)).toBeUndefined()
  })

  it('reconoce cómo se escribe el lote en distintas etiquetas', () => {
    expect(loteImpreso('Ch.-B.: K49201134')).toBe('K49201134')
    expect(loteImpreso('LOT NO. 22H1507')).toBe('22H1507')
    expect(loteImpreso('Batch 0000123456')).toBe('0000123456')
    expect(loteImpreso('Acetonitrilo 2,5 L')).toBeUndefined()
    expect(loteImpreso('BODY LOTION 250 ML')).toBeUndefined()
  })
})

describe('distanciaEdicion', () => {
  it('cuenta cambios, altas y bajas', () => {
    expect(distanciaEdicion('4920113', '4920113')).toBe(0)
    expect(distanciaEdicion('4920113', '4920118')).toBe(1)
    expect(distanciaEdicion('492013', '4920113')).toBe(1)
    expect(distanciaEdicion('', 'ABC')).toBe(3)
  })
})
