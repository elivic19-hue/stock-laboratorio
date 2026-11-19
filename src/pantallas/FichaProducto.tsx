import { useCallback, useId, useState, type FormEvent } from 'react'
import { mostrarAviso } from '../app/avisos'
import { useServicios } from '../app/contexto'
import { Enlace } from '../app/Enlace'
import { useAjustes, useConsulta } from '../app/hooks'
import type { FotoReferencia, Producto } from '../datos/tipos'
import { mensajeDeError } from '../dominio/errores'
import {
  conPunto,
  formatearCantidadConSigno,
  formatearDiaMes,
  formatearFechaHora,
  formatearMesAnio,
  formatearMomento,
  formatearNumero,
} from '../dominio/formato'
import { describirMovimiento } from '../dominio/movimientos'
import { MAX_FOTOS_POR_PRODUCTO } from '../datos/StockRepository'
import { FOTOS_MINIMAS, FOTOS_RECOMENDADAS, objetivoFotos } from '../reconocimiento/fotos'
import { lotesCaducados } from '../dominio/resumen'
import { leerNumero, numeroParaCampo } from '../dominio/numeros'
import { cantidadDeAjuste, estaBajoMinimo } from '../dominio/stock'
import { ubicacionCompleta } from '../dominio/ubicacion'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { CambioStock } from '../ui/CambioStock'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'
import { PantallaCompleta } from '../ui/Pantalla'
import './FichaProducto.css'

const MOVIMIENTOS_INICIALES = 15
const MOTIVOS_AJUSTE = ['Recuento', 'Rotura', 'Caducado', 'Corrección de un error']

