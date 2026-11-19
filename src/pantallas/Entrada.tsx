import { useId, useRef, useState, type FormEvent } from 'react'
import { mostrarAviso } from '../app/avisos'
import { useServicios } from '../app/contexto'
import { Enlace } from '../app/Enlace'
import { useAjustes, useConsulta } from '../app/hooks'
import { volver } from '../app/navegacion'
import type { Pedido, Producto } from '../datos/tipos'
import { coincideBusqueda } from '../dominio/busqueda'
import { formatearEntradaMesAnio, leerMesAnio, yaCaducado } from '../dominio/caducidad'
import { mensajeDeError } from '../dominio/errores'
import { conPunto, formatearDiaMes, formatearNumero } from '../dominio/formato'
import { leerNumero, numeroParaCampo, redondear } from '../dominio/numeros'
import { efectoEntrada, estaBajoMinimo } from '../dominio/stock'
import { ubicacionCorta } from '../dominio/ubicacion'
import { Buscador } from '../ui/Buscador'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { CambioStock } from '../ui/CambioStock'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'
import { PantallaCompleta } from '../ui/Pantalla'
import '../ui/FilaProducto.css'
import './Entrada.css'

type CampoError = 'producto' | 'cantidad' | 'caducidad' | null

/** Maqueta Entrada: lo que llega de un pedido se suma a mano. */
export function Entrada({ productoId }: { productoId?: string }) {
  const { datos } = useConsulta(async (repo) => {
    const [productos, pedidos] = await Promise.all([
      repo.listarProductos({ incluirArchivados: true }),
      repo.listarPedidos('pedido'),
    ])
    return { productos, pedidos }
  }, [])

  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'stock' }} titulo="Registrar entrada" />
      {datos && (
        <FormularioEntrada
          // Si se abre desde la ficha de otro producto, el formulario empieza de cero.
          key={productoId ?? ''}
          productos={datos.productos}
          pedidos={datos.pedidos}
          productoInicial={productoId}
        />
      )}
    </PantallaCompleta>
  )
}

function cantidadInicial(producto: Producto | undefined, pedido: Pedido | undefined): string {
  if (!producto) return '1'
  return numeroParaCampo(pedido?.cantidad ?? 1)
}

