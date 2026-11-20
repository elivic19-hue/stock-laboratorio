/**
 * Qué parte de la imagen de la cámara queda dentro del marco del visor (CLAUDE.md §5, paso 1).
 * El vídeo se muestra con «object-fit: cover»: se escala hasta cubrir el visor y se recorta lo
 * que sobra por los lados (o por arriba y abajo).
 */

export interface Rect {
  x: number
  y: number
  lado: number
}

export interface Geometria {
  /** Tamaño real de la imagen de la cámara, en píxeles. */
  videoAncho: number
  videoAlto: number
  /** Tamaño del elemento <video> en pantalla. */
  vistaAncho: number
  vistaAlto: number
  /** Marco cuadrado en pantalla, relativo a la esquina del <video>. */
  marco: Rect
}

/** Cuadrado de la imagen de la cámara que se ve dentro del marco, en píxeles de la cámara. */
export function recorteDelMarco({ videoAncho, videoAlto, vistaAncho, vistaAlto, marco }: Geometria): Rect {
  const escala = Math.max(vistaAncho / videoAncho, vistaAlto / videoAlto)
  const desplX = (vistaAncho - videoAncho * escala) / 2
  const desplY = (vistaAlto - videoAlto * escala) / 2
  const lado = Math.min(marco.lado / escala, videoAncho, videoAlto)
  const x = (marco.x - desplX) / escala
  const y = (marco.y - desplY) / escala
  return {
    x: Math.min(Math.max(0, x), videoAncho - lado),
    y: Math.min(Math.max(0, y), videoAlto - lado),
    lado,
  }
}

/**
 * Lado de la foto que se guarda: el del recorte (sin ampliarlo, que no gana nitidez), como mucho
 * `maximo` y como poco `minimo` (la entrada del modelo).
 */
export function ladoDeFoto(ladoRecorte: number, maximo: number, minimo: number): number {
  return Math.max(minimo, Math.min(maximo, Math.round(ladoRecorte)))
}

/** Cuadrado centrado lo más grande posible (fotos elegidas de la galería). */
export function cuadradoCentrado(ancho: number, alto: number): Rect {
  const lado = Math.min(ancho, alto)
  return { x: (ancho - lado) / 2, y: (alto - lado) / 2, lado }
}
