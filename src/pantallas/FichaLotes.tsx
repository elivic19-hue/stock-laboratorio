import { useState } from 'react'
import { mostrarAviso } from '../app/avisos'
import { useServicios } from '../app/contexto'
import { useAjustes } from '../app/hooks'
import type { Movimiento, Producto } from '../datos/tipos'
import { mensajeDeError } from '../dominio/errores'
import { formatearFecha, formatearMesAnio, formatearNumero } from '../dominio/formato'
import { lotesDeProducto, nombreDeLote, type EstadoLote, type LoteProducto } from '../dominio/lotes'
import { Icono } from '../ui/Icono'

const ETIQUETA_ESTADO: Partial<Record<EstadoLote, string>> = {
  caducado: 'Caducado',
  'caduca-pronto': 'Caduca pronto',
}

/**
 * Ficha → Lotes (sin maqueta: el lenguaje del historial de movimientos). Los lotes en uso, cada uno
 * en su línea, en el orden en que toca gastarlos, con lo que queda y «Archivar»; los archivados,
 * juntos en una sola línea que se despliega (docs/decisiones.md, «Lotes: archivar y restar de un lote»).
 */
export function SeccionLotes({
  producto,
  movimientos,
  ahora,
}: {
  producto: Producto
  movimientos: readonly Movimiento[]
  ahora: Date
}) {
  const { repo } = useServicios()
  const ajustes = useAjustes()
  const [verArchivados, setVerArchivados] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const lotes = lotesDeProducto(movimientos, ahora)
  const abiertos = lotes.filter((l) => !l.archivado)
  const archivados = lotes.filter((l) => l.archivado)

  async function cambiar(lote: LoteProducto, archivar: boolean) {
    if (!ajustes || ocupado) return
    setOcupado(true)
    const usuario = ajustes.usuario
    const hacer = (a: boolean) =>
      a ? repo.archivarLote(producto.id, lote.clave, usuario) : repo.desarchivarLote(producto.id, lote.clave)
    try {
      await hacer(archivar)
      mostrarAviso({
        texto: archivar
          ? `Lote ${nombreDeLote(lote)} archivado.`
          : `Lote ${nombreDeLote(lote)} de nuevo en uso.`,
        accion: 'Deshacer',
        alPulsarAccion: () => hacer(!archivar),
      })
    } catch (error) {
      mostrarAviso({ texto: mensajeDeError(error) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="ficha-lotes" aria-labelledby="ficha-lotes">
      <h2 id="ficha-lotes" className="seccion__titulo">
        Lotes
      </h2>
      {lotes.length === 0 ? (
        <p className="texto-secundario ficha-lotes__vacio">
          Aún no hay lotes: se apuntan al registrar una entrada (o el stock inicial) con lote o caducidad.
        </p>
      ) : (
        <ul className="ficha-lotes__lista">
          {abiertos.map((lote) => (
            <li key={lote.clave} className="lote-fila">
              <span className="lote-fila__textos">
                <NombreLote lote={lote} />
                <span className="lote-fila__detalle">{detalleAbierto(lote, producto)}</span>
              </span>
              <span className="lote-fila__estado">
                {lote.caducidad && <span>Cad. {formatearMesAnio(lote.caducidad)}</span>}
                {ETIQUETA_ESTADO[lote.estado] &&
                  (lote.estado === 'caducado' ? (
                    <span className="insignia-caducado">{ETIQUETA_ESTADO[lote.estado]}</span>
                  ) : (
                    <span className="etiqueta etiqueta--pequena lote-fila__marca">{ETIQUETA_ESTADO[lote.estado]}</span>
                  ))}
                <button
                  type="button"
                  className="enlace-boton lote-fila__accion"
                  onClick={() => void cambiar(lote, true)}
                  disabled={ocupado}
                  aria-label={`Archivar el lote ${nombreDeLote(lote)}`}
                >
                  Archivar
                </button>
              </span>
            </li>
          ))}
          {archivados.length > 0 && (
            <li className="lotes-archivados">
              <button
                type="button"
                className="lotes-archivados__cabecera"
                aria-expanded={verArchivados}
                onClick={() => setVerArchivados((v) => !v)}
              >
                <span className="lote-fila__textos">
                  <span className="lotes-archivados__titulo">
                    Archivados · {archivados.length === 1 ? '1 lote' : `${archivados.length} lotes`}
                  </span>
                  <span className="lote-fila__detalle">{resumenArchivados(archivados)}</span>
                </span>
                <span className={verArchivados ? 'lotes-archivados__flecha lotes-archivados__flecha--abierta' : 'lotes-archivados__flecha'}>
                  <Icono nombre="siguiente" tamano={16} />
                </span>
              </button>
              {verArchivados && (
                <ul className="lotes-archivados__lista">
                  {archivados.map((lote) => (
                    <li key={lote.clave} className="lote-fila lote-fila--archivado">
                      <span className="lote-fila__textos">
                        <NombreLote lote={lote} />
                        <span className="lote-fila__detalle">{detalleArchivado(lote, producto)}</span>
                      </span>
                      <span className="lote-fila__estado">
                        {lote.caducidad && <span>Cad. {formatearMesAnio(lote.caducidad)}</span>}
                        <span className="etiqueta etiqueta--pequena lote-fila__marca">
                          {lote.estado === 'desechado' ? 'Desechado' : 'Terminado'}
                        </span>
                        {lote.estado === 'agotado' && (
                          <button
                            type="button"
                            className="enlace-boton lote-fila__accion"
                            onClick={() => void cambiar(lote, false)}
                            disabled={ocupado}
                            aria-label={`Volver a poner en uso el lote ${nombreDeLote(lote)}`}
                          >
                            Desarchivar
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}
        </ul>
      )}
      {abiertos.length > 0 && (
        <p className="campo__ayuda ficha-lotes__nota">
          «Quedan» cuenta las retiradas que dicen su lote; las retiradas sin lote solo restan del stock del
          producto.
        </p>
      )}
    </section>
  )
}

function NombreLote({ lote }: { lote: LoteProducto }) {
  return lote.lote ? (
    <span className="lote-fila__lote">{lote.lote}</span>
  ) : (
    <span className="lote-fila__lote lote-fila__lote--sin">Sin código de lote</span>
  )
}

/** «Quedan 3 de 6 bot. · entró el 12/11/2026» o «… · 2 entradas, la última el 12/11/2026». */
function detalleAbierto(lote: LoteProducto, producto: Producto): string {
  const unidad = producto.unidadCorta
  const partes = [`Quedan ${formatearNumero(Math.max(0, lote.quedan))} de ${formatearNumero(lote.entrado)} ${unidad}`]
  const ultima = lote.entradas[lote.entradas.length - 1]
  if (lote.entradas.length === 1 && ultima) {
    partes.push(`${ultima.nota === 'Stock inicial' ? 'stock inicial del' : 'entró el'} ${formatearFecha(ultima.fecha)}`)
  } else if (ultima) {
    partes.push(`${lote.entradas.length} entradas, la última el ${formatearFecha(ultima.fecha)}`)
  }
  return partes.join(' · ')
}

/** «Terminado al retirar (JA, 20/11/2026) · entraron 6 bot.» */
function detalleArchivado(lote: LoteProducto, producto: Producto): string {
  const cierre = lote.cierre
  const quien = cierre ? ` (${cierre.usuario}, ${formatearFecha(cierre.fecha)})` : ''
  const como =
    lote.estado === 'desechado'
      ? `Desechado${quien}`
      : cierre?.movimientoId
        ? `Se terminó al retirar${quien}`
        : `Archivado${quien}`
  return `${como} · entraron ${formatearNumero(lote.entrado)} ${producto.unidadCorta}`
}

/** «K4920113, OLD-0921 y 2 más» */
function resumenArchivados(archivados: readonly LoteProducto[]): string {
  const nombres = archivados.map(nombreDeLote)
  const visibles = nombres.slice(0, 3).join(', ')
  return nombres.length > 3 ? `${visibles} y ${nombres.length - 3} más` : visibles
}
