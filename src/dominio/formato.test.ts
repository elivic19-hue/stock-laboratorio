import { describe, expect, it } from 'vitest'
import {
  aFecha,
  diasEntre,
  fechaSinHora,
  formatearCantidadConSigno,
  formatearDiaMes,
  formatearFecha,
  formatearFechaHora,
  formatearMesAnio,
  formatearMomento,
  formatearNumero,
  formatearTamano,
  conPunto,
} from './formato'

// Fechas en hora local, para que los tests no dependan de la zona horaria del equipo.
const ahora = new Date(2026, 10, 19, 18, 30) // 19/11/2026 18:30

describe('números', () => {
  it('usa coma decimal', () => {
    expect(formatearNumero(2.5)).toBe('2,5')
    expect(formatearNumero(0.45)).toBe('0,45')
    expect(formatearNumero(150)).toBe('150')
  })

  it('agrupa los miles como en España', () => {
    expect(formatearNumero(12500)).toBe('12.500')
  })

  it('tamaños de almacenamiento en KB o MB', () => {
    expect(formatearTamano(870_400)).toBe('850 KB')
    expect(formatearTamano(14_889_779)).toBe('14,2 MB')
    expect(formatearTamano(10)).toBe('1 KB')
  })

  it('pone signo a las cantidades de los movimientos, con el menos tipográfico', () => {
    expect(formatearCantidadConSigno(10)).toBe('+10')
    expect(formatearCantidadConSigno(-1)).toBe('−1')
    expect(formatearCantidadConSigno(-2.5)).toBe('−2,5')
  })
})

describe('frases', () => {
  it('no duplica el punto de abreviaturas como «bot.»', () => {
    expect(conPunto('Quedan 7 bot.')).toBe('Quedan 7 bot.')
    expect(conPunto('Quedan 7 uds')).toBe('Quedan 7 uds.')
  })
})

describe('fechas', () => {
  it('dd/mm/aaaa', () => {
    expect(formatearFecha(new Date(2029, 2, 5))).toBe('05/03/2029')
    expect(formatearFecha('2029-03-05')).toBe('05/03/2029')
    expect(formatearFechaHora(new Date(2026, 10, 19, 8, 12))).toBe('19/11/2026 08:12')
  })

  it('interpreta las fechas sin hora en hora local', () => {
    const f = aFecha('2026-12-09')
    expect([f.getFullYear(), f.getMonth(), f.getDate(), f.getHours()]).toEqual([2026, 11, 9, 0])
    expect(fechaSinHora(f)).toBe('2026-12-09')
  })

  it('mm/aaaa para la caducidad de la lista', () => {
    expect(formatearMesAnio('2026-12-09')).toBe('12/2026')
  })

  it('cuenta días naturales sin mirar la hora', () => {
    expect(diasEntre(new Date(2026, 10, 19, 23, 59), new Date(2026, 10, 20, 0, 1))).toBe(1)
    expect(diasEntre(ahora, new Date(2026, 11, 9))).toBe(20)
    expect(diasEntre(ahora, new Date(2026, 10, 1))).toBe(-18)
  })

  it('momentos cortos como en las maquetas', () => {
    expect(formatearMomento(new Date(2026, 10, 19, 8, 12), ahora)).toBe('hoy 08:12')
    expect(formatearMomento(new Date(2026, 10, 18, 16, 40), ahora)).toBe('ayer 16:40')
    expect(formatearMomento(new Date(2026, 10, 12, 10, 5), ahora)).toBe('12 nov')
    expect(formatearMomento(new Date(2025, 11, 30, 10, 5), ahora)).toBe('30 dic 2025')
    expect(formatearDiaMes(new Date(2026, 10, 14, 9, 0), ahora)).toBe('14 nov')
  })
})
