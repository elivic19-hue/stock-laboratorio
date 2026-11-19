import { useId, useRef, useState, type FormEvent } from 'react'
import { useServicios } from '../app/contexto'
import { navegar } from '../app/navegacion'
import { esIos, estaInstalada, pedirAlmacenamientoPersistente } from '../app/plataforma'
import { crearDatosEjemplo } from '../datos/ejemplo'
import { mensajeDeError } from '../dominio/errores'
import { Icono } from '../ui/Icono'
import { PantallaCompleta } from '../ui/Pantalla'
import './Bienvenida.css'

type DatosIniciales = 'ejemplo' | 'vacio'

interface ErrorFormulario {
  campo: 'usuario' | 'laboratorio' | null
  mensaje: string
}

/** Primer arranque (CLAUDE.md §7): usuario, laboratorio y datos de ejemplo o vacío. */
export function Bienvenida() {
  const { repo, ajustes } = useServicios()
  const [usuario, setUsuario] = useState('')
  const [laboratorio, setLaboratorio] = useState('')
  const [datos, setDatos] = useState<DatosIniciales>('ejemplo')
  const [error, setError] = useState<ErrorFormulario | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [avisoIphone] = useState(() => esIos() && !estaInstalada())
  const refUsuario = useRef<HTMLInputElement>(null)
  const refLaboratorio = useRef<HTMLInputElement>(null)
  const idFormulario = useId()
  const idUsuario = useId()
  const idLaboratorio = useId()
  const idError = useId()

  async function empezar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const nombre = usuario.trim()
    const lab = laboratorio.trim()
    if (!nombre) {
      setError({ campo: 'usuario', mensaje: 'Escribe tu nombre o tus iniciales.' })
      refUsuario.current?.focus()
      return
    }
    if (!lab) {
      setError({ campo: 'laboratorio', mensaje: 'Escribe el nombre del laboratorio.' })
      refLaboratorio.current?.focus()
      return
    }

    setError(null)
    setPreparando(true)
    // Se pide aquí, durante el gesto del usuario, para que el navegador no borre los datos.
    void pedirAlmacenamientoPersistente()
    try {
      if (datos === 'ejemplo') await repo.reemplazarTodo(crearDatosEjemplo())
      else await repo.borrarTodo()
      navegar({ pantalla: 'stock' }, { reemplazar: true })
      // Al guardar el usuario, la app pasa del primer arranque a Stock.
      await ajustes.guardar({ usuario: nombre, laboratorio: lab })
    } catch (e) {
      setError({ campo: null, mensaje: mensajeDeError(e) })
      setPreparando(false)
    }
  }

  const errorEn = (campo: ErrorFormulario['campo']) => error !== null && error.campo === campo

  return (
    <PantallaCompleta>
      <header className="bienvenida__cabecera">
        <span className="etiqueta">Primer arranque</span>
        <h1 className="bienvenida__titulo">Stock del laboratorio</h1>
        <p className="texto-secundario">Reactivos y material fungible. Los datos se guardan solo en este móvil.</p>
      </header>

      <form id={idFormulario} className="bienvenida__formulario" onSubmit={empezar} noValidate>
        <div className="campo">
          <label className="etiqueta" htmlFor={idUsuario}>
            Tu nombre o iniciales
          </label>
          <input
            id={idUsuario}
            ref={refUsuario}
            className="campo__entrada"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Ej.: Marta G. o MG"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            aria-invalid={errorEn('usuario') || undefined}
            aria-describedby={errorEn('usuario') ? idError : undefined}
          />
          {error?.campo === 'usuario' && <MensajeError id={idError} texto={error.mensaje} />}
        </div>

        <div className="campo">
          <label className="etiqueta" htmlFor={idLaboratorio}>
            Laboratorio
          </label>
          <input
            id={idLaboratorio}
            ref={refLaboratorio}
            className="campo__entrada"
            value={laboratorio}
            onChange={(e) => setLaboratorio(e.target.value)}
            placeholder="Ej.: Lab. caracterización"
            autoComplete="organization"
            autoCapitalize="sentences"
            enterKeyHint="done"
            aria-invalid={errorEn('laboratorio') || undefined}
            aria-describedby={errorEn('laboratorio') ? idError : undefined}
          />
          {error?.campo === 'laboratorio' && <MensajeError id={idError} texto={error.mensaje} />}
        </div>

        <fieldset className="opciones">
          <legend className="etiqueta opciones__leyenda">Para empezar</legend>
          <label className="opcion">
            <input
              type="radio"
              name="datos-iniciales"
              value="ejemplo"
              checked={datos === 'ejemplo'}
              onChange={() => setDatos('ejemplo')}
            />
            <span className="opcion__texto">
              <span className="opcion__titulo">Cargar datos de ejemplo</span>
              <span className="opcion__detalle">
                Los productos de las maquetas, con movimientos y pedidos, para probar la app. Se pueden borrar
                desde Ajustes.
              </span>
            </span>
          </label>
          <label className="opcion">
            <input
              type="radio"
              name="datos-iniciales"
              value="vacio"
              checked={datos === 'vacio'}
              onChange={() => setDatos('vacio')}
            />
            <span className="opcion__texto">
              <span className="opcion__titulo">Empezar vacío</span>
              <span className="opcion__detalle">Daréis de alta vuestros productos desde Catálogo.</span>
            </span>
          </label>
        </fieldset>

        {avisoIphone && (
          <div className="nota-info">
            <Icono nombre="info" tamano={18} />
            <span>
              En iPhone, instala primero la app: en Safari, botón Compartir → «Añadir a pantalla de inicio», y
              ábrela desde su icono. Los datos de Safari y los de la app instalada no se comparten.
            </span>
          </div>
        )}

        {error?.campo === null && <MensajeError id={idError} texto={error.mensaje} />}
      </form>

      <div className="barra-accion">
        <button
          type="submit"
          form={idFormulario}
          className="boton boton--primario boton--grande boton--ancho"
          disabled={preparando}
        >
          {preparando ? 'Preparando…' : 'Empezar'}
        </button>
      </div>
    </PantallaCompleta>
  )
}

function MensajeError({ id, texto }: { id: string; texto: string }) {
  return (
    <p id={id} className="mensaje-error" role="alert">
      <Icono nombre="info" tamano={18} />
      {texto}
    </p>
  )
}
