import { useRef, useState, type FormEvent } from 'react'
import { mostrarAviso } from '../app/avisos'
import { formatearHora, formatearNumero } from '../dominio/formato'
import { mensajeDeError } from '../dominio/errores'
import { CONFIGURACION_FIREBASE, leerConfiguracionPegada } from '../datos/sincronizacion/configuracion'
import {
  conectar,
  desconectar,
  useEstadoSincronizacion,
  type EstadoSincronizacion,
  type SituacionAlConectar,
} from '../datos/sincronizacion/servicio'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'

const AYUDA = 'https://github.com/elivic19-hue/stock-laboratorio#compartir-el-stock-entre-móviles'

/** Ajustes → Compartir con el laboratorio (fase 2): todos los móviles y el ordenador ven el mismo stock. */
export function SeccionCompartir() {
  const estado = useEstadoSincronizacion()
  const [desconectarAbierto, setDesconectarAbierto] = useState(false)

  return (
    <section className="seccion" aria-labelledby="ajustes-compartir">
      <h2 id="ajustes-compartir" className="seccion__titulo">
        Compartir con el laboratorio
      </h2>

      {estado.modo === 'local' && (
        <>
          <p className="texto-secundario">
            Ahora los datos solo están en este móvil. Conecta todos los móviles del laboratorio (y el ordenador) a la
            misma cuenta y todos verán el mismo stock: los cambios llegan al momento y, sin conexión, se mandan al
            volver.
          </p>
          <FormularioConectar />
        </>
      )}

      {estado.modo === 'iniciando' && <p className="texto-secundario">Conectando con {estado.correo}…</p>}

      {estado.modo === 'conectado' && (
        <>
          <p className="ajustes__ultima-copia">
            <span className="etiqueta etiqueta--pequena">Cuenta</span>
            <span className="mono">{estado.correo}</span>
          </p>
          <p className="texto-secundario" role="status">
            {describirConexion(estado)}
          </p>
          {estado.error && (
            <p className="mensaje-error" role="alert">
              <Icono nombre="info" tamano={18} />
              {estado.error}
            </p>
          )}
          <button
            type="button"
            className="boton ajustes__boton-suelto"
            onClick={() => setDesconectarAbierto(true)}
          >
            Desconectar este móvil
          </button>
        </>
      )}

      {estado.modo === 'error' && (
        <>
          <p className="mensaje-error" role="alert">
            <Icono nombre="info" tamano={18} />
            {estado.mensaje}
          </p>
          <FormularioConectar correoInicial={estado.correo} />
          <button type="button" className="enlace-boton ajustes__boton-suelto" onClick={() => void desconectar()}>
            Dejar de usar la cuenta en este móvil
          </button>
        </>
      )}

      <Dialogo abierto={desconectarAbierto} alCerrar={() => setDesconectarAbierto(false)} titulo="Desconectar este móvil">
        <p className="texto-secundario">
          Este móvil dejará de recibir y mandar cambios. Lo que tiene ahora se queda en él como copia, sin tocar los
          datos del laboratorio.
          {estado.modo === 'conectado' && estado.enviosPendientes > 0
            ? ` Ojo: hay ${estado.enviosPendientes} cambios sin mandar todavía; si desconectas, no llegarán al laboratorio.`
            : ''}
        </p>
        <div className="hoja__acciones">
          <button type="button" className="boton" onClick={() => setDesconectarAbierto(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--oscuro"
            onClick={() => {
              setDesconectarAbierto(false)
              void desconectar().then(() => mostrarAviso({ texto: 'Móvil desconectado del laboratorio.' }))
            }}
          >
            Desconectar
          </button>
        </div>
      </Dialogo>
    </section>
  )
}

function describirConexion(estado: Extract<EstadoSincronizacion, { modo: 'conectado' }>): string {
  const pendientes =
    estado.enviosPendientes === 1 ? '1 cambio' : `${formatearNumero(estado.enviosPendientes)} cambios`
  if (!estado.conServidor) {
    return estado.enviosPendientes > 0
      ? `Sin conexión: ${pendientes} esperando para mandarse. Se mandarán solos al volver la conexión.`
      : 'Sin conexión. Los cambios que hagas se mandarán al volver la conexión.'
  }
  if (estado.enviosPendientes > 0) return `Mandando ${pendientes}…`
  return estado.ultimaSincronizacion
    ? `Al día. Última sincronización a las ${formatearHora(estado.ultimaSincronizacion)}.`
    : 'Al día.'
}

function FormularioConectar({ correoInicial = '' }: { correoInicial?: string }) {
  const [configuracion, setConfiguracion] = useState('')
  const [correo, setCorreo] = useState(correoInicial)
  const [contrasena, setContrasena] = useState('')
  const [conectando, setConectando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pregunta, setPregunta] = useState<SituacionAlConectar | null>(null)
  const respuesta = useRef<(si: boolean) => void>(undefined)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    let opciones
    try {
      opciones = CONFIGURACION_FIREBASE ?? leerConfiguracionPegada(configuracion)
    } catch (e) {
      setError(mensajeDeError(e))
      return
    }
    if (!correo.trim() || !contrasena) {
      setError('Escribe el correo y la contraseña de la cuenta del laboratorio.')
      return
    }
    setConectando(true)
    try {
      const resultado = await conectar(opciones, correo, contrasena, (situacion) => {
        setPregunta(situacion)
        return new Promise<boolean>((resolver) => {
          respuesta.current = resolver
        })
      })
      if (resultado === 'subidos') {
        mostrarAviso({ texto: 'Conectado. Los datos de este móvil se están subiendo al laboratorio.' })
      } else if (resultado === 'bajados') {
        mostrarAviso({ texto: 'Conectado. Se están descargando los datos del laboratorio.' })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : mensajeDeError(e))
    } finally {
      setConectando(false)
    }
  }

  function responder(si: boolean) {
    setPregunta(null)
    respuesta.current?.(si)
  }

  return (
    <form className="seccion" onSubmit={(e) => void enviar(e)} noValidate aria-label="Conectar con el laboratorio">
      {!CONFIGURACION_FIREBASE && (
        <label className="campo">
          <span className="etiqueta">Configuración de Firebase</span>
          <textarea
            className="campo__entrada campo__entrada--area campo__entrada--mono ajustes__configuracion"
            value={configuracion}
            onChange={(e) => setConfiguracion(e.target.value)}
            placeholder={'const firebaseConfig = {\n  apiKey: "…",\n  …\n};'}
            spellCheck={false}
            autoCapitalize="off"
            rows={4}
          />
          <span className="campo__ayuda">
            Pega el bloque «firebaseConfig» del proyecto del laboratorio.{' '}
            <a href={AYUDA} target="_blank" rel="noreferrer">
              Cómo preparar el proyecto
            </a>
            .
          </span>
        </label>
      )}
      <label className="campo">
        <span className="etiqueta">Correo del laboratorio</span>
        <input
          className="campo__entrada"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          autoComplete="username"
          autoCapitalize="off"
        />
      </label>
      <label className="campo">
        <span className="etiqueta">Contraseña</span>
        <input
          className="campo__entrada"
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && (
        <p className="mensaje-error" role="alert">
          <Icono nombre="info" tamano={18} />
          {error}
        </p>
      )}
      <button type="submit" className="boton boton--primario ajustes__boton-suelto" disabled={conectando}>
        {conectando ? 'Conectando…' : 'Conectar'}
      </button>

      <Dialogo abierto={pregunta !== null} alCerrar={() => responder(false)} titulo="El laboratorio ya tiene datos">
        <p className="texto-secundario">
          En la nube ya hay datos del laboratorio. Al conectar, lo que hay en este móvil
          {pregunta ? ` (${formatearNumero(pregunta.productosEnElMovil)} productos)` : ''} se sustituye por los datos
          del laboratorio.
        </p>
        <p className="nota-grave">
          <Icono nombre="alerta" tamano={18} />
          <span>
            Si este móvil tiene algo que no está en el laboratorio, cancela y guarda antes una copia (Copia de
            seguridad, más abajo).
          </span>
        </p>
        <div className="hoja__acciones">
          <button type="button" className="boton" onClick={() => responder(false)}>
            Cancelar
          </button>
          <button type="button" className="boton boton--oscuro" onClick={() => responder(true)}>
            Usar los del laboratorio
          </button>
        </div>
      </Dialogo>
    </form>
  )
}
