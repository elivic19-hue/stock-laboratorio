import { useState } from 'react'
import { mostrarAviso } from '../app/avisos'
import { compartirArchivo, compartirTexto, puedeCompartirTexto } from '../app/compartir'
import { useServicios } from '../app/contexto'
import { Enlace } from '../app/Enlace'
import { useAjustes, useConsulta } from '../app/hooks'
import { navegar } from '../app/navegacion'
import type { Producto } from '../datos/tipos'
import { mensajeDeError } from '../dominio/errores'
import { fechaSinHora, formatearDiaMes, formatearFecha, formatearNumero } from '../dominio/formato'
import {
  cantidadSugerida,
  csvListaPedir,
  listaAPedir,
  pedidosEnCurso,
  textoListaPedir,
  type PedidoEnCurso,
} from '../dominio/pedir'
import { estaBajoMinimo } from '../dominio/stock'
import { ubicacionCorta } from '../dominio/ubicacion'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'
import { PantallaConBarra } from '../ui/Pantalla'
import './APedir.css'

/** Maqueta Pedir: lo que está en su mínimo o por debajo, «Marcar pedido» y los pedidos en curso. */
export function APedir() {
  const { repo } = useServicios()
  const [compartiendo, setCompartiendo] = useState(false)
  const [pedidoAbierto, setPedidoAbierto] = useState<PedidoEnCurso | null>(null)

  const { datos } = useConsulta(async (r) => {
    const [productos, pedidos] = await Promise.all([r.listarProductos(), r.listarPedidos('pedido')])
    return { aPedir: listaAPedir(productos, pedidos), enCurso: pedidosEnCurso(productos, pedidos), ahora: new Date() }
  }, [])

  async function marcarPedido(producto: Producto) {
    try {
      const pedido = await repo.marcarPedido(producto.id)
      const sugerida = cantidadSugerida(producto)
      mostrarAviso({
        texto: `Marcado como pedido: ${producto.nombre}${sugerida ? ` (${sugerida})` : ''}.`,
        accion: 'Deshacer',
        alPulsarAccion: () => repo.cancelarPedido(pedido.id),
      })
    } catch (error) {
      mostrarAviso({ texto: mensajeDeError(error) })
    }
  }

  const aPedir = datos?.aPedir
  const enCurso = datos?.enCurso ?? []

  return (
    <PantallaConBarra activa="pedir">
      <header className="cabecera-lista">
        <div className="cabecera-lista__titulos">
          <span
            className={
              aPedir?.length
                ? 'etiqueta cabecera-lista__contador cabecera-lista__contador--alerta'
                : 'etiqueta cabecera-lista__contador'
            }
          >
            {aPedir === undefined ? ' ' : `${aPedir.length} bajo mínimo`}
          </span>
          <h1 className="cabecera-lista__titulo">A pedir</h1>
        </div>
        <button
          type="button"
          className="boton boton--compacto"
          onClick={() => setCompartiendo(true)}
          disabled={!aPedir?.length}
        >
          <Icono nombre="compartir" tamano={16} />
          Compartir lista
        </button>
      </header>

      <main className="contenido a-pedir">
        {aPedir && aPedir.length === 0 && (
          <p className="a-pedir__vacio">
            Nada que pedir: todos los productos están por encima de su mínimo
            {enCurso.length > 0 ? ' o ya están pedidos' : ''}.
          </p>
        )}

        {aPedir && aPedir.length > 0 && (
          <ul className="a-pedir__lista">
            {aPedir.map((producto) => (
              <TarjetaPedir key={producto.id} producto={producto} alMarcar={() => void marcarPedido(producto)} />
            ))}
          </ul>
        )}

        {datos && (
          <section className="en-curso" aria-labelledby="pedidos-en-curso">
            <h2 id="pedidos-en-curso" className="en-curso__titulo">
              <span>Pedidos en curso</span>
              <span>{enCurso.length}</span>
            </h2>
            {enCurso.length === 0 ? (
              <p className="texto-secundario">Ningún pedido pendiente de recibir.</p>
            ) : (
              <ul className="en-curso__lista">
                {enCurso.map((item) => (
                  <li key={item.pedido.id}>
                    <button type="button" className="en-curso__fila" onClick={() => setPedidoAbierto(item)}>
                      <span className="en-curso__nombre">{item.producto.nombre}</span>
                      <span className="en-curso__fecha">Pedido {formatearDiaMes(item.pedido.fechaPedido, datos.ahora)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {aPedir && (
        <DialogoCompartir abierto={compartiendo} productos={aPedir} alCerrar={() => setCompartiendo(false)} />
      )}
      {pedidoAbierto && (
        <DialogoPedido key={pedidoAbierto.pedido.id} item={pedidoAbierto} alCerrar={() => setPedidoAbierto(null)} />
      )}
    </PantallaConBarra>
  )
}

function TarjetaPedir({ producto, alMarcar }: { producto: Producto; alMarcar: () => void }) {
  return (
    <li className="tarjeta-pedir">
      <div className="tarjeta-pedir__cabecera">
        <Enlace ruta={{ pantalla: 'producto', id: producto.id }} className="tarjeta-pedir__producto">
          <span className="tarjeta-pedir__nombre">{producto.nombre}</span>
          <span className="tarjeta-pedir__ubicacion">
            {producto.codigo} · {ubicacionCorta(producto)}
          </span>
        </Enlace>
        <button type="button" className="boton boton--compacto tarjeta-pedir__marcar" onClick={alMarcar}>
          Marcar pedido
        </button>
      </div>
      <dl className="tarjeta-pedir__datos">
        <div>
          <dt className="etiqueta etiqueta--pequena">Quedan</dt>
          <dd className="tarjeta-pedir__valor tarjeta-pedir__valor--quedan">
            {formatearNumero(producto.stockActual)} <span className="tarjeta-pedir__unidad">{producto.unidadCorta}</span>
          </dd>
        </div>
        <div>
          <dt className="etiqueta etiqueta--pequena">Mínimo</dt>
          <dd className="tarjeta-pedir__valor">{formatearNumero(producto.stockMinimo)}</dd>
        </div>
        <div>
          <dt className="etiqueta etiqueta--pequena">Sugerido</dt>
          <dd className="tarjeta-pedir__valor">
            {producto.cantidadPedidoSugerida === undefined ? '—' : formatearNumero(producto.cantidadPedidoSugerida)}
          </dd>
        </div>
      </dl>
    </li>
  )
}

function DialogoCompartir({
  abierto,
  productos,
  alCerrar,
}: {
  abierto: boolean
  productos: Producto[]
  alCerrar: () => void
}) {
  const ajustes = useAjustes()
  const [ahora] = useState(() => new Date())
  const texto = textoListaPedir(productos, ajustes?.laboratorio ?? '', ahora)

  async function compartir() {
    try {
      const resultado = await compartirTexto('Lista para pedir', texto)
      if (resultado === 'cancelado') return
      alCerrar()
      if (resultado === 'copiado') mostrarAviso({ texto: 'Lista copiada: pégala donde quieras mandarla.' })
    } catch (error) {
      mostrarAviso({ texto: error instanceof Error ? error.message : mensajeDeError(error) })
    }
  }

  async function csv() {
    const archivo = new File([csvListaPedir(productos)], `a-pedir-${fechaSinHora(ahora)}.csv`, {
      type: 'text/csv',
    })
    try {
      const resultado = await compartirArchivo(archivo, 'Lista para pedir (CSV)')
      if (resultado === 'cancelado') return
      alCerrar()
      if (resultado === 'descargado') mostrarAviso({ texto: `Descargado: ${archivo.name}.` })
    } catch (error) {
      mostrarAviso({ texto: mensajeDeError(error) })
    }
  }

  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Compartir lista">
      <pre className="compartir__vista" tabIndex={0} aria-label="Texto que se va a compartir">
        {texto}
      </pre>
      <div className="hoja__acciones">
        <button type="button" className="boton" onClick={() => void csv()}>
          CSV
        </button>
        <button type="button" className="boton boton--primario" onClick={() => void compartir()}>
          <Icono nombre="compartir" tamano={18} />
          {puedeCompartirTexto() ? 'Compartir' : 'Copiar texto'}
        </button>
      </div>
    </Dialogo>
  )
}

function DialogoPedido({ item, alCerrar }: { item: PedidoEnCurso; alCerrar: () => void }) {
  const { repo } = useServicios()
  const { pedido, producto } = item
  const [anulando, setAnulando] = useState(false)

  async function anular() {
    setAnulando(true)
    try {
      await repo.cancelarPedido(pedido.id)
      alCerrar()
      mostrarAviso({ texto: `Pedido anulado: ${producto.nombre}.` })
    } catch (error) {
      setAnulando(false)
      mostrarAviso({ texto: mensajeDeError(error) })
    }
  }

  const sugerida =
    pedido.cantidad === undefined ? undefined : `${formatearNumero(pedido.cantidad)} ${producto.unidadCorta}`

  return (
    <Dialogo abierto alCerrar={alCerrar} titulo={producto.nombre}>
      <dl className="ficha">
        <div className="ficha__celda">
          <dt className="etiqueta etiqueta--pequena">Pedido</dt>
          <dd className="ficha__valor ficha__valor--fecha">{formatearFecha(pedido.fechaPedido)}</dd>
        </div>
        <div className="ficha__celda">
          <dt className="etiqueta etiqueta--pequena">Cantidad</dt>
          <dd className="ficha__valor">{sugerida ?? '—'}</dd>
        </div>
        <div className="ficha__celda">
          <dt className="etiqueta etiqueta--pequena">Stock actual</dt>
          <dd className="ficha__valor">
            {formatearNumero(producto.stockActual)} <span className="ficha__unidad">{producto.unidadCorta}</span>
          </dd>
        </div>
        <div className="ficha__celda">
          <dt className="etiqueta etiqueta--pequena">Mínimo</dt>
          <dd className="ficha__valor">{formatearNumero(producto.stockMinimo)}</dd>
        </div>
      </dl>
      <p className="texto-secundario">
        Al registrar la entrada de este producto, el pedido pasa a recibido.
        {estaBajoMinimo(producto) ? '' : ' Ahora mismo no está bajo mínimo.'}
      </p>
      <button
        type="button"
        className="boton boton--primario boton--ancho"
        onClick={() => {
          alCerrar()
          navegar({ pantalla: 'entrada', productoId: producto.id })
        }}
      >
        Registrar entrada
      </button>
      <div className="hoja__acciones">
        <button type="button" className="boton" onClick={alCerrar}>
          Cerrar
        </button>
        <button type="button" className="boton boton--contorno" onClick={() => void anular()} disabled={anulando}>
          Anular pedido
        </button>
      </div>
    </Dialogo>
  )
}
