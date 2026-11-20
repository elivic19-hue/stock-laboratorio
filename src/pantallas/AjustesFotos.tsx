import { useState, type ReactNode } from 'react'
import { mostrarAviso } from '../app/avisos'
import { Enlace } from '../app/Enlace'
import { useServicios } from '../app/contexto'
import type { Producto } from '../datos/tipos'
import { mensajeDeError } from '../dominio/errores'
import { formatearNumero } from '../dominio/formato'
import { vectorEsperado } from '../reconocimiento/autoprueba'
import { cargarModelo, useEstadoModelo } from '../reconocimiento/modelo'
import { recalcularVectores } from '../reconocimiento/recalcular'
import {
  revisarReferencias,
  tieneProblemas,
  type RevisionProducto,
  type RevisionReferencias,
} from '../reconocimiento/revision'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'

const ordenCodigos = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

interface Revision {
  resultado: RevisionReferencias
  productos: Map<string, Producto>
}

/**
 * Ajustes → Fotos de referencia (docs/decisiones.md, «Reconocimiento: siempre el primero con
 * 99 %»): revisar qué productos no se pueden reconocer o tienen fotos mal, y recalcular los
 * vectores desde las miniaturas.
 */
export function SeccionFotosReferencia() {
  const { repo } = useServicios()
  const modelo = useEstadoModelo()
  const [revision, setRevision] = useState<Revision | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function revisar() {
    setRevisando(true)
    setError(null)
    try {
      const [productos, fotos] = await Promise.all([repo.listarProductos(), repo.listarFotos()])
      const ordenados = [...productos].sort((a, b) => ordenCodigos.compare(a.codigo, b.codigo))
      setRevision({
        resultado: revisarReferencias(
          fotos,
          ordenados.map((p) => p.id),
          { vectorNegro: vectorEsperado('negro') },
        ),
        productos: new Map(productos.map((p) => [p.id, p])),
      })
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setRevisando(false)
    }
  }

  async function recalcular() {
    setConfirmar(false)
    setError(null)
    setProgreso({ hechas: 0, total: 0 })
    try {
      const extractor = await cargarModelo()
      const r = await recalcularVectores(repo, extractor, (hechas, total) => setProgreso({ hechas, total }))
      mostrarAviso({
        texto:
          `Vectores recalculados: ${formatearNumero(r.recalculadas)} de ${formatearNumero(r.total)} fotos.` +
          (r.descartadas > 0
            ? ` ${formatearNumero(r.descartadas)} están negras o sin detalle: bórralas desde la ficha de su producto.`
            : ''),
      })
      if (revision) await revisar()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setProgreso(null)
    }
  }

  const modeloListo = modelo.estado === 'listo'
  const ocupado = revisando || progreso !== null

  return (
    <section className="seccion" aria-labelledby="ajustes-fotos-referencia">
      <h2 id="ajustes-fotos-referencia" className="seccion__titulo">
        Fotos de referencia
      </h2>
      <p className="texto-secundario">
        Comprueba qué productos no se pueden reconocer y qué fotos están mal: cada foto se compara con las demás, como
        al retirar.
      </p>
      <div className="ajustes__botones">
        <button type="button" className="boton boton--contorno" onClick={() => void revisar()} disabled={ocupado}>
          {revisando ? 'Revisando…' : revision ? 'Volver a revisar' : 'Revisar fotos'}
        </button>
        <button
          type="button"
          className="boton boton--contorno"
          onClick={() => setConfirmar(true)}
          disabled={ocupado || !modeloListo}
        >
          Recalcular vectores
        </button>
      </div>
      <span className="texto-secundario" role="status">
        {progreso
          ? `Recalculando ${formatearNumero(progreso.hechas)} / ${formatearNumero(progreso.total)}…`
          : !modeloListo
            ? 'Para recalcular hace falta el modelo de reconocimiento cargado.'
            : ''}
      </span>
      {error && (
        <p className="mensaje-error" role="alert">
          <Icono nombre="info" tamano={18} />
          {error}
        </p>
      )}

      {revision && <ResultadoRevision revision={revision} />}

      <Dialogo abierto={confirmar} alCerrar={() => setConfirmar(false)} titulo="Recalcular vectores">
        <div className="dialogo-borrar">
          <p className="dialogo-borrar__instruccion">
            Se vuelve a calcular con este móvil el vector de cada foto de referencia a partir de su miniatura. Sirve si la
            revisión encuentra fotos casi idénticas entre productos distintos o si las hizo un móvil que calculaba mal. Las
            fotos no cambian y el cambio llega a todos los móviles del laboratorio.
          </p>
          <p className="texto-secundario">
            Hazlo solo si hay problemas: en las fotos anteriores al 20/11/2026 la miniatura es más pequeña que la foto
            original y el vector recalculado reconoce algo peor.
          </p>
          <div className="hoja__acciones">
            <button type="button" className="boton" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
            <button type="button" className="boton boton--primario" onClick={() => void recalcular()}>
              Recalcular
            </button>
          </div>
        </div>
      </Dialogo>
    </section>
  )
}

