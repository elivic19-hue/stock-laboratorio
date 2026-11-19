/** iPhone o iPad (los iPad recientes se presentan como Mac con pantalla táctil). */
export function esIos(): boolean {
  const agente = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(agente) || (/Macintosh/.test(agente) && navigator.maxTouchPoints > 1)
}

/** La app se está usando instalada (desde el icono), no en una pestaña del navegador. */
export function estaInstalada(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Pide al navegador que no borre los datos de la app aunque falte espacio. Importante en la
 * fase 1, en la que los datos solo viven en este móvil.
 */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export interface EstadoAlmacenamiento {
  /** undefined si el navegador no lo dice. */
  persistente: boolean | undefined
  usadoBytes: number | undefined
}

export async function consultarAlmacenamiento(): Promise<EstadoAlmacenamiento> {
  try {
    const [persistente, estimacion] = await Promise.all([
      navigator.storage?.persisted?.(),
      navigator.storage?.estimate?.(),
    ])
    return { persistente, usadoBytes: estimacion?.usage }
  } catch {
    return { persistente: undefined, usadoBytes: undefined }
  }
}
