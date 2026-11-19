import { useEffect, useState, type FormEvent } from 'react'
import { useServicios } from '../app/contexto'
import { useAjustes, useConsulta } from '../app/hooks'
import { navegar } from '../app/navegacion'
import { consultarAlmacenamiento, type EstadoAlmacenamiento } from '../app/plataforma'
import type { AjustesDispositivo } from '../datos/ajustes'
import { mensajeDeError } from '../dominio/errores'
import { formatearFechaHora, formatearNumero, formatearTamano } from '../dominio/formato'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { Dialogo } from '../ui/Dialogo'
import { EnConstruccion } from '../ui/EnConstruccion'
import { PantallaCompleta } from '../ui/Pantalla'
import './Ajustes.css'

/** Ajustes (sin maqueta). En la etapa 1: perfil, datos del móvil y borrado. */
export function Ajustes() {
  const { repo, ajustes: almacen } = useServicios()
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
    await repo.borrarTodo()
    navegar({ pantalla: 'stock' }, { reemplazar: true })
    // Sin usuario, la app vuelve al primer arranque.
    await almacen.borrar()
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
        {ajustes && <FormularioPerfil ajustes={ajustes} alGuardar={(cambios) => almacen.guardar(cambios)} />}

        <section className="seccion" aria-labelledby="ajustes-datos">
          <h2 id="ajustes-datos" className="seccion__titulo">
            Datos en este móvil
          </h2>
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
            Borrar todos los datos
          </button>
        </section>

        <section className="seccion" aria-labelledby="ajustes-proximamente">
          <h2 id="ajustes-proximamente" className="seccion__titulo">
            Próximamente
          </h2>
          <EnConstruccion etapa={3}>Reconocimiento: umbral, temperatura y modo diagnóstico.</EnConstruccion>
          <EnConstruccion etapa={4}>
            Copia de seguridad: exportar e importar todos los datos (con fotos) en un archivo JSON.
          </EnConstruccion>
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
  const [laboratorio, setLaboratorio] = useState(ajustes.laboratorio)
  const [estado, setEstado] = useState<'editando' | 'guardando' | 'guardado'>('editando')
  const [error, setError] = useState<string | null>(null)

  const hayCambios = usuario.trim() !== ajustes.usuario || laboratorio.trim() !== ajustes.laboratorio

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!usuario.trim() || !laboratorio.trim()) {
      setError('El usuario y el laboratorio no pueden quedar vacíos.')
      return
    }
    setError(null)
    setEstado('guardando')
    try {
      await alGuardar({ usuario, laboratorio })
      setEstado('guardado')
    } catch (e) {
      setError(mensajeDeError(e))
      setEstado('editando')
    }
  }

  function editar(cambiar: (valor: string) => void) {
    return (valor: string) => {
      cambiar(valor)
      setEstado('editando')
    }
  }

  return (
    <form className="seccion" onSubmit={guardar} noValidate aria-labelledby="ajustes-perfil">
      <h2 id="ajustes-perfil" className="seccion__titulo">
        Perfil
      </h2>
      <label className="campo">
        <span className="etiqueta">Usuario (nombre o iniciales)</span>
        <input
          className="campo__entrada"
          value={usuario}
          onChange={(e) => editar(setUsuario)(e.target.value)}
          autoComplete="name"
          aria-invalid={(error !== null && !usuario.trim()) || undefined}
        />
      </label>
      <label className="campo">
        <span className="etiqueta">Laboratorio</span>
        <input
          className="campo__entrada"
          value={laboratorio}
          onChange={(e) => editar(setLaboratorio)(e.target.value)}
          autoComplete="organization"
          aria-invalid={(error !== null && !laboratorio.trim()) || undefined}
        />
      </label>
      <p className="texto-secundario">Cada movimiento queda registrado a nombre del usuario actual.</p>
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
    <Dialogo abierto={abierto} alCerrar={cerrar} titulo="Borrar todos los datos">
      <form className="dialogo-borrar" onSubmit={borrar} noValidate>
        <p className="texto-secundario">
          Se borrarán de este móvil todos los productos, movimientos, fotos de referencia y pedidos, y la app
          volverá al primer arranque. No se puede deshacer.
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
