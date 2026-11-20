import { describe, expect, it } from 'vitest'
import { normalizarL2 } from './comparar'
import { revisarReferencias, tieneProblemas, type FotoParaRevisar } from './revision'

const v = (...valores: number[]) => normalizarL2(valores)
let siguiente = 0
const foto = (productoId: string, embedding: number[]): FotoParaRevisar => ({
  id: `f${++siguiente}`,
  productoId,
  embedding,
})

// Dimensión 6: el último eje es «negro» (lo que da una foto negra).
const NEGRO = v(0, 0, 0, 0, 0, 1)

describe('revisarReferencias', () => {
  it('fotos bien: cada una sale como su producto', () => {
    const fotos = [
      foto('a', v(1, 0.1, 0, 0, 0, 0.1)),
      foto('a', v(1, 0, 0.1, 0, 0, 0.1)),
      foto('a', v(1, 0.05, 0.05, 0, 0, 0.1)),
      foto('b', v(0, 1, 0, 0.1, 0, 0.1)),
      foto('b', v(0.1, 1, 0, 0, 0, 0.1)),
    ]
    const r = revisarReferencias(fotos, ['a', 'b', 'c'], { vectorNegro: NEGRO })
    expect(r.sinFotos).toEqual(['c'])
    expect(r.productos).toEqual([
      { productoId: 'a', fotos: 3, reconocidas: 3, casiIdenticas: 0, negras: 0 },
      { productoId: 'b', fotos: 2, reconocidas: 2, casiIdenticas: 0, negras: 0 },
    ])
    expect(r.productos.some(tieneProblemas)).toBe(false)
  })

  it('detecta fotos casi idénticas entre productos distintos y fotos negras', () => {
    // Lo que se vería si las fotos de «b» y «c» fueran negras o se hubieran calculado mal: todas iguales.
    const fotos = [
      foto('a', v(1, 0.1, 0, 0, 0, 0)),
      foto('a', v(1, 0, 0.1, 0, 0, 0)),
      foto('b', v(0, 0, 0, 0, 0.02, 1)),
      foto('b', v(0, 0, 0, 0.02, 0, 1)),
      foto('c', v(0, 0, 0.02, 0, 0, 1)),
      foto('c', v(0.02, 0, 0, 0, 0, 1)),
    ]
    const r = revisarReferencias(fotos, ['a', 'b', 'c'], { vectorNegro: NEGRO })
    const b = r.productos.find((p) => p.productoId === 'b')
    expect(b).toMatchObject({ fotos: 2, casiIdenticas: 2, casiIdenticasA: 'c', negras: 2 })
    expect(b && tieneProblemas(b)).toBe(true)
    expect(r.productos.find((p) => p.productoId === 'a')).toMatchObject({ casiIdenticas: 0, negras: 0, reconocidas: 2 })
  })

  it('dice con qué producto se confunde y avisa de los que tienen una sola foto', () => {
    const fotos = [
      foto('x', v(1, 0, 0, 0, 0, 0)),
      foto('x', v(0, 0, 1, 0, 0, 0)), // muy distinta de la otra de «x», parecida a las de «y»
      foto('y', v(0, 0.3, 1, 0, 0, 0)),
      foto('y', v(0, 0.2, 1, 0.1, 0, 0)),
      foto('z', v(0, 0, 0, 1, 0, 0)),
    ]
    const r = revisarReferencias(fotos, ['x', 'y', 'z'], { vectorNegro: NEGRO })
    expect(r.productos.find((p) => p.productoId === 'x')).toMatchObject({ fotos: 2, confundidoCon: 'y' })
    const z = r.productos.find((p) => p.productoId === 'z')
    expect(z).toMatchObject({ fotos: 1, reconocidas: 0 })
    expect(z && tieneProblemas(z)).toBe(true)
  })

  it('no cuenta productos archivados ni vectores de otra longitud', () => {
    const fotos = [foto('a', v(1, 0, 0, 0, 0, 0)), foto('archivado', v(0, 1, 0, 0, 0, 0)), foto('a', v(1, 0))]
    const r = revisarReferencias(fotos, ['a'], { vectorNegro: NEGRO })
    expect(r.productos).toEqual([{ productoId: 'a', fotos: 1, reconocidas: 0, casiIdenticas: 0, negras: 0 }])
  })
})
