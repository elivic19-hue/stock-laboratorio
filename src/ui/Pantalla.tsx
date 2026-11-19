import type { ReactNode } from 'react'
import { useColorBarraEstado } from '../app/hooks'
import { BarraInferior, type PestanaPrincipal } from './BarraInferior'

const COLOR_FONDO = '#F3F4F1'

/** Pantallas principales (Stock, A pedir, Catálogo): llevan la barra inferior. */
export function PantallaConBarra({
  activa,
  colorBarraEstado = COLOR_FONDO,
  children,
}: {
  activa: PestanaPrincipal
  colorBarraEstado?: string
  children: ReactNode
}) {
  useColorBarraEstado(colorBarraEstado)
  return (
    <div className="pantalla pantalla--con-barra">
      {children}
      <BarraInferior activa={activa} />
    </div>
  )
}

/** Pantallas de tarea (Entrada, Retirar, Ficha, Alta, Ajustes): a pantalla completa, sin barra. */
export function PantallaCompleta({
  colorBarraEstado = COLOR_FONDO,
  className,
  children,
}: {
  colorBarraEstado?: string
  className?: string
  children: ReactNode
}) {
  useColorBarraEstado(colorBarraEstado)
  return <div className={className ? `pantalla ${className}` : 'pantalla'}>{children}</div>
}
