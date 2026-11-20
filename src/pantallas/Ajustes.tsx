import { useEffect, useState, type FormEvent } from 'react'
import { useServicios } from '../app/contexto'
import { useAjustes, useConsulta } from '../app/hooks'
import { consultarAlmacenamiento, type EstadoAlmacenamiento } from '../app/plataforma'
import { AJUSTES_INICIALES, type AjustesDispositivo } from '../datos/ajustes'
import { leerNumero, numeroParaCampo } from '../dominio/numeros'
import { useEstadoModelo, type EstadoModelo } from '../reconocimiento/modelo'
import { mensajeDeError } from '../dominio/errores'
import { formatearFechaHora, formatearNumero, formatearTamano } from '../dominio/formato'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { Dialogo } from '../ui/Dialogo'
import { PantallaCompleta } from '../ui/Pantalla'
import { SeccionAvisos } from './AjustesAvisos'
import { SeccionCuenta } from './AjustesCuenta'
import { salir } from '../app/sesion'
import { navegar } from '../app/navegacion'
import { SeccionCopia } from './AjustesCopia'
import { SeccionFotosReferencia } from './AjustesFotos'
import './Ajustes.css'

/** Ajustes (sin maqueta): perfil, avisos, reconocimiento, copia de seguridad, datos del móvil y borrado. */
export function Ajustes() {
  const { ajustes: almacen } = useServicios()
  const ajustes = useAjustes()
  const recuento = useConsulta((r) => r.contar(), []).datos
  const [almacenamiento, setAlmacenamiento] = useState<EstadoAlmacenamiento>()
  const [borrarAbierto, setBorrarAbierto] = useState(false)

  useEffect(() => {
    let vigente = true
    void consultarAlmacenamiento().then((estado) => {
      if (vigente) setAlmacenamiento(estado)
    })
    return () => {
      vigente = false
    }
  }, [recuento])

  async function borrarTodo() {
    // Solo afecta a este móvil: se cierra la sesión y después se borran las bases de datos del
    // móvil, sin mandar nada a la nube.
    navegar({ pantalla: 'stock' }, { reemplazar: true })
    await salir({ borrarDatos: true })
  }

  const celdas = [
    ['Productos', recuento?.productos],
    ['Movimientos', recuento?.movimientos],
    ['Fotos', recuento?.fotos],
    ['Pedidos', recuento?.pedidos],
  ] as const

  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'stock' }} titulo="Ajustes" />
      <main className="contenido ajustes">
        <SeccionCuenta />

        {ajustes && <FormularioPerfil ajustes={ajustes} alGuardar={(cambios) => almacen.guardar(cambios)} />}

        {ajustes && <SeccionAvisos ajustes={ajustes} alGuardar={(cambios) => almacen.guardar(cambios)} />}

        {ajustes && <FormularioReconocimiento ajustes={ajustes} alGuardar={(cambios) => almacen.guardar(cambios)} />}

        <SeccionFotosReferencia />

        {ajustes && <SeccionCopia ajustes={ajustes} recuento={recuento} />}

        <section className="seccion" aria-labelledby="ajustes-datos">
          <h2 id="ajustes-datos" className="seccion__titulo">
            Datos en este móvil
          </h2>
          <p className="texto-secundario">Copia en el móvil del stock de {ajustes?.laboratorio ?? 'este laboratorio'}:</p>
          <div className="ficha">
            {celdas.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="ficha__celda">
                <span className="etiqueta etiqueta--pequena">{etiqueta}</span>
                <span className="ficha__valor">{valor === undefined ? '–' : formatearNumero(valor)}</span>
              </div>
            ))}
          </div>
          <p className="texto-secundario">{describirAlmacenamiento(almacenamiento)}</p>
          <button type="button" className="boton boton--contorno" onClick={() => setBorrarAbierto(true)}>
            Borrar los datos de este móvil
          </button>
        </section>

        <p className="ajustes__version">
          Versión {__VERSION_APP__} · {formatearFechaHora(__FECHA_COMPILACION__)}
        </p>
      </main>

      <DialogoBorrar abierto={borrarAbierto} alCerrar={() => setBorrarAbierto(false)} alBorrar={borrarTodo} />
    </PantallaCompleta>
  )
}

function describirAlmacenamiento(estado: EstadoAlmacenamiento | undefined): string {
  if (!estado) return ''
  const partes: string[] = []
  if (estado.persistente === true) {
    partes.push('Almacenamiento persistente: el navegador no borrará estos datos aunque le falte espacio.')
  } else if (estado.persistente === false) {
    partes.push(
      'Almacenamiento no persistente: si el móvil se queda sin espacio, el navegador podría borrar estos datos. ' +
        'Instalar la app ayuda a evitarlo.',
    )
  }
  if (estado.usadoBytes !== undefined) {
    partes.push(`La app ocupa ${formatearTamano(estado.usadoBytes)} (datos y archivos de la propia app).`)
  }
  return partes.join(' ')
}

