import type { Producto } from '../datos/tipos'
import { formatearNumero } from '../dominio/formato'
import { estaBajoMinimo } from '../dominio/stock'

/**
 * «STOCK 1 → 7 bot.» (maquetas Entrada y Retirar). El valor de antes va en naranja si está bajo
 * mínimo; el texto de la pantalla explica siempre qué significa.
 */
export function CambioStock({
  producto,
  despues,
}: {
  producto: Pick<Producto, 'stockActual' | 'stockMinimo' | 'unidadCorta'>
  /** undefined mientras la cantidad escrita no es válida. */
  despues: number | undefined
}) {
  const antes = formatearNumero(producto.stockActual)
  const resultado = despues === undefined ? '–' : formatearNumero(despues)
  return (
    <p className="cambio-stock" aria-live="polite">
      <span className="solo-lector">
        Stock: de {antes} a {resultado} {producto.unidadCorta}
      </span>
      <span className="cambio-stock__etiqueta" aria-hidden="true">
        Stock
      </span>
      <span
        className={estaBajoMinimo(producto) ? 'cambio-stock__antes cambio-stock__antes--bajo' : 'cambio-stock__antes'}
        aria-hidden="true"
      >
        {antes}
      </span>
      <svg aria-hidden="true" width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0 5h14M10 1l4 4-4 4" />
      </svg>
      <span className="cambio-stock__despues" aria-hidden="true">
        {resultado}
      </span>
      <span className="cambio-stock__unidad" aria-hidden="true">
        {producto.unidadCorta}
      </span>
    </p>
  )
}
