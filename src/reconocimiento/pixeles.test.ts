import { describe, expect, it } from 'vitest'
import { pixelesPatron } from './patrones'
import { luzDePixeles, revisarPixeles } from './pixeles'

/** Imagen RGBA de un solo color, con un poco de ruido opcional. */
function uniforme(r: number, g: number, b: number, ruido = 0, lado = 32): Uint8ClampedArray {
  const datos = new Uint8ClampedArray(lado * lado * 4)
  for (let i = 0; i < datos.length; i += 4) {
    const delta = ruido ? ((i / 4) % 7) - 3 : 0
    datos[i] = r + delta * ruido
    datos[i + 1] = g + delta * ruido
    datos[i + 2] = b + delta * ruido
    datos[i + 3] = 255
  }
  return datos
}

describe('revisarPixeles', () => {
  it('una foto negra (la cámara aún no daba imagen) es «oscura»', () => {
    expect(revisarPixeles(uniforme(0, 0, 0))).toBe('oscura')
    expect(revisarPixeles(new Uint8ClampedArray(64))).toBe('oscura') // transparente
    expect(revisarPixeles(uniforme(6, 6, 6, 1))).toBe('oscura') // lente tapada, con ruido
  })

  it('una foto de un solo color es «plana»', () => {
    expect(revisarPixeles(uniforme(128, 128, 128))).toBe('plana')
    expect(revisarPixeles(uniforme(240, 235, 230, 0.5))).toBe('plana')
  })

  it('una imagen con detalle está «bien», aunque sea oscura', () => {
    expect(revisarPixeles(pixelesPatron('colores'))).toBe('bien')
    expect(revisarPixeles(pixelesPatron('ajedrez'))).toBe('bien')
    expect(revisarPixeles(uniforme(40, 30, 20, 3))).toBe('bien')
  })

  it('calcula la luz media y su desviación', () => {
    const { media, desviacion } = luzDePixeles(uniforme(100, 100, 100))
    expect(media).toBeCloseTo(100)
    expect(desviacion).toBeCloseTo(0)
    expect(luzDePixeles(new Uint8ClampedArray(0))).toEqual({ media: 0, desviacion: 0 })
  })
})