function FormularioPerfil({
  ajustes,
  alGuardar,
}: {
  ajustes: AjustesDispositivo
  alGuardar: (cambios: Partial<AjustesDispositivo>) => Promise<unknown>
}) {
  const [usuario, setUsuario] = useState(ajustes.usuario)
  const [estado, setEstado] = useState<'editando' | 'guardando' | 'guardado'>('editando')
  const [error, setError] = useState<string | null>(null)

  const hayCambios = usuario.trim() !== ajustes.usuario

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!usuario.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    setError(null)
    setEstado('guardando')
    try {
      await alGuardar({ usuario })
      setEstado('guardado')
    } catch (e) {
      setError(mensajeDeError(e))
      setEstado('editando')
    }
  }


  return (
    <form className="seccion" onSubmit={guardar} noValidate aria-labelledby="ajustes-perfil">
      <h2 id="ajustes-perfil" className="seccion__titulo">
        Perfil
      </h2>
      <label className="campo">
        <span className="etiqueta">Tu nombre o iniciales</span>
        <input
          className="campo__entrada"
          value={usuario}
          onChange={(e) => {
            setUsuario(e.target.value)
            setEstado('editando')
          }}
          autoComplete="name"
          aria-invalid={(error !== null && !usuario.trim()) || undefined}
        />
      </label>
      <p className="texto-secundario">
        Cada movimiento queda registrado con este nombre. Se recuerda para tu cuenta en este móvil.
      </p>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="ajustes__guardar">
        <button type="submit" className="boton boton--primario" disabled={!hayCambios || estado === 'guardando'}>
          Guardar cambios
        </button>
        <span className="texto-secundario" role="status">
          {estado === 'guardado' && !hayCambios ? 'Cambios guardados.' : ''}
        </span>
      </div>
    </form>
  )
}

