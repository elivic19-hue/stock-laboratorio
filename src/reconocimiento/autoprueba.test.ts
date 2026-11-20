import { describe, expect, it } from 'vitest'
import { ejecutarAutoprueba, SIMILITUD_MINIMA_AUTOPRUEBA, vectorEsperado } from './autoprueba'
import { normalizarL2, similitudCoseno } from './comparar'
import { NOMBRES_PATRONES, pixelesPatron, type NombrePatron } from './patrones'

/** Qué patrón son estos píxeles (para los cálculos simulados). */
function cualEs(rgba: Uint8ClampedArray): NombrePatron {
  const nombre = NOMBRES_PATRONES.find((n) => pixelesPatron(n).every((v, i) => v === rgba[i]))
  if (!nombre) throw new Error('No es un patrón')
  return nombre
}

describe('vectores esperados', () => {
  it('están normalizados y son distintos entre sí', () => {
    for (const nombre of NOMBRES_PATRONES) {
      const v = vectorEsperado(nombre)
      expect(v).toHaveLength(1280)
      expect(similitudCoseno(v, v)).toBeCloseTo(1)
    }
    for (const a of NOMBRES_PATRONES) {
      for (const b of NOMBRES_PATRONES) {
        if (a !== b) expect(similitudCoseno(vectorEsperado(a), vectorEsperado(b))).toBeLessThan(0.6)
      }
    }
  })

  it('los patrones salen siempre iguales', () => {
    expect(pixelesPatron('dianas')).toEqual(pixelesPatron('dianas'))
    expect(pixelesPatron('colores')).not.toEqual(pixelesPatron('ajedrez'))
  })
})

describe('ejecutarAutoprueba', () => {
  it('pasa si el móvil calcula como el procesador (también en media precisión)', async () => {
    const exacto = await ejecutarAutoprueba(async (rgba) => vectorEsperado(cualEs(rgba)))
    expect(exacto).toEqual({ correcta: true, similitud: expect.closeTo(1, 6), estable: true })

    // Ruido pequeño, como el de la GPU con media precisión (similitud ~0,999).
    const conRuido = await ejecutarAutoprueba(async (rgba) =>
      normalizarL2(vectorEsperado(cualEs(rgba)).map((x, i) => x + (i % 3 === 0 ? 0.001 : -0.001))),
    )
    expect(conRuido.correcta).toBe(true)
    expect(conRuido.similitud).toBeGreaterThan(SIMILITUD_MINIMA_AUTOPRUEBA)
  })

  it('falla si da lo mismo con cualquier imagen', async () => {
    const r = await ejecutarAutoprueba(async () => vectorEsperado('negro'))
    expect(r.correcta).toBe(false)
    expect(r.similitud).toBeLessThan(0.6)
  })

  it('falla si devuelve el resultado de la imagen anterior', async () => {
    let anterior = vectorEsperado('negro')
    const r = await ejecutarAutoprueba(async (rgba) => {
      const devolver = anterior
      anterior = vectorEsperado(cualEs(rgba))
      return devolver
    })
    expect(r.correcta).toBe(false)
  })

  it('falla, sin lanzar el error, si el cálculo falla', async () => {
    const r = await ejecutarAutoprueba(async (rgba) => {
      if (cualEs(rgba) === 'dianas') throw new Error('NaN')
      return vectorEsperado(cualEs(rgba))
    })
    expect(r).toMatchObject({ correcta: false, similitud: 0 })
  })
})
