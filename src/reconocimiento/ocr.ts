/**
 * Lector de texto (OCR) para el número de lote impreso en la etiqueta (docs/decisiones.md, «Lotes:
 * archivar y restar de un lote»). Usa Tesseract.js (aprobado por el usuario el 20/11/2026), en el
 * móvil y sin conexión: el worker, el motor y el modelo de texto se sirven desde public/ocr/
 * (npm run ocr). Se carga solo la primera vez que hace falta y después se reutiliza.
 *
 * Solo hay motor con SIMD (lo tienen todos los móviles actuales): si no, no se lee y el lote se
 * elige a mano.
 */

interface Lector {
  leer(imagen: HTMLCanvasElement): Promise<string>
}

let lector: Promise<Lector | null> | undefined

/** WebAssembly con SIMD (la misma comprobación que usa wasm-feature-detect). */
function tieneSimd(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]),
    )
  } catch {
    return false
  }
}

async function crearLector(): Promise<Lector | null> {
  if (typeof WebAssembly === 'undefined' || !tieneSimd()) return null
  const { createWorker, OEM, PSM } = await import('tesseract.js')
  const ruta = (archivo: string) => new URL(`ocr/${archivo}`, document.baseURI).href
  const trabajador = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: ruta('worker.min.js'),
    corePath: ruta('tesseract-core-simd-lstm.wasm.js'),
    langPath: ruta('').replace(/\/$/, ''),
    gzip: true,
    // Lo guarda el service worker con el resto de la app: no hace falta otra copia.
    cacheMethod: 'none',
  })
  await trabajador.setParameters({
    // Texto suelto por toda la etiqueta, no un párrafo.
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/.:#',
  })
  return {
    async leer(imagen) {
      const { data } = await trabajador.recognize(imagen)
      return data.text
    },
  }
}

/**
 * Texto de la imagen (vacío si el móvil no puede leerlo). Nunca falla: si algo va mal, el lote se
 * elige a mano.
 */
export async function leerTexto(imagen: HTMLCanvasElement): Promise<string> {
  try {
    lector ??= crearLector().catch((error: unknown) => {
      console.warn('No se pudo cargar el lector de texto', error)
      lector = undefined
      return null
    })
    const listo = await lector
    return listo ? await listo.leer(preparar(imagen)) : ''
  } catch (error) {
    console.warn('No se pudo leer el texto de la etiqueta', error)
    return ''
  }
}

/** En gris y, si es pequeña, ampliada: Tesseract lee mejor con letras de 20-30 px de alto. */
function preparar(imagen: HTMLCanvasElement): HTMLCanvasElement {
  const escala = imagen.width < 1400 ? 1400 / imagen.width : 1
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  const ctx = lienzo.getContext('2d')
  if (!ctx) return imagen
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = 'grayscale(1) contrast(1.3)'
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  return lienzo
}
