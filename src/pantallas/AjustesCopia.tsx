import { useRef, useState } from 'react'
import { mostrarAviso } from '../app/avisos'
import { compartirArchivo, descargarArchivo, puedeCompartirArchivo, type ResultadoCompartir } from '../app/compartir'
import { useServicios } from '../app/contexto'
import { navegar } from '../app/navegacion'
import type { AjustesDispositivo } from '../datos/ajustes'
import { crearCopia, leerCopia, nombreArchivoCopia, type CopiaLeida } from '../datos/copiaSeguridad'
import type { Recuento } from '../datos/StockRepository'
import { mensajeDeError } from '../dominio/errores'
import { formatearFechaHora, formatearNumero, formatearTamano } from '../dominio/formato'
import { conTodoSincronizado, useEstadoSincronizacion } from '../datos/sincronizacion/servicio'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'

/** Ajustes → Copia de seguridad: exportar e importar todo en JSON (CLAUDE.md §7.7). */
export function SeccionCopia({
  ajustes,
  recuento,
}: {
  ajustes: AjustesDispositivo
  recuento: Recuento | undefined
}) {
  const { repo, ajustes: almacen } = useServicios()
  const [preparando, setPreparando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiaLeida, setCopiaLeida] = useState<CopiaLeida | null>(null)
  const selectorArchivo = useRef<HTMLInputElement>(null)
  // Se comprueba con un archivo vacío: lo que importa es si el móvil deja compartir archivos.
  const [puedeEnviar] = useState(() =>
    puedeCompartirArchivo(new File(['{}'], 'copia.json', { type: 'application/json' })),
  )

  async function guardarCopia(como: 'descargar' | 'enviar') {
    setPreparando(true)
    setError(null)
    try {
      const ahora = new Date()
      const texto = await crearCopia(await repo.volcar(), ajustes, ahora)
      const archivo = new File([texto], nombreArchivoCopia(ahora), { type: 'application/json' })
      let resultado: ResultadoCompartir = 'descargado'
      if (como === 'enviar') resultado = await compartirArchivo(archivo, 'Copia de seguridad del stock')
      else descargarArchivo(archivo)
      if (resultado === 'cancelado') return
      await almacen.guardar({ ultimaCopia: ahora.toISOString() })
      mostrarAviso({
        texto: `${resultado === 'descargado' ? 'Copia descargada' : 'Copia enviada'}: ${archivo.name} (${formatearTamano(archivo.size)}).`,
      })
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setPreparando(false)
    }
  }

  async function elegirArchivo(archivo: File | undefined) {
    if (!archivo) return
    setError(null)
    try {
      setCopiaLeida(leerCopia(await archivo.text()))
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      // Para poder elegir el mismo archivo otra vez.
      if (selectorArchivo.current) selectorArchivo.current.value = ''
    }
  }

  async function restaurar(copia: CopiaLeida) {
    // Si el móvil está conectado, la copia sustituye los datos de todo el laboratorio.
    await conTodoSincronizado(() => repo.reemplazarTodo(copia.datos))
    await almacen.guardar(copia.ajustes)
    setCopiaLeida(null)
    navegar({ pantalla: 'stock' }, { reemplazar: true })
    mostrarAviso({ texto: `Copia restaurada: ${describirRecuento(copia.recuento)}.` })
  }

  return (
    <section className="seccion" aria-labelledby="ajustes-copia">
      <h2 id="ajustes-copia" className="seccion__titulo">
        Copia de seguridad
      </h2>
      <p className="texto-secundario">
        Por ahora los datos solo están en este móvil: si se pierde o se borra el navegador, se pierden. Guarda una
        copia cada semana y déjala fuera del móvil (correo, Drive o el ordenador). Lleva todo, fotos incluidas.
      </p>
      <p className="ajustes__ultima-copia">
        <span className="etiqueta etiqueta--pequena">Última copia</span>
        <span className="mono">{ajustes.ultimaCopia ? formatearFechaHora(ajustes.ultimaCopia) : 'Ninguna'}</span>
      </p>
      <div className="ajustes__botones">
        <button
          type="button"
          className="boton boton--primario"
          onClick={() => void guardarCopia('descargar')}
          disabled={preparando || !recuento?.productos}
        >
          {preparando ? 'Preparando…' : 'Descargar copia'}
        </button>
        {puedeEnviar && (
          <button
            type="button"
            className="boton"
            onClick={() => void guardarCopia('enviar')}
            disabled={preparando || !recuento?.productos}
          >
            <Icono nombre="compartir" tamano={16} />
            Enviar copia
          </button>
        )}
      </div>
      <button
        type="button"
        className="boton boton--contorno ajustes__boton-suelto"
        onClick={() => selectorArchivo.current?.click()}
      >
        Restaurar una copia…
      </button>
      <input
        ref={selectorArchivo}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void elegirArchivo(e.target.files?.[0])}
      />
      {error && (
        <p className="mensaje-error" role="alert">
          <Icono nombre="info" tamano={18} />
          {error}
        </p>
      )}

      {copiaLeida && (
        <DialogoRestaurar
          copia={copiaLeida}
          actual={recuento}
          alCerrar={() => setCopiaLeida(null)}
          alRestaurar={() => restaurar(copiaLeida)}
        />
      )}
    </section>
  )
}

