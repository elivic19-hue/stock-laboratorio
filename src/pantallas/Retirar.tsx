import { volver } from '../app/navegacion'
import { Icono } from '../ui/Icono'
import { PantallaCompleta } from '../ui/Pantalla'
import './Retirar.css'

/** Maqueta Retirar. En la etapa 1: visor vacío con su marco cuadrado; la cámara llega en la etapa 3. */
export function Retirar() {
  return (
    <PantallaCompleta className="pantalla--visor" colorBarraEstado="#0E1114">
      <div className="visor">
        <div className="visor__barra">
          <button
            type="button"
            className="visor__boton"
            aria-label="Cerrar"
            onClick={() => volver({ pantalla: 'stock' })}
          >
            <Icono nombre="cerrar" />
          </button>
          <h1 className="visor__titulo">Retirar del stock</h1>
          {/* Aquí irá el botón de linterna (si el móvil la tiene) */}
          <span className="visor__hueco" aria-hidden="true" />
        </div>

        <div className="visor__zona">
          <div className="visor__marco" aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M1.5 12V1.5H12M98.5 12V1.5H88M1.5 88v10.5H12M98.5 88v10.5H88"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <span className="visor__pastilla">
            <span className="visor__punto" aria-hidden="true" />
            Cámara y reconocimiento · etapa 3
          </span>
        </div>
      </div>
    </PantallaCompleta>
  )
}
