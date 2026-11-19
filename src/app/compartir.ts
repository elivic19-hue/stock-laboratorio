/**
 * Compartir y guardar archivos desde el móvil: Web Share si el navegador lo tiene y, si no,
 * portapapeles o descarga.
 */

export type ResultadoCompartir = 'compartido' | 'copiado' | 'descargado' | 'cancelado'

/** El usuario cerró la hoja de compartir sin elegir nada: no es un error. */
function esCancelacion(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function puedeCompartirTexto(): boolean {
  return typeof navigator.share === 'function'
}

/** Comparte el texto con Web Share o, si no está disponible, lo copia al portapapeles. */
export async function compartirTexto(titulo: string, texto: string): Promise<ResultadoCompartir> {
  if (puedeCompartirTexto()) {
    try {
      await navigator.share({ title: titulo, text: texto })
      return 'compartido'
    } catch (error) {
      if (esCancelacion(error)) return 'cancelado'
      // Algunos navegadores lo anuncian pero fallan (p. ej. sin permiso): se copia.
    }
  }
  await copiarTexto(texto)
  return 'copiado'
}

export async function copiarTexto(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    throw new Error('No se pudo copiar al portapapeles.')
  }
}

export function puedeCompartirArchivo(archivo: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] })
  } catch {
    return false
  }
}

/** Comparte el archivo (para mandarlo por correo, Drive…) o, si no se puede, lo descarga. */
export async function compartirArchivo(archivo: File, titulo: string): Promise<ResultadoCompartir> {
  if (puedeCompartirArchivo(archivo)) {
    try {
      await navigator.share({ files: [archivo], title: titulo })
      return 'compartido'
    } catch (error) {
      if (esCancelacion(error)) return 'cancelado'
    }
  }
  descargarArchivo(archivo)
  return 'descargado'
}

/** Descarga el archivo (en Android va a «Descargas»; en iPhone se ofrece guardarlo en Archivos). */
export function descargarArchivo(archivo: File): void {
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = archivo.name
  enlace.rel = 'noopener'
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  // Se libera después: algunos navegadores empiezan la descarga de forma asíncrona.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
