import { useId, useState, type FormEvent } from 'react'
import { elegirLaboratorio, salir, useSesion } from '../app/sesion'
import { mensajeDeError } from '../dominio/errores'
import { LABORATORIOS, type IdLaboratorio } from '../datos/laboratorios'
import { PantallaCompleta } from '../ui/Pantalla'
import { MensajeError } from './InicioSesion'
import './InicioSesion.css'

/** Tras entrar por primera vez en este móvil: qué laboratorio ve esta cuenta. */
export function ElegirLaboratorio() {
  const sesion = useSesion()
  const [elegido, setElegido] = useState<IdLaboratorio>()
  const [error, setError] = useState<string | null>(null)
  const idFormulario = useId()

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!elegido) {
      setError('Elige un laboratorio.')
      return
    }
    try {
      await elegirLaboratorio(elegido)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  return (
    <PantallaCompleta>
      <header className="inicio__cabecera">
        <span className="etiqueta">Laboratorio</span>
        <h1 className="inicio__titulo">¿Qué stock quieres ver?</h1>
        <p className="texto-secundario">
          Cada laboratorio tiene su propio stock. Verás solo el que elijas; puedes cambiarlo cuando quieras en
          Ajustes.
        </p>
      </header>

      <form id={idFormulario} className="inicio__formulario" onSubmit={enviar} noValidate>
        <OpcionesLaboratorio
          elegido={elegido}
          alElegir={(id) => {
            setElegido(id)
            setError(null)
          }}
        />
        {error && <MensajeError texto={error} />}
        {sesion && (
          <p className="texto-secundario inicio__cuenta">
            <span>
              Cuenta: <span className="mono">{sesion.correo}</span>
            </span>
            <button type="button" className="enlace-boton" onClick={() => void salir()}>
              Entrar con otra cuenta
            </button>
          </p>
        )}
      </form>

      <div className="barra-accion">
        <button type="submit" form={idFormulario} className="boton boton--primario boton--grande boton--ancho">
          Entrar
        </button>
      </div>
    </PantallaCompleta>
  )
}

/** Los dos laboratorios como opciones de radio (también en Ajustes → Cambiar de laboratorio). */
export function OpcionesLaboratorio({
  elegido,
  actual,
  alElegir,
}: {
  elegido: IdLaboratorio | undefined
  /** El que se está viendo ahora, si hay uno. */
  actual?: IdLaboratorio
  alElegir: (id: IdLaboratorio) => void
}) {
  return (
    <fieldset className="opciones">
      <legend className="etiqueta opciones__leyenda">Laboratorio</legend>
      {LABORATORIOS.map((lab) => (
        <label key={lab.id} className="opcion">
          <input
            type="radio"
            name="laboratorio"
            value={lab.id}
            checked={elegido === lab.id}
            onChange={() => alElegir(lab.id)}
          />
          <span className="opcion__texto">
            <span className="opcion__titulo">{lab.nombre}</span>
            {actual === lab.id && <span className="opcion__detalle">El que estás viendo ahora</span>}
          </span>
        </label>
      ))}
    </fieldset>
  )
}
