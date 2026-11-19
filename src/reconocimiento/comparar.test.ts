import { describe, expect, it } from 'vitest'
import { normalizarL2, puntuarProductos, reconocer, similitudCoseno, softmax, type Referencia } from './comparar'

const v = (...valores: number[]) => normalizarL2(valores)

describe('vectores', () => {
  it('normaliza a longitud 1 y deja el vector cero como está', () => {
    expect(normalizarL2([3, 4])).toEqual([0.6, 0.8])
    expect(normalizarL2([0, 0])).toEqual([0, 0])
  })

  it('similitud coseno: 1 si apuntan igual, 0 si son perpendiculares', () => {
    expect(similitudCoseno([1, 0], [5, 0])).toBeCloseTo(1)
    expect(similitudCoseno([1, 0], [0, 2])).toBeCloseTo(0)
    expect(similitudCoseno([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2)
    expect(() => similitudCoseno([1], [1, 0])).toThrow()
  })

  it('softmax con temperatura: suma 1 y una temperatura baja separa más', () => {
    const suave = softmax([0.85, 0.7], 1)
    const fuerte = softmax([0.85, 0.7], 0.05)
    expect(suave.reduce((a, b) => a + b)).toBeCloseTo(1)
    expect(fuerte[0]).toBeGreaterThan(0.94)
    expect(suave[0]).toBeLessThan(0.6)
    expect(softmax([1000, 999], 0.01).every(Number.isFinite)).toBe(true)
  })
})

describe('puntuarProductos', () => {
  it('media de las 3 mejores coincidencias de cada producto', () => {
    const consulta = v(1, 0, 0)
    const refs: Referencia[] = [
      { productoId: 'a', embedding: v(1, 0, 0) }, // 1
      { productoId: 'a', embedding: v(1, 1, 0) }, // 0,707
      { productoId: 'a', embedding: v(0, 1, 0) }, // 0
      { productoId: 'a', embedding: v(1, 0, 1) }, // 0,707
      { productoId: 'b', embedding: v(1, 1, 1) }, // 0,577 (solo una)
    ]
    const [a, b] = puntuarProductos(consulta, refs, 0.05)
    expect(a?.productoId).toBe('a')
    expect(a?.puntuacion).toBeCloseTo((1 + Math.SQRT1_2 * 2) / 3)
    expect(a?.referencias).toBe(4)
    expect(b?.puntuacion).toBeCloseTo(1 / Math.sqrt(3))
    expect((a?.confianza ?? 0) + (b?.confianza ?? 0)).toBeCloseTo(1)
  })

  it('ignora referencias de otra longitud (de otro modelo)', () => {
    expect(puntuarProductos(v(1, 0), [{ productoId: 'a', embedding: v(1, 0, 0) }], 0.05)).toEqual([])
  })
})

describe('reconocer', () => {
  const refs: Referencia[] = [
    { productoId: 'puntas-1000', embedding: v(1, 0.1, 0) },
    { productoId: 'puntas-1000', embedding: v(1, 0, 0.1) },
    { productoId: 'puntas-200', embedding: v(0.6, 0.8, 0) },
    { productoId: 'etanol', embedding: v(0, 0, 1) },
  ]
  const opciones = { umbral: 0.6, temperatura: 0.05 }

  it('seguro si supera el umbral y le saca margen al segundo', () => {
    const r = reconocer(v(1, 0, 0), refs, opciones)
    expect(r.estado).toBe('seguro')
    expect(r.ranking.map((p) => p.productoId)).toEqual(['puntas-1000', 'puntas-200', 'etanol'])
    expect(r.ranking[0]?.confianza).toBeGreaterThan(0.9)
  })

  it('duda si la mejor puntuación no llega al umbral', () => {
    const r = reconocer(v(0, 1, 1), refs, { ...opciones, umbral: 0.9 })
    expect(r).toMatchObject({ estado: 'dudoso', motivo: 'puntuacion-baja' })
  })

  it('duda si el primero y el segundo están muy igualados', () => {
    const iguales: Referencia[] = [
      { productoId: 'a', embedding: v(1, 0.01) },
      { productoId: 'b', embedding: v(1, -0.01) },
    ]
    expect(reconocer(v(1, 0), iguales, opciones)).toMatchObject({ estado: 'dudoso', motivo: 'muy-igualados' })
  })

  it('sin fotos de referencia no hay nada que proponer', () => {
    expect(reconocer(v(1, 0, 0), [], opciones)).toEqual({ estado: 'sin-referencias', ranking: [] })
  })

  it('con un solo producto con fotos, basta con el umbral', () => {
    const r = reconocer(v(1, 0, 0), [{ productoId: 'a', embedding: v(1, 0.2, 0) }], opciones)
    expect(r.estado).toBe('seguro')
    expect(r.ranking[0]?.confianza).toBe(1)
  })
})
