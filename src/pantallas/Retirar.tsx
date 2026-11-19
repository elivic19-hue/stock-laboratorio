import { useCallback, useId, useMemo, useState } from 'react'
import { mostrarAviso } from '../app/avisos'
import { useServicios } from '../app/contexto'
import { useAjustes, useConsulta } from '../app/hooks'
import { volver } from '../app/navegacion'
import type { AjustesDispositivo } from '../datos/ajustes'
import type { Producto } from '../datos/tipos'
import { mensajeDeError } from '../dominio/errores'
import { conPunto, formatearNumero } from '../dominio/formato'
import { leerNumero, numeroParaCampo, redondear } from '../dominio/numeros'
import { estaBajoMinimo } from '../dominio/stock'
import { ubicacionMedia } from '../dominio/ubicacion'
import { crearMiniatura } from '../reconocimiento/camara'
import { reconocer, type PuntuacionProducto, type ResultadoReconocimiento } from '../reconocimiento/comparar'
import { cargarModelo, useEstadoModelo } from '../reconocimiento/modelo'
import { Icono } from '../ui/Icono'
import { PantallaCompleta } from '../ui/Pantalla'
import { SelectorProducto } from '../ui/SelectorProducto'
import { VisorCamara } from '../ui/VisorCamara'
import './Retirar.css'

interface Captura {
  imagen: HTMLCanvasElement
  /** La misma imagen, para enseñarla fija en el marco. */
  vista: string
  vector: number[]
  ms: number
  resultado: ResultadoReconocimiento
}

type Fase = { fase: 'visor' } | { fase: 'analizando'; vista: string } | ({ fase: 'resultado' } & Captura)

/** Producto elegido: por la foto (el propuesto o una alternativa) o buscado a mano. */
interface Eleccion {
  productoId: string
  via: 'foto' | 'manual'
}

/** Maqueta Retirar: foto → reconocimiento en el móvil → confirmar con un toque. */
export function Retirar() {
  const ajustes = useAjustes()
  const modelo = useEstadoModelo()
  const [fase, setFase] = useState<Fase>({ fase: 'visor' })
  const [eleccion, setEleccion] = useState<Eleccion | null>(null)
  const [buscando, setBuscando] = useState(false)

  const { datos } = useConsulta(async (repo) => {
    const [productos, fotos] = await Promise.all([repo.listarProductos(), repo.listarFotos()])
    const activos = new Set(productos.map((p) => p.id))
    return {
      productos,
      // Solo cuentan las fotos de productos no archivados.
      referencias: fotos
        .filter((f) => activos.has(f.productoId))
        .map((f) => ({ productoId: f.productoId, embedding: f.embedding })),
    }
  }, [])

  const alCapturar = useCallback(
    async (imagen: HTMLCanvasElement) => {
      if (!datos || !ajustes) return
      const vista = imagen.toDataURL('image/jpeg', 0.85)
      setFase({ fase: 'analizando', vista })
      try {
        const extractor = await cargarModelo()
        const { vector, ms } = await extractor.embedding(imagen)
        const resultado = reconocer(vector, datos.referencias, {
          umbral: ajustes.umbral,
          temperatura: ajustes.temperatura,
        })
        const mejor = resultado.ranking[0]
        setEleccion(resultado.estado === 'seguro' && mejor ? { productoId: mejor.productoId, via: 'foto' } : null)
        setFase({ fase: 'resultado', imagen, vista, vector, ms, resultado })
      } catch (error) {
        setFase({ fase: 'visor' })
        mostrarAviso({ texto: mensajeDeError(error) })
      }
    },
    [ajustes, datos],
  )

  function repetir() {
    setEleccion(null)
    setFase({ fase: 'visor' })
  }

  const pastilla =
    fase.fase === 'analizando' ? (
      <span className="visor__pastilla" role="status">
        <span className="visor__punto" aria-hidden="true" />
        Analizando en el móvil…
      </span>
    ) : fase.fase === 'resultado' ? (
      <span className="visor__pastilla">
        <span className="visor__punto" aria-hidden="true" />
        Reconocido en el móvil · {segundos(fase.ms)} s
      </span>
    ) : (
      <span className="visor__pastilla" role="status">
        <span className="visor__punto" aria-hidden="true" />
        {modelo.estado === 'error'
          ? modelo.mensaje
          : modelo.estado === 'listo'
            ? 'Encuadra el producto en el marco'
            : 'Preparando el reconocimiento…'}
      </span>
    )

  return (
    <PantallaCompleta
      className={fase.fase === 'resultado' ? 'pantalla--visor retirar retirar--resultado' : 'pantalla--visor retirar'}
      colorBarraEstado="#0E1114"
    >
      <VisorCamara
        titulo="Retirar del stock"
        alCerrar={() => volver({ pantalla: 'stock' })}
        alCapturar={(imagen) => void alCapturar(imagen)}
        ocupado={fase.fase !== 'visor' || !datos || modelo.estado === 'error'}
        textoDisparador="Hacer foto y reconocer"
        congelada={fase.fase === 'visor' ? undefined : fase.vista}
        estado={pastilla}
        compacto={fase.fase === 'resultado'}
        izquierda={
          <button type="button" className="visor__texto-boton" onClick={() => setBuscando(true)}>
            Buscar a mano
          </button>
        }
      />

      {fase.fase === 'resultado' && datos && ajustes && (
        <HojaResultado
          captura={fase}
          productos={datos.productos}
          eleccion={eleccion}
          ajustes={ajustes}
          alElegir={setEleccion}
          alBuscar={() => setBuscando(true)}
          alRepetir={repetir}
        />
      )}

      <SelectorProducto
        titulo="Buscar a mano"
        abierto={buscando}
        productos={datos?.productos ?? []}
        elegido={eleccion?.productoId}
        alElegir={(productoId) => {
          setBuscando(false)
          setEleccion({ productoId, via: 'manual' })
          // Sin foto hecha, se pasa igualmente a la hoja de resultado con el producto elegido.
          if (fase.fase !== 'resultado') {
            setFase({
              fase: 'resultado',
              imagen: document.createElement('canvas'),
              vista: '',
              vector: [],
              ms: 0,
              resultado: { estado: 'sin-referencias', ranking: [] },
            })
          }
        }}
        alCerrar={() => setBuscando(false)}
      />
    </PantallaCompleta>
  )
}