function describirRecuento(r: Recuento): string {
  const partes = [
    [r.productos, 'producto', 'productos'],
    [r.movimientos, 'movimiento', 'movimientos'],
    [r.fotos, 'foto', 'fotos'],
    [r.pedidos, 'pedido', 'pedidos'],
  ] as const
  const textos = partes.map(([n, uno, varios]) => `${formatearNumero(n)} ${n === 1 ? uno : varios}`)
  return `${textos.slice(0, -1).join(', ')} y ${textos.at(-1) ?? ''}`
}

function DialogoRestaurar({
  copia,
  actual,
  alCerrar,
  alRestaurar,
}: {
  copia: CopiaLeida
  actual: Recuento | undefined
  alCerrar: () => void
  alRestaurar: () => Promise<void>
}) {
  const [restaurando, setRestaurando] = useState(false)
  const conectado = useEstadoSincronizacion().modo !== 'local'
  const [error, setError] = useState<string | null>(null)
  const hayDatos = actual !== undefined && actual.productos + actual.movimientos + actual.fotos + actual.pedidos > 0

  async function confirmar() {
    setRestaurando(true)
    try {
      await alRestaurar()
    } catch (e) {
      setError(mensajeDeError(e))
      setRestaurando(false)
    }
  }

  return (
    <Dialogo abierto alCerrar={alCerrar} titulo="Restaurar copia">
      <dl className="ficha">
        <div className="ficha__celda">
          <dt className="etiqueta etiqueta--pequena">Copia del</dt>
          <dd className="ajustes__dato">{copia.exportadaEn ? formatearFechaHora(copia.exportadaEn) : '—'}</dd>
        </div>
        <div className="ficha__celda">
          <dt className="etiqueta etiqueta--pequena">Laboratorio</dt>
          <dd className="ajustes__dato">{copia.ajustes.laboratorio ?? '—'}</dd>
        </div>
      </dl>
      <p className="texto-secundario">Contiene {describirRecuento(copia.recuento)}.</p>
      {conectado && (
        <p className="nota-grave">
          <Icono nombre="alerta" tamano={18} />
          <span>
            Este móvil está conectado al laboratorio: la copia sustituye los datos de <strong>todos</strong> los móviles.
          </span>
        </p>
      )}
      {hayDatos && !conectado && (
        <p className="nota-grave">
          <Icono nombre="alerta" tamano={18} />
          <span>
            Sustituye todo lo que hay ahora en este móvil ({describirRecuento(actual)}). No se puede deshacer: si
            quieres conservarlo, cancela y descarga antes una copia.
          </span>
        </p>
      )}
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}
      <div className="hoja__acciones">
        <button type="button" className="boton" onClick={alCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton boton--oscuro" onClick={() => void confirmar()} disabled={restaurando}>
          {restaurando ? 'Restaurando…' : 'Restaurar'}
        </button>
      </div>
    </Dialogo>
  )
}
