import { describe, expect, it } from 'vitest'
import { normalizarCodigo, siguienteCodigo } from './codigos'

describe('siguienteCodigo', () => {
  it('empieza en 001 en cada categoría', () => {
    expect(siguienteCodigo('reactivo', [])).toBe('R-001')
    expect(siguienteCodigo('fungible', [])).toBe('F-001')
  })

  it('sigue al número más alto de su categoría', () => {
    const codigos = ['R-014', 'R-022', 'R-031', 'F-012', 'F-031']
    expect(siguienteCodigo('reactivo', codigos)).toBe('R-032')
    expect(siguienteCodigo('fungible', codigos)).toBe('F-032')
  })

  it('ignora códigos editados a mano que no siguen el patrón y no distingue mayúsculas', () => {
    expect(siguienteCodigo('reactivo', ['r-009', 'ETANOL-1', 'R-0x2', ' R-010 '])).toBe('R-011')
  })

  it('pasa de 999 sin cortar el número', () => {
    expect(siguienteCodigo('fungible', ['F-999'])).toBe('F-1000')
  })
})

describe('normalizarCodigo', () => {
  it('quita espacios y pasa a mayúsculas', () => {
    expect(normalizarCodigo('  r-014 ')).toBe('R-014')
  })
})