/** «0,3» o, si tarda menos de una décima, «0,03». */
function segundos(ms: number): string {
  const s = ms / 1000
  return formatearNumero(s >= 0.1 ? Math.round(s * 10) / 10 : Math.max(0.01, Math.round(s * 100) / 100))
}

/** «87 %»; por debajo del 1 %, «<1 %» en vez de un «0 %» que parece un fallo. */
function porcentaje(confianza: number): string {
  const redondeado = Math.round(confianza * 100)
  return redondeado < 1 ? '<1 %' : `${redondeado} %`
}

function nombreCorto(nombre: string): string {
  // «Puntas de pipeta 200 µL» → «Puntas 200 µL», como los botones de la maqueta.
  return nombre.replace(/\s+de\s+pipeta\b/i, '').replace(/\s+/g, ' ')
}

function HojaResultado({
  captura,
  productos,
  eleccion,
  ajustes,
  alElegir,
  alBuscar,
  alRepetir,
}: {
  captura: Captura
  productos: Producto[]
  eleccion: Eleccion | null
  ajustes: AjustesDispositivo
  alElegir: (eleccion: Eleccion) => void
  alBuscar: () => void
  alRepetir: () => void
}) {
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const { resultado } = captura
  const conFoto = captura.vector.length > 0
  const elegido = eleccion ? porId.get(eleccion.productoId) : undefined
  const puntuacionElegido = eleccion && resultado.ranking.find((r) => r.productoId === eleccion.productoId)

  // Alternativas: los siguientes del ranking que no son el elegido (2 si hay elegido, 3 si se duda).
  const alternativas = resultado.ranking
    .filter((r) => r.productoId !== eleccion?.productoId && porId.has(r.productoId))
    .slice(0, elegido ? 2 : 3)

  return (
    <section className="hoja-resultado" aria-label="Resultado">
      {elegido ? (
        <>
          <div className="hoja-resultado__fila">
            <span className="etiqueta">{eleccion?.via === 'manual' ? 'Elegido a mano' : 'Coincidencia'}</span>
            {eleccion?.via === 'foto' && puntuacionElegido && (
              <span className="insignia-confianza">{porcentaje(puntuacionElegido.confianza)}</span>
            )}
          </div>
          <FormularioRetirada
            key={elegido.id}
            producto={elegido}
            captura={captura}
            via={eleccion?.via ?? 'manual'}
            confianza={eleccion?.via === 'foto' ? puntuacionElegido?.confianza : undefined}
            // Se ofrece guardar la foto siempre que la haya: si el reconocimiento acertó (§5) y también
            // si la persona lo corrigió con «¿No es este?» o a mano, que son las fotos que más enseñan.
            puedeGuardarFoto={conFoto}
            guardarFotoPorDefecto={ajustes.guardarFotoAlConfirmar}
          />
        </>
      ) : (
        <div className="hoja-resultado__duda">
          <h2 className="hoja-resultado__titulo">
            {resultado.estado === 'sin-referencias' ? 'Aún no hay fotos de referencia' : 'No estoy seguro'}
          </h2>
          <p className="texto-secundario">
            {resultado.estado === 'sin-referencias'
              ? 'Para reconocer un producto hacen falta sus fotos de referencia: hazlas desde su ficha, en «Añadir fotos». Mientras, búscalo a mano.'
              : '¿Es alguno de estos? Si no, búscalo a mano o repite la foto con más luz y el producto centrado.'}
          </p>
        </div>
      )}

      {alternativas.length > 0 && (
        <div className="hoja-resultado__alternativas">
          <span className="etiqueta">{elegido ? '¿No es este?' : 'Puede ser'}</span>
          <div className={elegido ? 'alternativas' : 'alternativas alternativas--lista'}>
            {alternativas.map((alt) => {
              const p = porId.get(alt.productoId)
              if (!p) return null
              return (
                <button
                  key={alt.productoId}
                  type="button"
                  className="alternativa"
                  onClick={() => alElegir({ productoId: alt.productoId, via: 'foto' })}
                >
                  <span className="alternativa__nombre">{elegido ? nombreCorto(p.nombre) : p.nombre}</span>
                  <span className="alternativa__porcentaje">{porcentaje(alt.confianza)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="hoja-resultado__enlaces">
        <button type="button" className="enlace-boton" onClick={alBuscar}>
          Buscar a mano
        </button>
        <button type="button" className="enlace-boton" onClick={alRepetir}>
          Repetir foto
        </button>
      </div>

      {ajustes.modoDiagnostico && conFoto && (
        <Diagnostico captura={captura} porId={porId} ajustes={ajustes} />
      )}
    </section>
  )
}

function FormularioRetirada({
  producto,
  captura,
  via,
  confianza,
  puedeGuardarFoto,
  guardarFotoPorDefecto,
}: {
  producto: Producto
  captura: Captura
  via: 'foto' | 'manual'
  confianza: number | undefined
  puedeGuardarFoto: boolean
  guardarFotoPorDefecto: boolean
}) {
  const { repo } = useServicios()
  const ajustes = useAjustes()
  const [cantidadTexto, setCantidadTexto] = useState('1')
  const [guardarFoto, setGuardarFoto] = useState(guardarFotoPorDefecto)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idCantidad = useId()
  const idError = useId()

  const cantidad = leerNumero(cantidadTexto)
  const sinStock = producto.stockActual <= 0
  const valida = cantidad !== null && cantidad > 0 && cantidad <= producto.stockActual
  const tras = valida ? redondear(producto.stockActual - cantidad) : undefined

  function sumar(paso: number) {
    const base = cantidad ?? 0
    const siguiente = Math.min(producto.stockActual, Math.max(1, redondear(base + paso)))
    setCantidadTexto(numeroParaCampo(siguiente))
    setError(null)
  }

  async function confirmar() {
    if (guardando || !ajustes) return
    if (!valida) {
      setError(
        conPunto(
          `Escribe cuántas retiras: más de cero y como mucho ${formatearNumero(producto.stockActual)} ${producto.unidadCorta}`,
        ),
      )
      return
    }
    setGuardando(true)
    try {
      const { movimiento, producto: actualizado } = await repo.registrarMovimiento({
        productoId: producto.id,
        tipo: via === 'foto' ? 'retirada_foto' : 'retirada_manual',
        cantidad: -cantidad,
        usuario: ajustes.usuario,
        ...(via === 'foto' && confianza !== undefined ? { confianza } : {}),
      })
      let fotoId: string | undefined
      if (puedeGuardarFoto && guardarFoto) {
        // Si falla la foto, la retirada ya está hecha: no se deshace por eso.
        try {
          const miniatura = await crearMiniatura(captura.imagen)
          const foto = await repo.guardarFoto({
            productoId: producto.id,
            embedding: captura.vector,
            miniatura,
            origen: 'confirmacion',
          })
          fotoId = foto?.id
        } catch (e) {
          console.warn('No se pudo guardar la foto de referencia', e)
        }
      }
      volver({ pantalla: 'stock' })
      const bajo = estaBajoMinimo(actualizado)
      mostrarAviso({
        texto:
          conPunto(
            `Retirado: ${producto.nombre}, ${formatearNumero(producto.stockActual)} → ` +
              `${formatearNumero(actualizado.stockActual)} ${producto.unidadCorta}`,
          ) + (bajo ? ` Está en su mínimo (${formatearNumero(producto.stockMinimo)}): hay que pedirlo.` : ''),
        accion: 'Deshacer',
        alPulsarAccion: async () => {
          await repo.deshacerMovimiento(movimiento.id)
          if (fotoId) await repo.borrarFoto(fotoId)
        },
        duracion: bajo ? 9000 : undefined,
      })
    } catch (e) {
      setError(mensajeDeError(e))
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="hoja-resultado__producto">
        <h2 className="hoja-resultado__titulo">{producto.nombre}</h2>
        <span className="hoja-resultado__ubicacion">
          {producto.formato} · {ubicacionMedia(producto)}
        </span>
      </div>

      <dl className="ficha ficha--retirar">
        <div className="ficha__celda">
          <dt className="etiqueta etiqueta--pequena">Stock actual</dt>
          <dd className="ficha__valor">
            {formatearNumero(producto.stockActual)} <span className="ficha__unidad">{producto.unidadCorta}</span>
          </dd>
        </div>
        <div className="ficha__celda ficha__celda--resaltada">
          <dt className="etiqueta etiqueta--pequena">Tras retirar</dt>
          <dd className="ficha__valor ficha__valor--fuerte">
            {tras === undefined ? '–' : formatearNumero(tras)} <span className="ficha__unidad">{producto.unidadCorta}</span>
            {tras !== undefined && estaBajoMinimo({ stockActual: tras, stockMinimo: producto.stockMinimo }) && (
              <span className="insignia-bajo-minimo ficha__insignia">Bajo mín.</span>
            )}
          </dd>
        </div>
      </dl>

      {sinStock ? (
        <p className="mensaje-error" role="alert">
          <Icono nombre="info" tamano={18} />
          No queda stock de este producto. Si hay en el armario, registra la entrada o ajusta el stock desde su ficha.
        </p>
      ) : (
        <>
          <div className="hoja-resultado__fila">
            <label className="hoja-resultado__etiqueta-cantidad" htmlFor={idCantidad}>
              Cantidad
            </label>
            <div className="paso">
              <button
                type="button"
                className="paso__boton"
                aria-label="Restar uno"
                onClick={() => sumar(-1)}
                disabled={!valida || cantidad <= 1}
              >
                −
              </button>
              <input
                id={idCantidad}
                className="paso__valor"
                inputMode="decimal"
                value={cantidadTexto}
                onChange={(e) => {
                  setCantidadTexto(e.target.value)
                  setError(null)
                }}
                onFocus={(e) => e.target.select()}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? idError : undefined}
                autoComplete="off"
              />
              <button
                type="button"
                className="paso__boton"
                aria-label="Sumar uno"
                onClick={() => sumar(1)}
                disabled={cantidad !== null && cantidad >= producto.stockActual}
              >
                +
              </button>
            </div>
          </div>

          {puedeGuardarFoto && (
            <label className="casilla">
              <input type="checkbox" checked={guardarFoto} onChange={(e) => setGuardarFoto(e.target.checked)} />
              Guardar esta foto como referencia
            </label>
          )}

          {error && (
            <p id={idError} className="mensaje-error" role="alert">
              <Icono nombre="info" tamano={18} />
              {error}
            </p>
          )}

          <button
            type="button"
            className="boton boton--primario boton--ancho"
            onClick={() => void confirmar()}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Confirmar retirada'}
          </button>
        </>
      )}
    </>
  )
}

function Diagnostico({
  captura,
  porId,
  ajustes,
}: {
  captura: Captura
  porId: Map<string, Producto>
  ajustes: AjustesDispositivo
}) {
  const { resultado } = captura
  const motivo =
    resultado.estado === 'seguro'
      ? 'seguro'
      : resultado.motivo === 'puntuacion-baja'
        ? 'duda: puntuación por debajo del umbral'
        : resultado.motivo === 'muy-igualados'
          ? 'duda: primero y segundo muy igualados'
          : 'sin referencias'
  const filas: PuntuacionProducto[] = resultado.ranking.slice(0, 5)
  return (
    <section className="diagnostico" aria-label="Diagnóstico del reconocimiento">
      <span className="etiqueta">Diagnóstico</span>
      <p className="diagnostico__resumen mono">
        {formatearNumero(Math.round(captura.ms))} ms · umbral {formatearNumero(ajustes.umbral)} · temp.{' '}
        {formatearNumero(ajustes.temperatura)} · {motivo}
      </p>
      <table className="diagnostico__tabla">
        <thead>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Punt.</th>
            <th scope="col">Conf.</th>
            <th scope="col">Fotos</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.productoId}>
              <th scope="row">{porId.get(f.productoId)?.codigo ?? '?'}</th>
              <td>{f.puntuacion.toFixed(3).replace('.', ',')}</td>
              <td>{porcentaje(f.confianza)}</td>
              <td>{f.referencias}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
