import { useMemo, useSyncExternalStore } from 'react'
import { hashDeRuta, leerRuta, type Ruta } from './rutas'

/**
 * Navegación con el historial del navegador: el botón «atrás» de Android y el gesto de iOS
 * funcionan como se espera. Cada entrada del historial lleva un índice para saber si se puede
 * volver dentro de la app y para recordar dónde estaba el scroll de cada pantalla.
 */

interface EstadoHistorial {
  indice: number
}

const oyentes = new Set<() => void>()
const posicionesScroll = new Map<number, number>()
let indiceMostrado = 0
let vieneDeAtras = false

function esEstadoHistorial(estado: unknown): estado is EstadoHistorial {
  return typeof estado === 'object' && estado !== null && typeof (estado as { indice?: unknown }).indice === 'number'
}

function indiceActual(): number {
  const estado: unknown = window.history.state
  return esEstadoHistorial(estado) ? estado.indice : 0
}

function avisar(): void {
  for (const oyente of oyentes) oyente()
}

if (typeof window !== 'undefined') {
  window.history.scrollRestoration = 'manual'
  if (!esEstadoHistorial(window.history.state)) {
    window.history.replaceState({ indice: 0 } satisfies EstadoHistorial, '')
  }
  indiceMostrado = indiceActual()

  window.addEventListener('popstate', () => {
    posicionesScroll.set(indiceMostrado, window.scrollY)
    indiceMostrado = indiceActual()
    vieneDeAtras = true
    avisar()
  })
  window.addEventListener('hashchange', avisar)
}

export function navegar(ruta: Ruta, { reemplazar = false }: { reemplazar?: boolean } = {}): void {
  const destino = hashDeRuta(ruta)
  if (!reemplazar && destino === hashDeRuta(leerRuta(window.location.hash))) {
    window.scrollTo(0, 0)
    return
  }
  posicionesScroll.set(indiceMostrado, window.scrollY)
  const indice = reemplazar ? indiceActual() : indiceActual() + 1
  const estado: EstadoHistorial = { indice }
  if (reemplazar) window.history.replaceState(estado, '', destino)
  else window.history.pushState(estado, '', destino)
  indiceMostrado = indice
  vieneDeAtras = false
  avisar()
}

/** Vuelve a la pantalla anterior; si se entró directamente a esta, va a `alternativa`. */
export function volver(alternativa: Ruta): void {
  if (indiceActual() > 0) window.history.back()
  else navegar(alternativa, { reemplazar: true })
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function useRuta(): Ruta {
  const hash = useSyncExternalStore(suscribir, () => window.location.hash)
  return useMemo(() => leerRuta(hash), [hash])
}

/** Tras cambiar de pantalla: arriba del todo, o donde estaba si se ha vuelto atrás. */
export function colocarScroll(): void {
  const y = vieneDeAtras ? (posicionesScroll.get(indiceMostrado) ?? 0) : 0
  window.scrollTo(0, y)
}