function DialogoBorrar({
  abierto,
  alCerrar,
  alBorrar,
}: {
  abierto: boolean
  alCerrar: () => void
  alBorrar: () => Promise<void>
}) {
  const [texto, setTexto] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmado = texto.trim().toUpperCase() === 'BORRAR'

  function cerrar() {
    setTexto('')
    setError(null)
    alCerrar()
  }

  async function borrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!confirmado) return
    setBorrando(true)
    try {
      await alBorrar()
    } catch (e) {
      setError(mensajeDeError(e))
      setBorrando(false)
    }
  }

  return (
    <Dialogo abierto={abierto} alCerrar={cerrar} titulo="Borrar los datos de este móvil">
      <form className="dialogo-borrar" onSubmit={borrar} noValidate>
        <p className="texto-secundario">
          Se borra de este móvil la copia del stock de los dos laboratorios y se cierra la sesión. Los datos en la
          nube no se tocan: al volver a entrar, el móvil los descarga otra vez. Sirve para dejar el móvil limpio o
          si algo se ha quedado mal en él.
        </p>
        <label className="campo">
          <span className="dialogo-borrar__instruccion">
            Escribe <strong className="mono">BORRAR</strong> para confirmar
          </span>
          <input
            className="campo__entrada campo__entrada--mono"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </label>
        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}
        <div className="hoja__acciones">
          <button type="button" className="boton" onClick={cerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton boton--oscuro" disabled={!confirmado || borrando}>
            {borrando ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}

function describirModelo(modelo: EstadoModelo): string {
  switch (modelo.estado) {
    case 'sin-cargar':
    case 'cargando':
      return 'Cargando el modelo…'
    case 'error':
      return modelo.mensaje
    case 'listo': {
      const segundos = formatearNumero(Math.round(modelo.msCarga / 100) / 10)
      const motor = modelo.motor === 'webgl' ? 'con la GPU' : modelo.motor === 'cpu' ? 'con el procesador' : modelo.motor
      const prueba = `autoprueba superada (${formatearNumero(Math.floor(modelo.autoprueba.similitud * 1000) / 1000)})`
      if (modelo.motorDescartado) {
        return (
          `Modelo listo ${motor}, cargado en ${segundos} s: la GPU de este móvil calculaba mal (no pasó la ` +
          `autoprueba), así que se usa el procesador, que es más lento. Si las fotos de referencia se hicieron con ` +
          `este móvil, revísalas abajo y recalcula los vectores.`
        )
      }
      return `Modelo listo (${motor}), cargado en ${segundos} s; ${prueba}.`
    }
  }
}

function FormularioReconocimiento({
  ajustes,
  alGuardar,
}: {
  ajustes: AjustesDispositivo
  alGuardar: (cambios: Partial<AjustesDispositivo>) => Promise<unknown>
}) {
  const modelo = useEstadoModelo()
  const [umbral, setUmbral] = useState(numeroParaCampo(ajustes.umbral))
  const [temperatura, setTemperatura] = useState(numeroParaCampo(ajustes.temperatura))
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const valorUmbral = leerNumero(umbral)
  const valorTemperatura = leerNumero(temperatura)
  const hayCambios = valorUmbral !== ajustes.umbral || valorTemperatura !== ajustes.temperatura
  const sonLosDeFabrica =
    ajustes.umbral === AJUSTES_INICIALES.umbral && ajustes.temperatura === AJUSTES_INICIALES.temperatura

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (valorUmbral === null || valorUmbral < 0 || valorUmbral > 1) {
      setError('El umbral tiene que estar entre 0 y 1 (p. ej. 0,6).')
      return
    }
    if (valorTemperatura === null || valorTemperatura <= 0 || valorTemperatura > 1) {
      setError('La temperatura tiene que ser mayor que 0 y como mucho 1 (p. ej. 0,05).')
      return
    }
    setError(null)
    await alGuardar({ umbral: valorUmbral, temperatura: valorTemperatura })
    setGuardado(true)
  }

  async function restaurar() {
    setUmbral(numeroParaCampo(AJUSTES_INICIALES.umbral))
    setTemperatura(numeroParaCampo(AJUSTES_INICIALES.temperatura))
    setError(null)
    await alGuardar({ umbral: AJUSTES_INICIALES.umbral, temperatura: AJUSTES_INICIALES.temperatura })
    setGuardado(true)
  }

  return (
    <form className="seccion" onSubmit={(e) => void guardar(e)} noValidate aria-labelledby="ajustes-reconocimiento">
      <h2 id="ajustes-reconocimiento" className="seccion__titulo">
        Reconocimiento
      </h2>
      <p className="texto-secundario" role="status">
        {describirModelo(modelo)}
      </p>
      <div className="ajustes__pareja">
        <label className="campo">
          <span className="etiqueta">Umbral</span>
          <input
            className="campo__entrada campo__entrada--mono"
            inputMode="decimal"
            value={umbral}
            onChange={(e) => {
              setUmbral(e.target.value)
              setGuardado(false)
            }}
            autoComplete="off"
          />
        </label>
        <label className="campo">
          <span className="etiqueta">Temperatura</span>
          <input
            className="campo__entrada campo__entrada--mono"
            inputMode="decimal"
            value={temperatura}
            onChange={(e) => {
              setTemperatura(e.target.value)
              setGuardado(false)
            }}
            autoComplete="off"
          />
        </label>
      </div>
      <p className="campo__ayuda">
        Umbral: puntuación mínima (de 0 a 1) para dar un producto por seguro; más alto, más veces dirá «No estoy
        seguro». Temperatura: cuánto se separa el % del primero del de los demás; más baja, más separación. Calíbralos
        con el modo diagnóstico.
      </p>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="ajustes__guardar">
        <button type="submit" className="boton boton--primario" disabled={!hayCambios}>
          Guardar
        </button>
        <button type="button" className="boton" onClick={() => void restaurar()} disabled={sonLosDeFabrica && !hayCambios}>
          Valores iniciales
        </button>
        <span className="texto-secundario" role="status">
          {guardado && !hayCambios ? 'Guardado.' : ''}
        </span>
      </div>

      <label className="opcion">
        <input
          type="checkbox"
          checked={ajustes.aprenderDeRetiradas}
          onChange={(e) => void alGuardar({ aprenderDeRetiradas: e.target.checked })}
        />
        <span className="opcion__texto">
          <span className="opcion__titulo">Aprender de las retiradas</span>
          <span className="opcion__detalle">
            Desactivado: las fotos de las retiradas no se guardan. Si lo activas, al confirmar una retirada se
            ofrece guardar su foto como referencia del producto (ayuda a reconocerlo, pero llena la galería).
          </span>
        </span>
      </label>
      <label className="opcion">
        <input
          type="checkbox"
          checked={ajustes.modoDiagnostico}
          onChange={(e) => void alGuardar({ modoDiagnostico: e.target.checked })}
        />
        <span className="opcion__texto">
          <span className="opcion__titulo">Modo diagnóstico</span>
          <span className="opcion__detalle">
            Tras cada foto, enseña las puntuaciones de los 5 mejores productos y el tiempo de reconocimiento.
          </span>
        </span>
      </label>
    </form>
  )
}

