import { describe, expect, it } from 'vitest'
import { formatearEntradaMesAnio, leerMesAnio, yaCaducado } from './caducidad'

describe('leerMesAnio', () => {
  it('guarda el último día del mes', () => {
    expect(leerMesAnio('03 / 2029')).toEqual({ estado: 'valido', caducidad: '2029-03-31' })
    expect(leerMesAnio('11/2026')).toEqual({ estado: 'valido', caducidad: '2026-11-30' })
    expect(leerMesAnio('02/2028')).toEqual({ estado: 'valido', caducidad: '2028-02-29' }) // bisiesto
    expect(leerMesAnio('02/2027')).toEqual({ estado: 'valido', caducidad: '2027-02-28' })
  })

  it('admite el mes con una cifra, el año con dos y los números seguidos', () => {
    expect(leerMesAnio('3/29')).toEqual({ estado: 'valido', caducidad: '2029-03-31' })
    expect(leerMesAnio('3-2029')).toEqual({ estado: 'valido', caducidad: '2029-03-31' })
    expect(leerMesAnio('032029')).toEqual({ estado: 'valido', caducidad: '2029-03-31' })
    expect(leerMesAnio('1226')).toEqual({ estado: 'valido', caducidad: '2026-12-31' })
  })

  it('vacío no es un error: la caducidad es opcional', () => {
    expect(leerMesAnio('  ')).toEqual({ estado: 'vacio' })
  })

  it('rechaza meses y años imposibles o incompletos', () => {
    expect(leerMesAnio('13/2029').estado).toBe('no-valido')
    expect(leerMesAnio('00/2029').estado).toBe('no-valido')
    expect(leerMesAnio('03 / 202').estado).toBe('no-valido')
    expect(leerMesAnio('03').estado).toBe('no-valido')
    expect(leerMesAnio('31/03/2029').estado).toBe('no-valido')
    expect(leerMesAnio('03/1999').estado).toBe('no-valido')
  })
})

describe('formatearEntradaMesAnio', () => {
  it('agrupa las cifras como MM / AAAA', () => {
    expect(formatearEntradaMesAnio('0')).toBe('0')
    expect(formatearEntradaMesAnio('03')).toBe('03')
    expect(formatearEntradaMesAnio('032')).toBe('03 / 2')
    expect(formatearEntradaMesAnio('032029')).toBe('03 / 2029')
    expect(formatearEntradaMesAnio('03 / 20291')).toBe('03 / 2029')
  })

  it('completa el mes de una cifra al escribir el separador', () => {
    expect(formatearEntradaMesAnio('3/')).toBe('03 / ')
    expect(formatearEntradaMesAnio('3/2029')).toBe('03 / 2029')
    expect(formatearEntradaMesAnio('03/')).toBe('03 / ')
  })

  it('al borrar no vuelve a poner la barra', () => {
    expect(formatearEntradaMesAnio('03 /', true)).toBe('03')
    expect(formatearEntradaMesAnio('03 / 2', true)).toBe('03 / 2')
  })
})

describe('yaCaducado', () => {
  it('compara con el día de hoy', () => {
    const hoy = new Date(2026, 10, 19)
    expect(yaCaducado('2026-10-31', hoy)).toBe(true)
    expect(yaCaducado('2026-11-30', hoy)).toBe(false)
  })
})
