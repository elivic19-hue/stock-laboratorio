/**
 * Imágenes de prueba del modelo (autoprueba): se generan con fórmulas, sin lienzo, así que salen
 * idénticas en cualquier móvil o navegador. Sus vectores correctos están en vectoresAutoprueba.ts
 * (calculados con el procesador por scripts/vectores-autoprueba.mjs).
 *
 * Solo sintaxis que Node puede ejecutar sin compilar: el script de los vectores importa este archivo.
 */

export const LADO_PATRON = 224

export type NombrePatron = 'colores' | 'dianas' | 'ajedrez' | 'negro'

export const NOMBRES_PATRONES: readonly NombrePatron[] = ['colores', 'dianas', 'ajedrez', 'negro']

type Color = readonly [number, number, number]

const BARRAS: readonly Color[] = [
  [190, 40, 35],
  [235, 160, 30],
  [240, 225, 60],
  [60, 150, 70],
  [40, 120, 190],
  [110, 60, 160],
  [30, 30, 30],
]

function color(nombre: NombrePatron, x: number, y: number): Color {
  switch (nombre) {
    case 'colores': {
      // Barras verticales de colores y, abajo, una escala de grises.
      if (y >= 150) {
        const gris = Math.floor((x * 255) / (LADO_PATRON - 1))
        return [gris, gris, gris]
      }
      return BARRAS[Math.floor((x * BARRAS.length) / LADO_PATRON)] ?? [0, 0, 0]
    }
    case 'dianas': {
      // Anillos concéntricos azul oscuro y amarillo claro con un cuadrado rojo en el centro.
      if (Math.abs(x - 112) < 18 && Math.abs(y - 112) < 18) return [200, 30, 30]
      const anillo = Math.floor(Math.sqrt((x - 112) ** 2 + (y - 112) ** 2) / 14)
      return anillo % 2 === 0 ? [25, 40, 110] : [245, 230, 160]
    }
    case 'ajedrez': {
      // Tablero verde oscuro y blanco cruzado por una banda negra en diagonal.
      if (Math.abs(x - y) < 12) return [10, 10, 10]
      return (Math.floor(x / 28) + Math.floor(y / 28)) % 2 === 0 ? [30, 90, 50] : [250, 250, 245]
    }
    case 'negro':
      return [0, 0, 0]
  }
}

/** Píxeles RGBA del patrón, como los de un ImageData de 224×224. */
export function pixelesPatron(nombre: NombrePatron): Uint8ClampedArray {
  const datos = new Uint8ClampedArray(LADO_PATRON * LADO_PATRON * 4)
  for (let y = 0; y < LADO_PATRON; y++) {
    for (let x = 0; x < LADO_PATRON; x++) {
      const [r, g, b] = color(nombre, x, y)
      const i = (y * LADO_PATRON + x) * 4
      datos[i] = r
      datos[i + 1] = g
      datos[i + 2] = b
      datos[i + 3] = 255
    }
  }
  return datos
}
