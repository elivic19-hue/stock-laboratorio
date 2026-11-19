import { describe, expect, it } from 'vitest'
import { abreviarArmario, abreviarBalda, ubicacionCompleta, ubicacionCorta, ubicacionMedia } from './ubicacion'

describe('ubicaciones', () => {
  it('abrevia como en las maquetas', () => {
    expect(ubicacionCorta({ armario: 'Armario inflamables', balda: 'Balda 2' })).toBe('Arm. inflamables · B2')
    expect(ubicacionCorta({ armario: 'Armario 2', balda: 'Balda 3' })).toBe('Arm. 2 · B3')
    expect(ubicacionMedia({ armario: 'Armario 2', balda: 'Balda 3' })).toBe('Arm. 2 · Balda 3')
    expect(ubicacionCompleta({ armario: 'Armario 2', balda: 'Balda 3' })).toBe('Armario 2 · Balda 3')
  })

  it('funciona sin balda y con nombres que no empiezan por «Armario»', () => {
    expect(ubicacionCorta({ armario: 'Nevera 1' })).toBe('Nevera 1')
    expect(ubicacionCompleta({ armario: 'Armario ácidos', balda: '  ' })).toBe('Armario ácidos')
  })

  it('abrevia baldas numeradas y deja igual el resto', () => {
    expect(abreviarBalda('3')).toBe('B3')
    expect(abreviarBalda('balda 4b')).toBe('B4b')
    expect(abreviarBalda('Puerta')).toBe('Puerta')
    expect(abreviarArmario('Armarios altos')).toBe('Armarios altos')
  })
})
