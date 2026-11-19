import type { ReactNode } from 'react'
import { volver } from '../app/navegacion'
import type { Ruta } from '../app/rutas'
import { Icono } from './Icono'

interface Props {
  /** Pantalla a la que ir si se entró directamente en esta (sin historial). */
  volverA: Ruta
  titulo?: string
  /** Acción a la derecha (p. ej. «Editar»). */
  accion?: ReactNode
}

export function CabeceraVolver({ volverA, titulo, accion }: Props) {
  return (
    <header className="cabecera-volver">
      <button type="button" className="boton-icono" aria-label="Volver" onClick={() => volver(volverA)}>
        <Icono nombre="volver" />
      </button>
      {titulo && <h1 className="cabecera-volver__titulo">{titulo}</h1>}
      {accion && <div className="cabecera-volver__accion">{accion}</div>}
    </header>
  )
}