/** Maqueta Producto. */
export function FichaProducto({ id }: { id: string }) {
  const { repo } = useServicios()
  const [verTodos, setVerTodos] = useState(false)
  const [ajusteAbierto, setAjusteAbierto] = useState(false)
  const [aperturasAjuste, setAperturasAjuste] = useState(0)
  const [archivarAbierto, setArchivarAbierto] = useState(false)

  const { datos, cargando } = useConsulta(async (r) => {
    const [producto, movimientos, fotos, pedidos] = await Promise.all([
      r.obtenerProducto(id),
      r.listarMovimientos({ productoId: id }),
      r.listarFotos(id),
      r.listarPedidos(),
    ])
    const ahora = new Date()
    return {
      producto,
      movimientos,
      fotos,
      pedidos: pedidos.filter((p) => p.productoId === id),
      caducados: producto ? lotesCaducados([producto], movimientos, ahora) : [],
      ahora,
    }
  }, [id])
  const producto = datos?.producto

  async function cambiarArchivado(archivado: boolean) {
    try {
      await repo.actualizarProducto(id, { archivado })
      setArchivarAbierto(false)
      mostrarAviso({
        texto: archivado ? 'Producto archivado.' : 'Producto recuperado.',
        accion: 'Deshacer',
        alPulsarAccion: async () => {
          await repo.actualizarProducto(id, { archivado: !archivado })
        },
      })
    } catch (error) {
      mostrarAviso({ texto: mensajeDeError(error) })
    }
  }

  return (
    <PantallaCompleta>
      <CabeceraVolver
        volverA={{ pantalla: 'stock' }}
        accion={
          producto && (
            <Enlace ruta={{ pantalla: 'producto-editar', id }} className="boton">
              Editar
            </Enlace>
          )
        }
      />
      <main className="contenido ficha-producto">
        {!cargando && !producto && (
          <p className="texto-secundario">No se encuentra este producto. Puede que se haya borrado.</p>
        )}
        {datos && producto && (
          <>
            {producto.archivado && (
              <div className="nota-archivado" role="note">
                <span>
                  <strong>Producto archivado.</strong> No sale en Stock ni en «A pedir», y la cámara no lo propone.
                </span>
                <button type="button" className="boton boton--compacto" onClick={() => void cambiarArchivado(false)}>
                  Recuperar
                </button>
              </div>
            )}

            {datos.caducados.length > 0 && (
              <Enlace ruta={{ pantalla: 'caducidades' }} className="banda-caducados">
                <Icono nombre="alerta" />
                <span className="banda-caducados__texto">
                  <strong>
                    {datos.caducados.length === 1 ? 'Lote caducado' : `${datos.caducados.length} lotes caducados`}
                  </strong>
                  : {datos.caducados.map((m) => `${m.lote ?? 'sin lote'} (${formatearMesAnio(m.caducidad ?? '')})`).join(', ')}
                </span>
                <span className="banda-caducados__ver">
                  Ver
                  <Icono nombre="siguiente" tamano={14} />
                </span>
              </Enlace>
            )}

            <div className="ficha-producto__titulo">
              <div className="ficha-producto__insignias">
                <span className="insignia-categoria">{producto.categoria === 'reactivo' ? 'Reactivo' : 'Fungible'}</span>
                <span className="etiqueta">{producto.codigo}</span>
                {datos.caducados.length > 0 && <span className="insignia-caducado">Caducado</span>}
              </div>
              <h1 className="ficha-producto__nombre">{producto.nombre}</h1>
            </div>

            <DatosProducto producto={producto} pedidoEnCurso={datos.pedidos.find((p) => p.estado === 'pedido')?.fechaPedido} ahora={datos.ahora} />

            <div className="ficha-producto__acciones">
              <Enlace ruta={{ pantalla: 'entrada', productoId: id }} className="boton">
                Registrar entrada
              </Enlace>
              <button
                type="button"
                className="boton"
                onClick={() => {
                  setAperturasAjuste((n) => n + 1)
                  setAjusteAbierto(true)
                }}
              >
                Ajustar stock
              </button>
            </div>

            <GaleriaFotos productoId={id} fotos={datos.fotos} />

            {producto.notas && (
              <section className="seccion" aria-labelledby="ficha-notas">
                <h2 id="ficha-notas" className="seccion__titulo">
                  Notas
                </h2>
                <p className="ficha-producto__notas">{producto.notas}</p>
              </section>
            )}

            <section className="ficha-movimientos" aria-labelledby="ficha-movimientos">
              <h2 id="ficha-movimientos" className="seccion__titulo">
                Movimientos
              </h2>
              {datos.movimientos.length === 0 && <p className="texto-secundario ficha-movimientos__vacio">Sin movimientos todavía.</p>}
              <ul className="ficha-movimientos__lista">
                {(verTodos ? datos.movimientos : datos.movimientos.slice(0, MOVIMIENTOS_INICIALES)).map((m) => {
                  const { titulo, detalle } = describirMovimiento(m, datos.pedidos)
                  return (
                    <li key={m.id} className="movimiento">
                      <span className={m.cantidad > 0 ? 'movimiento__cantidad movimiento__cantidad--entra' : 'movimiento__cantidad'}>
                        {formatearCantidadConSigno(m.cantidad)}
                      </span>
                      <span className="movimiento__textos">
                        <span className="movimiento__titulo">{titulo}</span>
                        <span className="movimiento__detalle">{detalle}</span>
                      </span>
                      <span className="movimiento__cuando">
                        <time dateTime={m.fecha}>{formatearMomento(m.fecha, datos.ahora)}</time>
                        <span className="movimiento__resultante">
                          Quedan {formatearNumero(m.stockResultante)}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
              {!verTodos && datos.movimientos.length > MOVIMIENTOS_INICIALES && (
                <button type="button" className="boton ficha-movimientos__mas" onClick={() => setVerTodos(true)}>
                  Ver los {datos.movimientos.length} movimientos
                </button>
              )}
            </section>

            {!producto.archivado && (
              <button type="button" className="boton boton--contorno" onClick={() => setArchivarAbierto(true)}>
                Archivar producto
              </button>
            )}

            <DialogoAjuste key={aperturasAjuste} producto={producto} abierto={ajusteAbierto} alCerrar={() => setAjusteAbierto(false)} />
            <Dialogo abierto={archivarAbierto} alCerrar={() => setArchivarAbierto(false)} titulo="Archivar producto">
              <p className="texto-secundario">
                {producto.nombre} dejará de salir en Stock y en «A pedir», y la cámara no lo propondrá. Su historial y
                sus fotos se conservan, y puedes recuperarlo desde Catálogo › Archivados.
              </p>
              <div className="hoja__acciones">
                <button type="button" className="boton" onClick={() => setArchivarAbierto(false)}>
                  Cancelar
                </button>
                <button type="button" className="boton boton--oscuro" onClick={() => void cambiarArchivado(true)}>
                  Archivar
                </button>
              </div>
            </Dialogo>
          </>
        )}
      </main>
    </PantallaCompleta>
  )
}

function DatosProducto({
  producto,
  pedidoEnCurso,
  ahora,
}: {
  producto: Producto
  pedidoEnCurso: string | undefined
  ahora: Date
}) {
  const bajo = estaBajoMinimo(producto)
  const hayPedido = producto.cantidadPedidoSugerida !== undefined || pedidoEnCurso !== undefined
  return (
    <dl className="ficha ficha--datos">
      <div className="ficha__celda">
        <dt className="etiqueta etiqueta--pequena">Stock</dt>
        <dd className="ficha__valor ficha__valor--fuerte">
          {formatearNumero(producto.stockActual)} <span className="ficha__unidad">{producto.unidadCorta}</span>
          {bajo && <span className="insignia-bajo-minimo ficha__insignia">Bajo mín.</span>}
        </dd>
      </div>
      <div className="ficha__celda">
        <dt className="etiqueta etiqueta--pequena">Avisar con</dt>
        <dd className="ficha__valor">≤ {formatearNumero(producto.stockMinimo)}</dd>
      </div>
      <div className="ficha__celda">
        <dt className="etiqueta etiqueta--pequena">Unidad</dt>
        <dd className="ficha__texto">{producto.formato}</dd>
      </div>
      <div className="ficha__celda">
        <dt className="etiqueta etiqueta--pequena">Ubicación</dt>
        <dd className="ficha__texto">{ubicacionCompleta(producto)}</dd>
      </div>
      {hayPedido && (
        <>
          <div className="ficha__celda">
            <dt className="etiqueta etiqueta--pequena">Pedir</dt>
            <dd className="ficha__texto">
              {producto.cantidadPedidoSugerida === undefined ? (
                '—'
              ) : (
                <span className="mono">
                  {formatearNumero(producto.cantidadPedidoSugerida)} {producto.unidadCorta}
                </span>
              )}
            </dd>
          </div>
          <div className="ficha__celda">
            <dt className="etiqueta etiqueta--pequena">Pedido en curso</dt>
            <dd className="ficha__texto">
              {pedidoEnCurso ? <span className="mono">{formatearDiaMes(pedidoEnCurso, ahora)}</span> : 'No'}
            </dd>
          </div>
        </>
      )}
    </dl>
  )
}

function GaleriaFotos({ productoId, fotos }: { productoId: string; fotos: FotoReferencia[] }) {
  const { repo } = useServicios()
  const [vista, setVista] = useState<FotoReferencia | null>(null)
  const objetivo = objetivoFotos(fotos.length)
  const huecos = Math.max(0, objetivo - fotos.length - 1)
  // Ordenadas de la más antigua a la más reciente, como se hicieron.
  const ordenadas = [...fotos].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))

  async function borrar(foto: FotoReferencia) {
    setVista(null)
    try {
      await repo.borrarFoto(foto.id)
      mostrarAviso({ texto: 'Foto borrada.' })
    } catch (error) {
      mostrarAviso({ texto: mensajeDeError(error) })
    }
  }

  return (
    <section className="seccion galeria" aria-labelledby="ficha-fotos">
      <div className="galeria__cabecera">
        <h2 id="ficha-fotos" className="galeria__titulo">
          Fotos de reconocimiento
        </h2>
        <span className="galeria__contador">
          {fotos.length} / {objetivo}
        </span>
      </div>
      <div className="galeria__rejilla">
        {ordenadas.map((foto, i) => (
          <button
            key={foto.id}
            type="button"
            className="galeria__foto"
            aria-label={`Ver la foto ${i + 1}`}
            onClick={() => setVista(foto)}
          >
            <ImagenBlob blob={foto.miniatura} alt="" />
          </button>
        ))}
        {fotos.length < MAX_FOTOS_POR_PRODUCTO && (
          <Enlace ruta={{ pantalla: 'producto-fotos', id: productoId }} className="galeria__anadir" aria-label="Añadir fotos">
            <Icono nombre="mas" tamano={18} grosor={2} />
          </Enlace>
        )}
        {Array.from({ length: huecos }, (_, i) => (
          <span key={i} className="galeria__hueco" aria-hidden="true" />
        ))}
      </div>
      <p className="texto-secundario">
        {fotos.length < FOTOS_MINIMAS
          ? `Haz al menos ${FOTOS_MINIMAS} fotos, mejor ${FOTOS_RECOMENDADAS}, desde distintos ángulos y con distinta luz.`
          : 'Distintos ángulos y luces mejoran el reconocimiento.'}
      </p>

      <Dialogo abierto={vista !== null} alCerrar={() => setVista(null)} titulo="Foto de reconocimiento">
        {vista && (
          <>
            <ImagenBlob blob={vista.miniatura} alt="Foto de reconocimiento ampliada" className="galeria__ampliada" />
            <p className="texto-secundario">
              {vista.origen === 'alta' ? 'Hecha a propósito' : 'Guardada al confirmar una retirada'} el{' '}
              <span className="mono">{formatearFechaHora(vista.creadoEn)}</span>.
            </p>
            <div className="hoja__acciones">
              <button type="button" className="boton" onClick={() => setVista(null)}>
                Cerrar
              </button>
              <button type="button" className="boton boton--oscuro" onClick={() => void borrar(vista)}>
                Borrar foto
              </button>
            </div>
          </>
        )}
      </Dialogo>
    </section>
  )
}

/** Imagen guardada como Blob. La URL vive lo mismo que el <img>: se libera al quitarlo o al cambiar. */
function ImagenBlob({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const ponerImagen = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return
      const url = URL.createObjectURL(blob)
      img.src = url
      return () => URL.revokeObjectURL(url)
    },
    [blob],
  )
  return <img ref={ponerImagen} alt={alt} className={className} />
}

function DialogoAjuste({ producto, abierto, alCerrar }: { producto: Producto; abierto: boolean; alCerrar: () => void }) {
  const { repo } = useServicios()
  const ajustes = useAjustes()
  // Se monta de nuevo cada vez que se abre (key en la ficha): empieza con el stock actual.
  const [contado, setContado] = useState(() => numeroParaCampo(producto.stockActual))
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<{ campo: 'contado' | 'motivo' | null; mensaje: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const idContado = useId()
  const idMotivo = useId()
  const idMotivos = useId()
  const idError = useId()

  const nuevo = leerNumero(contado)

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || !ajustes) return
    let cantidad: number
    try {
      cantidad = cantidadDeAjuste(producto.stockActual, nuevo ?? Number.NaN)
    } catch (e) {
      setError({ campo: 'contado', mensaje: mensajeDeError(e) })
      return
    }
    if (!motivo.trim()) {
      setError({ campo: 'motivo', mensaje: 'Indica el motivo del ajuste: queda en el historial.' })
      return
    }
    setGuardando(true)
    try {
      const { movimiento } = await repo.registrarMovimiento({
        productoId: producto.id,
        tipo: 'ajuste',
        cantidad,
        nota: motivo,
        usuario: ajustes.usuario,
      })
      alCerrar()
      mostrarAviso({
        texto: conPunto(
          `Stock ajustado: ${formatearNumero(producto.stockActual)} → ` +
            `${formatearNumero(movimiento.stockResultante)} ${producto.unidadCorta}`,
        ),
        accion: 'Deshacer',
        alPulsarAccion: async () => {
          await repo.deshacerMovimiento(movimiento.id)
        },
      })
    } catch (e) {
      setError({ campo: null, mensaje: mensajeDeError(e) })
      setGuardando(false)
    }
  }

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Ajustar stock">
      <form className="dialogo-ajuste" onSubmit={guardar} noValidate>
        <p className="texto-secundario">
          Para corregir el stock tras un recuento, una rotura o un error. Para lo que llega de un pedido, usa «Registrar
          entrada».
        </p>
        <div className="campo">
          <label className="etiqueta" htmlFor={idContado}>
            Stock real ({producto.unidadCorta})
          </label>
          <input
            id={idContado}
            className="campo__entrada campo__entrada--mono"
            inputMode="decimal"
            value={contado}
            onChange={(e) => {
              setContado(e.target.value)
              setError(null)
            }}
            aria-invalid={error?.campo === 'contado' || undefined}
            aria-describedby={error?.campo === 'contado' ? idError : undefined}
            autoComplete="off"
          />
        </div>
        <CambioStock producto={producto} despues={nuevo === null || nuevo < 0 ? undefined : nuevo} />
        <div className="campo">
          <label className="etiqueta" htmlFor={idMotivo}>
            Motivo
          </label>
          <input
            id={idMotivo}
            className="campo__entrada"
            list={idMotivos}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              setError(null)
            }}
            placeholder="Recuento, rotura, caducado…"
            aria-invalid={error?.campo === 'motivo' || undefined}
            aria-describedby={error?.campo === 'motivo' ? idError : undefined}
            autoComplete="off"
          />
          <datalist id={idMotivos}>
            {MOTIVOS_AJUSTE.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        {error && (
          <p id={idError} className="mensaje-error" role="alert">
            <Icono nombre="info" tamano={18} />
            {error.mensaje}
          </p>
        )}
        <div className="hoja__acciones">
          <button type="button" className="boton" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton boton--primario" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar ajuste'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
