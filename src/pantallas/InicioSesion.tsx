import { useId, useRef, useState, type FormEvent } from 'react'
import { esIos, estaInstalada, pedirAlmacenamientoPersistente } from '../app/plataforma'
import { entrar } from '../app/sesion'
import { mensajeDeError } from '../dominio/errores'
import { Icono } from '../ui/Icono'
import { PantallaCompleta } from '../ui/Pantalla'
import './InicioSesion.css'

interface ErrorFormulario {
  campo: 'correo' | 'contrasena' | null
  mensaje: string
}

/**
 * Primera pantalla: entrar con la cuenta de cada persona (las cuentas se crean en la consola de
 * Firebase). Sustituye al primer arranque de CLAUDE.md §7 (docs/decisiones.md).
 */
export function InicioSesion() {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<ErrorFormulario | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [avisoIphone] = useState(() => esIos() && !estaInstalada())
  const refCorreo = useRef<HTMLInputElement>(null)
  const refContrasena = useRef<HTMLInputElement>(null)
  const idFormulario = useId()
  const idCorreo = useId()
  const idContrasena = useId()
  const idError = useId()

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!correo.trim().includes('@')) {
      setError({ campo: 'correo', mensaje: 'Escribe el correo de tu cuenta.' })
      refCorreo.current?.focus()
      return
    }
    if (!contrasena) {
      setError({ campo: 'contrasena', mensaje: 'Escribe la contraseña.' })
      refContrasena.current?.focus()
      return
    }
    setError(null)
    setEntrando(true)
    // Se pide aquí, durante el gesto del usuario, para que el navegador no borre los datos.
    void pedirAlmacenamientoPersistente()
    try {
      await entrar(correo, contrasena)
    } catch (e) {
      setError({ campo: null, mensaje: e instanceof Error && e.message ? e.message : mensajeDeError(e) })
      setEntrando(false)
    }
  }

  const errorEn = (campo: ErrorFormulario['campo']) => error !== null && error.campo === campo

  return (
    <PantallaCompleta>
      <header className="inicio__cabecera">
        <span className="etiqueta">Iniciar sesión</span>
        <h1 className="inicio__titulo">Stock del laboratorio</h1>
        <p className="texto-secundario">Reactivos y material fungible. Entra con la cuenta que te han dado.</p>
      </header>

      <form id={idFormulario} className="inicio__formulario" onSubmit={enviar} noValidate>
        <div className="campo">
          <label className="etiqueta" htmlFor={idCorreo}>
            Correo
          </label>
          <input
            id={idCorreo}
            ref={refCorreo}
            className="campo__entrada"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            enterKeyHint="next"
            aria-invalid={errorEn('correo') || undefined}
            aria-describedby={errorEn('correo') ? idError : undefined}
          />
          {error?.campo === 'correo' && <MensajeError id={idError} texto={error.mensaje} />}
        </div>

        <div className="campo">
          <label className="etiqueta" htmlFor={idContrasena}>
            Contraseña
          </label>
          <input
            id={idContrasena}
            ref={refContrasena}
            className="campo__entrada"
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
            aria-invalid={errorEn('contrasena') || undefined}
            aria-describedby={errorEn('contrasena') ? idError : undefined}
          />
          {error?.campo === 'contrasena' && <MensajeError id={idError} texto={error.mensaje} />}
        </div>

        <p className="texto-secundario">
          Solo hace falta conexión para entrar la primera vez. Si no tienes cuenta, pídela a quien lleva la app.
        </p>

        {avisoIphone && (
          <div className="nota-info">
            <Icono nombre="info" tamano={18} />
            <span>
              En iPhone, instala primero la app: en Safari, botón Compartir → «Añadir a pantalla de inicio», y
              ábrela desde su icono. Safari y la app instalada no comparten la sesión.
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
          disabled={entrando}
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </PantallaCompleta>
  )
}

export function MensajeError({ id, texto }: { id?: string; texto: string }) {
  return (
    <p id={id} className="mensaje-error" role="alert">
      <Icono nombre="info" tamano={18} />
      {texto}
    </p>
  )
}