function FormularioEntrada({
  productos,
  pedidos,
  productoInicial,
}: {
  productos: Producto[]
  pedidos: Pedido[]
  productoInicial: string | undefined
}) {
  const { repo } = useServicios()
  const ajustes = useAjustes()
  const [productoId, setProductoId] = useState(productoInicial)
  const producto = productos.find((p) => p.id === productoId)
  const pedido = pedidos.find((p) => p.productoId === productoId)
  const [cantidadTexto, setCantidadTexto] = useState(() => cantidadInicial(producto, pedido))
  const [lote, setLote] = useState('')
  const [caducidadTexto, setCaducidadTexto] = useState('')
  const [nota, setNota] = useState('')
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [error, setError] = useState<{ campo: CampoError; mensaje: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const refSelector = useRef<HTMLButtonElement>(null)
  const refCantidad = useRef<HTMLInputElement>(null)
  const refCaducidad = useRef<HTMLInputElement>(null)
  const idFormulario = useId()
  const idProducto = useId()
  const idCantidad = useId()
  const idError = useId()

  const cantidad = leerNumero(cantidadTexto)
  const cantidadValida = cantidad !== null && cantidad > 0
  const efecto = producto && cantidadValida ? efectoEntrada(producto, cantidad) : undefined
  const caducidad = leerMesAnio(caducidadTexto)
  const [ahora] = useState(() => new Date())

  function elegir(id: string) {
    const elegido = productos.find((p) => p.id === id)
    setProductoId(id)
    setCantidadTexto(cantidadInicial(elegido, pedidos.find((p) => p.productoId === id)))
    setSelectorAbierto(false)
    if (error?.campo === 'producto') setError(null)
  }

  function sumar(paso: number) {
    const base = cantidad ?? 0
    setCantidadTexto(numeroParaCampo(Math.max(1, redondear(base + paso))))
    if (error?.campo === 'cantidad') setError(null)
  }

  function errorEn(campo: CampoError, mensaje: string, foco?: HTMLElement | null) {
    setError({ campo, mensaje })
    foco?.focus()
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || !ajustes) return
    if (!producto) return errorEn('producto', 'Elige el producto que ha llegado.', refSelector.current)
    if (!cantidadValida) return errorEn('cantidad', 'Las unidades recibidas tienen que ser un número mayor que cero.', refCantidad.current)
    if (caducidad.estado === 'no-valido') return errorEn('caducidad', caducidad.mensaje, refCaducidad.current)

    setError(null)
    setGuardando(true)
    try {
      const { movimiento } = await repo.registrarMovimiento({
        productoId: producto.id,
        tipo: 'entrada',
        cantidad,
        usuario: ajustes.usuario,
        lote,
        nota,
        ...(caducidad.estado === 'valido' ? { caducidad: caducidad.caducidad } : {}),
      })
      volver({ pantalla: 'stock' })
      mostrarAviso({
        texto: conPunto(
          `Entrada guardada: ${producto.nombre}, ${formatearNumero(producto.stockActual)} → ` +
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

  const activos = productos.filter((p) => !p.archivado)
  if (activos.length === 0 && !producto) {
    return (
      <main className="contenido">
        <div className="lista-vacia">
          <p className="lista-vacia__titulo">No hay productos en el catálogo</p>
          <p className="texto-secundario">Antes de registrar una entrada, da de alta el producto.</p>
          <Enlace ruta={{ pantalla: 'producto-nuevo' }} className="boton boton--compacto">
            <Icono nombre="mas" tamano={16} />
            Nuevo producto
          </Enlace>
        </div>
      </main>
    )
  }

  const avisos = describirEfecto(producto, efecto, pedido, ahora)

  return (
    <>
      <form id={idFormulario} className="contenido entrada" onSubmit={guardar} noValidate>
        <div className="campo">
          <span className="etiqueta" id={idProducto}>
            Producto
          </span>
          <button
            ref={refSelector}
            type="button"
            className="selector-producto"
            aria-haspopup="dialog"
            aria-labelledby={`${idProducto} ${idProducto}-valor`}
            aria-invalid={error?.campo === 'producto' || undefined}
            aria-describedby={error?.campo === 'producto' ? idError : undefined}
            onClick={() => setSelectorAbierto(true)}
          >
            <span id={`${idProducto}-valor`} className="selector-producto__textos">
              {producto ? (
                <>
                  <span className="selector-producto__nombre">{producto.nombre}</span>
                  <span className="selector-producto__ubicacion">
                    {producto.codigo} · {ubicacionCorta(producto)}
                  </span>
                </>
              ) : (
                <span className="selector-producto__nombre selector-producto__nombre--vacio">Elegir producto</span>
              )}
            </span>
            <Icono nombre="desplegar" tamano={18} />
          </button>
          {error?.campo === 'producto' && <MensajeError id={idError} texto={error.mensaje} />}
        </div>

        <div className="tarjeta-cantidad">
          <label className="etiqueta" htmlFor={idCantidad}>
            Unidades recibidas
          </label>
          <div className="contador">
            <button
              type="button"
              className="contador__boton"
              aria-label="Restar uno"
              onClick={() => sumar(-1)}
              disabled={!cantidadValida || cantidad <= 1}
            >
              −
            </button>
            <span className="contador__valor">
              <span aria-hidden="true">+</span>
              <input
                ref={refCantidad}
                id={idCantidad}
                className="contador__entrada"
                inputMode="decimal"
                value={cantidadTexto}
                size={Math.max(1, cantidadTexto.length)}
                onChange={(e) => {
                  setCantidadTexto(e.target.value)
                  if (error?.campo === 'cantidad') setError(null)
                }}
                onFocus={(e) => e.target.select()}
                aria-invalid={error?.campo === 'cantidad' || undefined}
                aria-describedby={error?.campo === 'cantidad' ? idError : undefined}
                autoComplete="off"
              />
            </span>
            <button type="button" className="contador__boton" aria-label="Sumar uno" onClick={() => sumar(1)}>
              +
            </button>
          </div>
          {error?.campo === 'cantidad' && <MensajeError id={idError} texto={error.mensaje} />}
          {producto && (
            <div className="tarjeta-cantidad__resultado">
              <CambioStock producto={producto} despues={efecto?.stockResultante} />
            </div>
          )}
        </div>

        <div className="entrada__pareja">
          <label className="campo">
            <span className="etiqueta">Lote</span>
            <input
              className="campo__entrada campo__entrada--mono"
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="campo">
            <label className="etiqueta" htmlFor={`${idFormulario}-caducidad`}>
              Caducidad
            </label>
            <input
              ref={refCaducidad}
              id={`${idFormulario}-caducidad`}
              className="campo__entrada campo__entrada--mono"
              value={caducidadTexto}
              onChange={(e) => {
                const borrando = e.target.value.length < caducidadTexto.length
                setCaducidadTexto(formatearEntradaMesAnio(e.target.value, borrando))
                if (error?.campo === 'caducidad') setError(null)
              }}
              placeholder="MM / AAAA"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={error?.campo === 'caducidad' || undefined}
              aria-describedby={error?.campo === 'caducidad' ? idError : `${idFormulario}-caducidad-ayuda`}
            />
            {error?.campo === 'caducidad' ? (
              <MensajeError id={idError} texto={error.mensaje} />
            ) : (
              <span id={`${idFormulario}-caducidad-ayuda`} className="campo__ayuda">
                {caducidad.estado === 'valido' && yaCaducado(caducidad.caducidad, ahora)
                  ? 'Ojo: esa fecha ya ha pasado.'
                  : 'Mes y año de la etiqueta.'}
              </span>
            )}
          </div>
        </div>

        <label className="campo">
          <span className="etiqueta">Nota (opcional)</span>
          <input
            className="campo__entrada"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nº de albarán, proveedor…"
            autoComplete="off"
          />
        </label>

        {avisos.length > 0 && (
          <div className="nota-info" aria-live="polite">
            <Icono nombre="info" tamano={18} />
            <span>{avisos.join(' ')}</span>
          </div>
        )}

        {error?.campo === null && <MensajeError id={idError} texto={error.mensaje} />}
      </form>

      <div className="barra-accion">
        <button
          type="submit"
          form={idFormulario}
          className="boton boton--primario boton--grande boton--ancho"
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar entrada'}
        </button>
      </div>

      <SelectorProducto
        abierto={selectorAbierto}
        productos={activos}
        elegido={productoId}
        alElegir={elegir}
        alCerrar={() => setSelectorAbierto(false)}
      />
    </>
  )
}

/** Qué va a pasar al guardar: pedido recibido, sale de «A pedir» o sigue bajo mínimo. */
function describirEfecto(
  producto: Producto | undefined,
  efecto: ReturnType<typeof efectoEntrada> | undefined,
  pedido: Pedido | undefined,
  ahora: Date,
): string[] {
  if (!producto || !efecto) return []
  const minimo = formatearNumero(producto.stockMinimo)
  const frases: string[] = []
  if (pedido) frases.push(`Al guardar, el pedido del ${formatearDiaMes(pedido.fechaPedido, ahora)} pasa a recibido.`)
  if (efecto.superaMinimo) {
    frases.push(
      pedido
        ? `Con esta entrada el producto supera el mínimo (${minimo}).`
        : `Al guardar, el producto sale de la lista «A pedir» porque supera el mínimo (${minimo}).`,
    )
  } else if (efecto.sigueBajoMinimo) {
    frases.push(`Con esta entrada sigue en su mínimo o por debajo (${minimo}): seguirá en «A pedir».`)
  }
  return frases
}

function MensajeError({ id, texto }: { id: string; texto: string }) {
  return (
    <p id={id} className="mensaje-error" role="alert">
      <Icono nombre="info" tamano={18} />
      {texto}
    </p>
  )
}

function SelectorProducto({
  abierto,
  productos,
  elegido,
  alElegir,
  alCerrar,
}: {
  abierto: boolean
  productos: Producto[]
  elegido: string | undefined
  alElegir: (id: string) => void
  alCerrar: () => void
}) {
  const [texto, setTexto] = useState('')
  const lista = productos.filter((p) => coincideBusqueda(p, texto))

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={() => {
        setTexto('')
        alCerrar()
      }}
      titulo="Elegir producto"
    >
      <Buscador
        etiqueta="Buscar producto"
        placeholder="Nombre, código o ubicación"
        valor={texto}
        alCambiar={setTexto}
        className="buscador--claro"
      />
      {lista.length === 0 && <p className="texto-secundario">Ningún producto coincide con la búsqueda.</p>}
      <ul className="lista-tarjeta selector-lista">
        {lista.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="selector-lista__opcion"
              aria-current={p.id === elegido || undefined}
              onClick={() => {
                setTexto('')
                alElegir(p.id)
              }}
            >
              <span className="codigo-producto">{p.codigo}</span>
              <span className="fila-producto__textos">
                <span className="fila-producto__nombre">{p.nombre}</span>
                <span className="fila-producto__linea">
                  {p.formato} · {ubicacionCorta(p)}
                </span>
              </span>
              <span className="fila-producto__derecha">
                <span className={estaBajoMinimo(p) ? 'cantidad-fila cantidad-fila--bajo' : 'cantidad-fila'}>
                  {formatearNumero(p.stockActual)} <span className="cantidad-fila__unidad">{p.unidadCorta}</span>
                </span>
                {estaBajoMinimo(p) && <span className="insignia-bajo-minimo">Bajo mín. {formatearNumero(p.stockMinimo)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialogo>
  )
}
