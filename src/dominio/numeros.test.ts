import { describe, expect, it } from 'vitest'
import { leerNumero, numeroParaCampo } from './numeros'

describe('leerNumero', () => {
  it('acepta coma o punto decimal', () => {
    expect(leerNumero('2,5')).toBe(2.5)
    expect(leerNumero('2.5')).toBe(2.5)
    expect(leerNumero(' 12 ')).toBe(12)
    expect(leerNumero('0,45')).toBe(0.45)
    expect(leerNumero(',5')).toBe(0.5)
  })

  it('con punto y coma, el punto agrupa miles', () => {
    expect(leerNumero('1.250,5')).toBe(1250.5)
  })

  it('devuelve null si no es un número', () => {
    expect(leerNumero('')).toBeNull()
    expect(leerNumero('   ')).toBeNull()
    expect(leerNumero('abc')).toBeNull()
    expect(leerNumero('2,5,1')).toBeNull()
    expect(leerNumero('1e3')).toBeNull()
  })

  it('lee negativos (con guion o con el menos tipográfico)', () => {
    expect(leerNumero('-3')).toBe(-3)
    expect(leerNumero('−3')).toBe(-3)
  })
})

describe('numeroParaCampo', () => {
  it('escribe con coma y vacío si no hay valor', () => {
    expect(numeroParaCampo(2.5)).toBe('2,5')
    expect(numeroParaCampo(150)).toBe('150')
    expect(numeroParaCampo(undefined)).toBe('')
  })
})
