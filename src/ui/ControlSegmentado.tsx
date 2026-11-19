import { useId, useRef, type KeyboardEvent } from 'react'
import { formatearNumero } from '../dominio/formato'

interface Opcion<T extends string> {
  valor: T
  texto: string
  contador?: number
}

interface Props<T extends string> {
  etiqueta: string
  opciones: readonly Opcion<T>[]
  valor: T
  alCambiar: (valor: T) => void
  /** id del panel que controlan las pestañas. */
  idPanel: string
}

/** Control segmentado «Todos / Reactivos / Fungible» (pestañas accesibles, con flechas del teclado). */
export function ControlSegmentado<T extends string>({ etiqueta, opciones, valor, alCambiar, idPanel }: Props<T>) {
  const prefijo = useId()
  const botones = useRef<(HTMLButtonElement | null)[]>([])

  function alPulsarTecla(evento: KeyboardEvent<HTMLDivElement>) {
    const actual = opciones.findIndex((o) => o.valor === valor)
    let siguiente = -1
    if (evento.key === 'ArrowRight') siguiente = (actual + 1) % opciones.length
    else if (evento.key === 'ArrowLeft') siguiente = (actual - 1 + opciones.length) % opciones.length
    else if (evento.key === 'Home') siguiente = 0
    else if (evento.key === 'End') siguiente = opciones.length - 1
    const opcion = opciones[siguiente]
    if (!opcion) return
    evento.preventDefault()
    alCambiar(opcion.valor)
    botones.current[siguiente]?.focus()
  }

  return (
    <div role="tablist" aria-label={etiqueta} className="segmentado" onKeyDown={alPulsarTecla}>
      {opciones.map((opcion, i) => {
        const elegida = opcion.valor === valor
        return (
          <button
            key={opcion.valor}
            ref={(boton) => {
              botones.current[i] = boton
            }}
            id={`${prefijo}-${opcion.valor}`}
            type="button"
            role="tab"
            aria-selected={elegida}
            aria-controls={idPanel}
            tabIndex={elegida ? 0 : -1}
            className="segmentado__opcion"
            onClick={() => alCambiar(opcion.valor)}
          >
            {opcion.texto}
            {opcion.contador !== undefined && (
              <span className="segmentado__contador">{formatearNumero(opcion.contador)}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
