import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navegar } from './navegacion'
import { hashDeRuta, type Ruta } from './rutas'

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  ruta: Ruta
  reemplazar?: boolean
}

/** Enlace interno: un <a> de verdad (accesible, se puede abrir en otra pestaña) que navega sin recargar. */
export function Enlace({ ruta, reemplazar = false, onClick, ...resto }: Props) {
  function alPulsar(evento: MouseEvent<HTMLAnchorElement>) {
    onClick?.(evento)
    if (evento.defaultPrevented || evento.button !== 0) return
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return
    evento.preventDefault()
    navegar(ruta, { reemplazar })
  }
  return <a href={hashDeRuta(ruta)} onClick={alPulsar} {...resto} />
}
