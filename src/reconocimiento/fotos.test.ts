import { describe, expect, it } from 'vitest'
import { objetivoFotos } from './fotos'

describe('objetivoFotos', () => {
  it('cuenta sobre 10 hasta llegar a 10 y después sobre el máximo de 20', () => {
    expect(objetivoFotos(0)).toBe(10)
    expect(objetivoFotos(6)).toBe(10)
    expect(objetivoFotos(10)).toBe(20)
    expect(objetivoFotos(14)).toBe(20)
  })
})
