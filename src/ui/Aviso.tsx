import { Icono } from './Icono'

interface Props {
  texto: string
  /** Texto del botón de acción («Actualizar», «Deshacer»…). */
  accion?: string
  alPulsarAccion?: () => void
  alCerrar?: () => void
}

/** Aviso breve en la parte de abajo de la pantalla. */
export function Aviso({ texto, accion, alPulsarAccion, alCerrar }: Props) {
  return (
    <div className="aviso" role="status">
      <span className="aviso__texto">{texto}</span>
      {accion && alPulsarAccion && (
        <button type="button" className="aviso__accion" onClick={alPulsarAccion}>
          {accion}
        </button>
      )}
      {alCerrar && (
        <button type="button" className="aviso__cerrar" aria-label="Cerrar aviso" onClick={alCerrar}>
          <Icono nombre="cerrar" tamano={18} />
        </button>
      )}
    </div>
  )
}
