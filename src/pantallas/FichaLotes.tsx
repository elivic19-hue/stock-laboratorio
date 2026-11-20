import { useState } from 'react'
import type { Movimiento, Producto } from '../datos/tipos'
import { formatearCantidadConSigno, formatearFecha, formatearMesAnio } from '../dominio/formato'
import { historialLotes, type EstadoLote, type LoteDelHistorial } from '../dominio/lotes'

const LOTES_INICIALES = 10

const ETIQUETA_ESTADO: Partial<Record<EstadoLote, string>> = {
  caducado: 'Caducado',
  'caduca-pronto': 'Caduca pronto',
  desechado: 'Desechado',
  agotado: 'Agotado',
}

/**
 * Ficha → Lotes (sin maqueta: el lenguaje del historial de movimientos). Cada lote que ha entrado,
 * del más reciente al más antiguo, con su caducidad y lo que se sabe de él.
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
  const [verTodos, setVerTodos] = useState(false)
  const lotes = historialLotes(movimientos, ahora)
  const visibles = verTodos ? lotes : lotes.slice(0, LOTES_INICIALES)

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
          {visibles.map((lote) => (
            <FilaLote key={lote.entrada.id} lote={lote} producto={producto} />
          ))}
        </ul>
      )}
      {!verTodos && lotes.length > LOTES_INICIALES && (
        <button type="button" className="boton ficha-movimientos__mas" onClick={() => setVerTodos(true)}>
          Ver los {lotes.length} lotes
        </button>
      )}
    </section>
  )
}

function FilaLote({ lote, producto }: { lote: LoteDelHistorial; producto: Producto }) {
  const { entrada, estado } = lote
  const detalle = [
    `${entrada.nota === 'Stock inicial' ? 'Stock inicial' : 'Entrada'} ${formatearFecha(entrada.fecha)}`,
    `${formatearCantidadConSigno(entrada.cantidad)} ${producto.unidadCorta}`,
    entrada.usuario,
  ]
  if (entrada.nota && entrada.nota !== 'Stock inicial') detalle.push(entrada.nota)
  if (entrada.loteCerrado) {
    const { como, usuario, fecha } = entrada.loteCerrado
    detalle.push(`${como === 'desechado' ? 'desechado' : 'ya no quedaba'} (${usuario}, ${formatearFecha(fecha)})`)
  }
  const etiqueta = ETIQUETA_ESTADO[estado]

  return (
    <li className="lote-fila">
      <span className="lote-fila__textos">
        {entrada.lote ? (
          <span className="lote-fila__lote">{entrada.lote}</span>
        ) : (
          <span className="lote-fila__lote lote-fila__lote--sin">Sin lote</span>
        )}
        <span className="lote-fila__detalle">{detalle.join(' · ')}</span>
      </span>
      <span className="lote-fila__estado">
        {entrada.caducidad && <span>Cad. {formatearMesAnio(entrada.caducidad)}</span>}
        {etiqueta &&
          (estado === 'caducado' ? (
            <span className="insignia-caducado">{etiqueta}</span>
          ) : (
            <span className="etiqueta etiqueta--pequena lote-fila__marca">{etiqueta}</span>
          ))}
      </span>
    </li>
  )
}
