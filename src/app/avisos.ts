import { useSyncExternalStore } from 'react'

/**
 * Aviso breve de toda la app («Entrada registrada» con «Deshacer»…). Va fuera de las pantallas
 * para que siga visible al volver de una pantalla a otra.
 */
export interface DatosAviso {
  texto: string
  /** Texto del botón («Deshacer»). */
  accion?: string
  alPulsarAccion?: () => void | Promise<void>
  /** Milisegundos que se queda a la vista. */
  duracion?: number
}

export interface AvisoActivo extends DatosAviso {
  id: number
}

export const DURACION_AVISO = 6000

let actual: AvisoActivo | null = null
let siguienteId = 1
const oyentes = new Set<() => void>()

function avisar(): void {
  for (const oyente of oyentes) oyente()
}

export function mostrarAviso(datos: DatosAviso): void {
  actual = { duracion: DURACION_AVISO, ...datos, id: siguienteId++ }
  avisar()
}

/** Cierra el aviso (si se indica id, solo si sigue siendo ese). */
export function cerrarAviso(id?: number): void {
  if (!actual || (id !== undefined && actual.id !== id)) return
  actual = null
  avisar()
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function useAviso(): AvisoActivo | null {
  return useSyncExternalStore(suscribir, () => actual)
}
