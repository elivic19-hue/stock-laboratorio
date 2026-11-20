import { TAMANO_ENTRADA } from './modelo'
import { cuadradoCentrado, recorteDelMarco, type Rect } from './recorte'

/** Cámara trasera y recorte del marco (CLAUDE.md §5, paso 1). */

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

export interface Camara {
  stream: MediaStream
  /** El dispositivo deja encender la linterna. */
  tieneLinterna: boolean
  linterna(encendida: boolean): Promise<void>
  cerrar(): void
}

interface CapacidadesConLinterna extends MediaTrackCapabilities {
  torch?: boolean
}

export async function abrirCamara(): Promise<Camara> {
  if (!window.isSecureContext) throw new FalloCamara('no-segura')
  if (!navigator.mediaDevices?.getUserMedia) throw new FalloCamara('sin-camara')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
    })
  } catch (error) {
    const nombre = error instanceof DOMException ? error.name : ''
    if (nombre === 'NotAllowedError' || nombre === 'SecurityError') throw new FalloCamara('sin-permiso')
    if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') throw new FalloCamara('sin-camara')
    if (nombre === 'NotReadableError' || nombre === 'AbortError') throw new FalloCamara('ocupada')
    throw new FalloCamara('desconocido')
  }
  const [pista] = stream.getVideoTracks()
  const capacidades = (pista?.getCapabilities?.() ?? {}) as CapacidadesConLinterna
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

/** Dibuja el cuadrado indicado de la imagen en un lienzo de 224×224 (la entrada del modelo). */
export function recortarA224(fuente: CanvasImageSource, recorte: Rect): HTMLCanvasElement {
  const lienzo = document.createElement('canvas')
  lienzo.width = TAMANO_ENTRADA
  lienzo.height = TAMANO_ENTRADA
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('El navegador no permite dibujar en un lienzo.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fuente, recorte.x, recorte.y, recorte.lado, recorte.lado, 0, 0, TAMANO_ENTRADA, TAMANO_ENTRADA)
  return lienzo
}

/** Lo que se ve dentro del marco del visor, a 224×224. */
export function capturarMarco(video: HTMLVideoElement, marco: HTMLElement): HTMLCanvasElement {
  const vista = video.getBoundingClientRect()
  const caja = marco.getBoundingClientRect()
  const recorte = recorteDelMarco({
    videoAncho: video.videoWidth,
    videoAlto: video.videoHeight,
    vistaAncho: vista.width,
    vistaAlto: vista.height,
    marco: { x: caja.left - vista.left, y: caja.top - vista.top, lado: Math.min(caja.width, caja.height) },
  })
  return recortarA224(video, recorte)
}

/** Foto elegida de la galería (si no hay cámara): el cuadrado central, a 224×224. */
export async function capturarArchivo(archivo: File): Promise<HTMLCanvasElement> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  try {
    return recortarA224(imagen, cuadradoCentrado(imagen.width, imagen.height))
  } finally {
    imagen.close()
  }
}

/**
 * Miniatura JPEG para la galería (§4). Desde el 20/11/2026 es de 224 px, el tamaño de entrada del
 * modelo, y no de 160: así se puede recalcular el vector de la foto desde la miniatura sin perder
 * acierto (con 160 px se pierden unos 3 puntos). Ver docs/decisiones.md.
 */
export function crearMiniatura(lienzo: HTMLCanvasElement, lado = TAMANO_ENTRADA): Promise<Blob> {
  const pequeno = document.createElement('canvas')
  pequeno.width = lado
  pequeno.height = lado
  const ctx = pequeno.getContext('2d')
  if (!ctx) return Promise.reject(new Error('El navegador no permite dibujar en un lienzo.'))
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(lienzo, 0, 0, lado, lado)
  return new Promise((resolver, rechazar) => {
    pequeno.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo crear la miniatura.'))), 'image/jpeg', 0.85)
  })
}

/** Miniatura guardada → lienzo de 224×224, para recalcular su vector. */
export async function lienzoDeMiniatura(miniatura: Blob): Promise<HTMLCanvasElement> {
  const imagen = await createImageBitmap(miniatura)
  try {
    return recortarA224(imagen, cuadradoCentrado(imagen.width, imagen.height))
  } finally {
    imagen.close()
  }
}