function ResultadoRevision({ revision }: { revision: Revision }) {
  const { resultado, productos } = revision
  const codigo = (id: string | undefined) => (id ? (productos.get(id)?.codigo ?? '?') : '?')
  const conProblemas = resultado.productos.filter(tieneProblemas)
  const bien = resultado.productos.filter((r) => !tieneProblemas(r))
  const total = resultado.productos.length + resultado.sinFotos.length

  if (total === 0) return <p className="texto-secundario">No hay productos en uso.</p>

  return (
    <div className="revision-fotos">
      <p className="revision-fotos__resumen" role="status">
        {resumen(resultado.productos.length, conProblemas.length, resultado.sinFotos.length)}
      </p>
      <ul className="lista-tarjeta">
        {resultado.sinFotos.map((id) => {
          const p = productos.get(id)
          return (
            p && (
              <FilaRevision key={id} producto={p} estado="Sin fotos" texto="No se puede reconocer: haz entre 5 y 10 fotos desde su ficha." />
            )
          )
        })}
        {[...conProblemas, ...bien].map((r) => {
          const p = productos.get(r.productoId)
          return (
            p && (
              <FilaRevision
                key={r.productoId}
                producto={p}
                estado={tieneProblemas(r) ? 'Revisar' : 'Bien'}
                texto={veredicto(r, codigo)}
              />
            )
          )
        })}
      </ul>
    </div>
  )
}

function FilaRevision({ producto, estado, texto }: { producto: Producto; estado: string; texto: ReactNode }) {
  return (
    <li>
      <Enlace ruta={{ pantalla: 'producto', id: producto.id }} className="revision-fotos__fila">
        <span className="codigo-producto">{producto.codigo}</span>
        <span className="revision-fotos__textos">
          <span className="revision-fotos__nombre">{producto.nombre}</span>
          <span className="revision-fotos__veredicto">{texto}</span>
        </span>
        <span className={estado === 'Bien' ? 'etiqueta etiqueta--pequena' : 'etiqueta etiqueta--pequena revision-fotos__revisar'}>
          {estado}
        </span>
      </Enlace>
    </li>
  )
}

function resumen(conFotos: number, conProblemas: number, sinFotos: number): string {
  const partes = [
    conFotos === 1 ? '1 producto con fotos' : `${formatearNumero(conFotos)} productos con fotos`,
    conProblemas > 0 ? `${formatearNumero(conProblemas)} por revisar` : 'todos bien',
  ]
  if (sinFotos > 0) partes.push(sinFotos === 1 ? '1 sin fotos' : `${formatearNumero(sinFotos)} sin fotos`)
  return `${partes.join(' · ')}.`
}

/** Lo más grave que les pasa a las fotos de un producto (solo eso, para que se entienda qué hacer). */
function veredicto(r: RevisionProducto, codigo: (id: string | undefined) => string): ReactNode {
  const n = formatearNumero
  if (r.negras > 0) return `${n(r.negras)} de ${n(r.fotos)} fotos están negras o vacías: bórralas y repítelas.`
  if (r.casiIdenticas > 0) {
    return (
      <>
        {n(r.casiIdenticas)} de {n(r.fotos)} fotos son casi idénticas a las de{' '}
        <span className="revision-fotos__codigo">{codigo(r.casiIdenticasA)}</span>: hechas sin el producto en el marco o mal
        calculadas. Recalcula los vectores y, si sigue igual, repítelas.
      </>
    )
  }
  if (r.fotos < 2) return 'Solo tiene 1 foto: haz entre 5 y 10.'
  if (r.reconocidas < r.fotos) {
    return (
      <>
        Se reconocen {n(r.reconocidas)} de {n(r.fotos)} fotos; las demás salen como{' '}
        <span className="revision-fotos__codigo">{codigo(r.confundidoCon)}</span>. Haz más fotos de los dos, de cerca y de
        la etiqueta.
      </>
    )
  }
  return `Se reconocen las ${n(r.fotos)} fotos.`
}
