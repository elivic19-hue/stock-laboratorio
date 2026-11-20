import { TAMANO_ENTRADA } from './modelo'
import { cuadradoCentrado, ladoDeFoto, recorteDelMarco, type Rect } from './recorte'

/**
 * Cámara trasera y recorte del marco (CLAUDE.md §5, paso 1).
 *
 * Desde el 20/11/2026 (docs/decisiones.md, «Fotos con mejor calidad»): lo que hay dentro del marco
 * se recorta a buena resolución (hasta LADO_FOTO) para guardarlo y enseñarlo; el modelo recibe su
 * versión de 224×224. Antes todo salía del recorte de 224 px y las fotos se veían borrosas.
 */

export type ErrorCamara = 'sin-permiso' | 'sin-camara' | 'no-segura' | 'ocupada' | 'desconocido'

export class FalloCamara extends Error {
  readonly motivo: ErrorCamara
  constructor(motivo: ErrorCamara) {
    super(motivo)
    this.motivo = motivo
  }
}

export const MENSAJES_CAMARA: Record<ErrorCamara, string> = {
  'sin-permiso':
    'La app no tiene permiso para usar la cámara. Actívalo en los ajustes del navegador para este sitio y vuelve a intentarlo.',
  'sin-camara': 'No se encuentra ninguna cámara en este dispositivo.',
  'no-segura': 'La cámara solo funciona si la app se abre con https://.',
  ocupada: 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.',
  desconocido: 'No se pudo abrir la cámara.',
}

/** Lado máximo de la foto que se guarda y se enseña (al ampliarla en la ficha ocupa casi la pantalla). */
export const LADO_FOTO = 640

export interface FotoCapturada {
  /** Lo que había dentro del marco (o el cuadrado central de una foto elegida), hasta LADO_FOTO. */
  foto: HTMLCanvasElement
  /** Resolución de la cámara, o null si la foto se eligió de la galería. Para el modo diagnóstico. */
  camara: { ancho: number; alto: number } | null
  /** Lado del cuadrado recortado, en píxeles de la imagen original. Para el modo diagnóstico. */
  recorte: number
}

export interface Camara {
  stream: MediaStream
  /** El dispositivo deja encender la linterna. */
  tieneLinterna: boolean
  linterna(encendida: boolean): Promise<void>
  cerrar(): void
}

interface CapacidadesCamara extends MediaTrackCapabilities {
  torch?: boolean
  focusMode?: string[]
}

export async function abrirCamara(): Promise<Camara> {
  if (!window.isSecureContext) throw new FalloCamara('no-segura')
  if (!navigator.mediaDevices?.getUserMedia) throw new FalloCamara('sin-camara')
  let stream: MediaStream
  try {
    // 1080p: el marco ocupa unos 700-800 px de la imagen, de sobra para una foto de 640 px.
    // (Con 1280×1280 «ideal» muchos móviles daban 1280×720 y el marco se quedaba en unos 500 px.)
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
  } catch (error) {
    const nombre = error instanceof DOMException ? error.name : ''
    if (nombre === 'NotAllowedError' || nombre === 'SecurityError') throw new FalloCamara('sin-permiso')
    if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') throw new FalloCamara('sin-camara')
    if (nombre === 'NotReadableError' || nombre === 'AbortError') throw new FalloCamara('ocupada')
    throw new FalloCamara('desconocido')
  }
  const [pista] = stream.getVideoTracks()
  const capacidades = (pista?.getCapabilities?.() ?? {}) as CapacidadesCamara
  if (capacidades.focusMode?.includes('continuous')) {
    // Enfoque continuo para que el producto, de cerca, salga nítido (si el móvil lo permite).
    void pista
      ?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      .catch(() => undefined)
  }
  return {
    stream,
    tieneLinterna: capacidades.torch === true,
    async linterna(encendida) {
      await pista?.applyConstraints({ advanced: [{ torch: encendida } as MediaTrackConstraintSet] })
    },
    cerrar() {
      for (const p of stream.getTracks()) p.stop()
    },
  }
}

/** Dibuja el cuadrado indicado de la imagen en un lienzo cuadrado de `lado` píxeles. */
export function recortarCuadrado(fuente: CanvasImageSource, recorte: Rect, lado: number): HTMLCanvasElement {
  const lienzo = document.createElement('canvas')
  lienzo.width = lado
  lienzo.height = lado
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('El navegador no permite dibujar en un lienzo.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fuente, recorte.x, recorte.y, recorte.lado, recorte.lado, 0, 0, lado, lado)
  return lienzo
}

/** Lo que se ve dentro del marco del visor, a la mejor resolución útil (hasta LADO_FOTO). */
export function capturarMarco(video: HTMLVideoElement, marco: HTMLElement): FotoCapturada {
  const vista = video.getBoundingClientRect()
  const caja = marco.getBoundingClientRect()
  const recorte = recorteDelMarco({
    videoAncho: video.videoWidth,
    videoAlto: video.videoHeight,
    vistaAncho: vista.width,
    vistaAlto: vista.height,
    marco: { x: caja.left - vista.left, y: caja.top - vista.top, lado: Math.min(caja.width, caja.height) },
  })
  return {
    foto: recortarCuadrado(video, recorte, ladoDeFoto(recorte.lado, LADO_FOTO, TAMANO_ENTRADA)),
    camara: { ancho: video.videoWidth, alto: video.videoHeight },
    recorte: Math.round(recorte.lado),
  }
}

/** Foto elegida de la galería (si no hay cámara): el cuadrado central. */
export async function capturarArchivo(archivo: File): Promise<FotoCapturada> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  try {
    const recorte = cuadradoCentrado(imagen.width, imagen.height)
    return {
      foto: recortarCuadrado(imagen, recorte, ladoDeFoto(recorte.lado, LADO_FOTO, TAMANO_ENTRADA)),
      camara: null,
      recorte: Math.round(recorte.lado),
    }
  } finally {
    imagen.close()
  }
}

/**
 * Foto JPEG que se guarda con cada referencia (campo `miniatura` de §4): la de la galería, la que se
 * amplía y la que sirve para recalcular su vector. Hasta LADO_FOTO (antes, 160 px).
 */
export function crearMiniatura(lienzo: HTMLCanvasElement, lado = LADO_FOTO): Promise<Blob> {
  const destino = Math.min(lado, lienzo.width)
  const salida = destino === lienzo.width ? lienzo : recortarCuadrado(lienzo, { x: 0, y: 0, lado: lienzo.width }, destino)
  return new Promise((resolver, rechazar) => {
    salida.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo guardar la foto.'))), 'image/jpeg', 0.85)
  })
}

/** Foto guardada → lienzo de 224×224, para recalcular su vector. */
export async function lienzoDeMiniatura(miniatura: Blob): Promise<HTMLCanvasElement> {
  const imagen = await createImageBitmap(miniatura)
  try {
    return recortarCuadrado(imagen, cuadradoCentrado(imagen.width, imagen.height), TAMANO_ENTRADA)
  } finally {
    imagen.close()
  }
}
