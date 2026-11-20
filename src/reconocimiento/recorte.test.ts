import { describe, expect, it } from 'vitest'
import { cuadradoCentrado, ladoDeFoto, recorteDelMarco } from './recorte'

describe('recorteDelMarco', () => {
  it('cámara apaisada en un visor vertical: se recorta por los lados', () => {
    // 1280×720 mostrado en 390×600: escala 600/720 = 0,833; ocupa 1066,7 px de ancho y sobran
    // 338,3 por cada lado.
    const r = recorteDelMarco({
      videoAncho: 1280,
      videoAlto: 720,
      vistaAncho: 390,
      vistaAlto: 600,
      marco: { x: 65, y: 170, lado: 260 },
    })
    expect(r.lado).toBeCloseTo(312)
    expect(r.x).toBeCloseTo(484)
    expect(r.y).toBeCloseTo(204)
    // El centro del marco cae en el centro de la imagen
    expect(r.x + r.lado / 2).toBeCloseTo(640)
    expect(r.y + r.lado / 2).toBeCloseTo(360)
  })

  it('sin escalar, el recorte es el propio marco', () => {
    const r = recorteDelMarco({
      videoAncho: 400,
      videoAlto: 400,
      vistaAncho: 400,
      vistaAlto: 400,
      marco: { x: 50, y: 60, lado: 200 },
    })
    expect(r).toEqual({ x: 50, y: 60, lado: 200 })
  })

  it('nunca se sale de la imagen', () => {
    const r = recorteDelMarco({
      videoAncho: 640,
      videoAlto: 480,
      vistaAncho: 640,
      vistaAlto: 480,
      marco: { x: 500, y: 400, lado: 600 },
    })
    expect(r.lado).toBe(480)
    expect(r.x + r.lado).toBeLessThanOrEqual(640)
    expect(r.y).toBe(0)
  })
})

describe('cuadradoCentrado', () => {
  it('toma el lado corto y lo centra', () => {
    expect(cuadradoCentrado(4000, 3000)).toEqual({ x: 500, y: 0, lado: 3000 })
    expect(cuadradoCentrado(300, 500)).toEqual({ x: 0, y: 100, lado: 300 })
  })
})

describe('ladoDeFoto', () => {
  it('guarda el recorte a su tamaño, sin pasar de 640 ni bajar de 224', () => {
    expect(ladoDeFoto(768.4, 640, 224)).toBe(640) // cámara 1080p: se reduce
    expect(ladoDeFoto(512.2, 640, 224)).toBe(512) // cámara 720p: tal cual, sin ampliar
    expect(ladoDeFoto(150, 640, 224)).toBe(224) // muy poca resolución: al menos lo que usa el modelo
  })
})
