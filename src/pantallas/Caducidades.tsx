import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { mostrarAviso } from '../app/avisos'
import { useServicios } from '../app/contexto'
import { Enlace } from '../app/Enlace'
import { useAjustes, useConsulta } from '../app/hooks'
import type { Movimiento, Producto } from '../datos/tipos'
import { mensajeDeError } from '../dominio/errores'
import { aFecha, conPunto, diasEntre, formatearFecha, formatearMesAnio, formatearNumero } from '../dominio/formato'
import { leerNumero, numeroParaCampo, redondear } from '../dominio/numeros'
import { entradasQueCaducanPronto, lotesCaducados } from '../dominio/resumen'
import { ubicacionCorta } from '../dominio/ubicacion'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { CambioStock } from '../ui/CambioStock'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'
import { PantallaCompleta } from '../ui/Pantalla'
import '../ui/FilaProducto.css'
import './Caducidades.css'

interface Lote {
  entrada: Movimiento & { caducidad: string }
  producto: Producto
}

/** Caducidades (sin maqueta, duda 7b): lotes caducados y lotes que caducan en menos de 30 días. */
export function Caducidades() {
  const { repo } = useServicios()
  const ajustes = useAjustes()
  const [desechando, setDesechando] = useState<Lote | null>(null)

  const { datos } = useConsulta(async (r) => {
    const [productos, entradas] = await Promise.all([r.listarProductos(), r.listarMovimientos({ tipo: 'entrada' })])
    const ahora = new Date()
    const porId = new Map(productos.map((p) => [p.id, p]))
    const aLotes = (lista: Movimiento[]): Lote[] =>
      lista.flatMap((entrada) => {
        const producto = porId.get(entrada.productoId)
        return producto && entrada.caducidad ? [{ entrada: { ...entrada, caducidad: entrada.caducidad }, producto }] : []
      })
    return {
      ahora,
      caducados: aLotes(lotesCaducados(productos, entradas, ahora)),
      pronto: aLotes(entradasQueCaducanPronto(productos, entradas, ahora)),
    }
  }, [])

  async function yaNoQueda(lote: Lote) {
    if (!ajustes) return
    try {
      await repo.cerrarLote(lote.entrada.id, { como: 'agotado', usuario: ajustes.usuario })
      mostrarAviso({
        texto: `${describirLote(lote)}: marcado como que ya no queda.`,
        accion: 'Deshacer',
        alPulsarAccion: () => repo.reabrirLote(lote.entrada.id),
      })
    } catch (error) {
      mostrarAviso({ texto: mensajeDeError(error) })
    }
  }

  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'stock' }} titulo="Caducidades" />
      <main className="contenido caducidades">
        <p className="texto-secundario">
          Las retiradas no dicen de qué lote salen, así que cada lote caducado sale aquí mientras el producto tenga
          stock y nadie lo marque como desechado o «ya no queda».
        </p>

        {datos && (
          <>
            <section className="seccion" aria-labelledby="caducidades-vencidos">
              <h2 id="caducidades-vencidos" className="seccion__titulo caducidades__titulo">
                Caducados <span className="caducidades__contador">{datos.caducados.length}</span>
              </h2>
              {datos.caducados.length === 0 ? (
                <p className="texto-secundario">No hay lotes caducados.</p>
              ) : (
                <ul className="caducidades__lista">
                  {datos.caducados.map((lote) => (
                    <TarjetaLote key={lote.entrada.id} lote={lote} vencido ahora={datos.ahora}>
                      <button type="button" className="boton boton--oscuro boton--compacto" onClick={() => setDesechando(lote)}>
                        Desechar…
                      </button>
                      <button type="button" className="boton boton--compacto" onClick={() => void yaNoQueda(lote)}>
                        Ya no queda
                      </button>
                    </TarjetaLote>
                  ))}
                </ul>
              )}
            </section>

            <section className="seccion" aria-labelledby="caducidades-pronto">
              <h2 id="caducidades-pronto" className="seccion__titulo caducidades__titulo">
                Caducan en menos de 30 días <span className="caducidades__contador">{datos.pronto.length}</span>
              </h2>
              {datos.pronto.length === 0 ? (
                <p className="texto-secundario">Ningún lote caduca en los próximos 30 días.</p>
              ) : (
                <ul className="caducidades__lista">
                  {datos.pronto.map((lote) => (
                    <TarjetaLote key={lote.entrada.id} lote={lote} vencido={false} ahora={datos.ahora}>
                      <button type="button" className="boton boton--compacto" onClick={() => void yaNoQueda(lote)}>
                        Ya no queda
                      </button>
                    </TarjetaLote>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      {desechando && (
        <DialogoDesechar key={desechando.entrada.id} lote={desechando} alCerrar={() => setDesechando(null)} />
      )}
    </PantallaCompleta>
  )
}

/** «lote A0907-23» o, si no tiene número de lote, «lote cad. 10/2026». */
function etiquetaLote(entrada: Lote['entrada']): string {
  return entrada.lote ? `lote ${entrada.lote}` : `lote cad. ${formatearMesAnio(entrada.caducidad)}`
}

/** «R-031, lote A0907-23» */
function describirLote({ entrada, producto }: Lote): string {
  return `${producto.codigo}, ${etiquetaLote(entrada)}`
}

function TarjetaLote({
  lote,
  vencido,
  ahora,
  children,
}: {
  lote: Lote
  vencido: boolean
  ahora: Date
  children: ReactNode
}) {
  const { entrada, producto } = lote
  const dias = diasEntre(ahora, aFecha(entrada.caducidad))
  return (
    <li className={vencido ? 'tarjeta-lote tarjeta-lote--vencido' : 'tarjeta-lote'}>
      <Enlace ruta={{ pantalla: 'producto', id: producto.id }} className="tarjeta-lote__producto">
        <span className="codigo-producto">{producto.codigo}</span>
        <span className="fila-producto__textos">
          <span className="fila-producto__nombre">{producto.nombre}</span>
          <span className="fila-producto__linea">
            {producto.formato} · {ubicacionCorta(producto)}
          </span>
        </span>
        {vencido ? (
          <span className="insignia-caducado">Caducado</span>
        ) : (
          <span className="etiqueta etiqueta--pequena">{dias === 0 ? 'Caduca hoy' : `En ${dias} d`}</span>
        )}
      </Enlace>
      <dl className="tarjeta-lote__datos">
        <div>
          <dt className="etiqueta etiqueta--pequena">Lote</dt>
          <dd className="mono">{entrada.lote ?? '—'}</dd>
        </div>
        <div>
          <dt className="etiqueta etiqueta--pequena">Caducidad</dt>
          <dd className="mono">{formatearMesAnio(entrada.caducidad)}</dd>
        </div>
        <div>
          <dt className="etiqueta etiqueta--pequena">Entró</dt>
          <dd className="mono">
            {formatearFecha(entrada.fecha)} · +{formatearNumero(entrada.cantidad)}
          </dd>
        </div>
        <div>
          <dt className="etiqueta etiqueta--pequena">Stock</dt>
          <dd className="mono">
            {formatearNumero(producto.stockActual)} {producto.unidadCorta}
          </dd>
        </div>
      </dl>
      <div className="tarjeta-lote__acciones">{children}</div>
    </li>
  )
}

function DialogoDesechar({ lote, alCerrar }: { lote: Lote; alCerrar: () => void }) {
  const { repo } = useServicios()
  const ajustes = useAjustes()
  const { entrada, producto } = lote
  const [texto, setTexto] = useState(() => numeroParaCampo(Math.min(entrada.cantidad, producto.stockActual)))
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const idCantidad = useId()
  const idError = useId()
  const cantidad = leerNumero(texto)
  const valida = cantidad !== null && cantidad > 0 && cantidad <= producto.stockActual

  async function desechar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || !ajustes) return
    if (!valida) {
      setError(
        `Escribe cuántas unidades desechas: más de cero y como mucho ${formatearNumero(producto.stockActual)} ${producto.unidadCorta}`,
      )
      return
    }
    setGuardando(true)
    try {
      await repo.cerrarLote(entrada.id, { como: 'desechado', cantidad, usuario: ajustes.usuario })
      alCerrar()
      mostrarAviso({
        texto: conPunto(
          `Desechado: ${producto.nombre}, ${formatearNumero(producto.stockActual)} → ` +
            `${formatearNumero(redondear(producto.stockActual - cantidad))} ${producto.unidadCorta}`,
        ),
        accion: 'Deshacer',
        alPulsarAccion: () => repo.reabrirLote(entrada.id),
      })
    } catch (e) {
      setError(mensajeDeError(e))
      setGuardando(false)
    }
  }

  return (
    <Dialogo abierto alCerrar={alCerrar} titulo="Desechar lote caducado">
      <form className="dialogo-desechar" onSubmit={desechar} noValidate>
        <p className="texto-secundario">
          {producto.nombre}, {etiquetaLote(entrada)}. Se resta del stock y queda en el historial como ajuste
          «Caducado».
        </p>
        <div className="campo">
          <label className="etiqueta" htmlFor={idCantidad}>
            Unidades que desechas ({producto.unidadCorta})
          </label>
          <input
            id={idCantidad}
            className="campo__entrada campo__entrada--mono"
            inputMode="decimal"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setError(null)
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? idError : undefined}
            autoComplete="off"
          />
        </div>
        <CambioStock
          producto={producto}
          despues={valida ? redondear(producto.stockActual - cantidad) : undefined}
        />
        {error && (
          <p id={idError} className="mensaje-error" role="alert">
            <Icono nombre="info" tamano={18} />
            {conPunto(error)}
          </p>
        )}
        <div className="hoja__acciones">
          <button type="button" className="boton" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton boton--oscuro" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Desechar'}
          </button>
        </div>
      </form>
    </Dialogo>
  )
}
