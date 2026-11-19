import type { ReactNode } from 'react'
import { Enlace } from '../app/Enlace'
import type { Producto } from '../datos/tipos'
import { formatearNumero } from '../dominio/formato'
import { estaBajoMinimo } from '../dominio/stock'
import './FilaProducto.css'

/** Fila de producto de las listas (maqueta Main): código, nombre, línea secundaria y, a la derecha, datos. */
export function FilaProducto({
  producto,
  linea,
  children,
}: {
  producto: Producto
  linea: string
  children?: ReactNode
}) {
  return (
    <Enlace ruta={{ pantalla: 'producto', id: producto.id }} className="fila-producto">
      <span className="codigo-producto">{producto.codigo}</span>
      <span className="fila-producto__textos">
        <span className="fila-producto__nombre">{producto.nombre}</span>
        <span className="fila-producto__linea">{linea}</span>
      </span>
      {children && <span className="fila-producto__derecha">{children}</span>}
    </Enlace>
  )
}

/** Cantidad en mono con su unidad y el estado: «BAJO MÍN. 3» en naranja o «MÍN. 3» en gris. */
export function CantidadYEstado({ producto }: { producto: Producto }) {
  const bajo = estaBajoMinimo(producto)
  const minimo = formatearNumero(producto.stockMinimo)
  return (
    <>
      <span className={bajo ? 'cantidad-fila cantidad-fila--bajo' : 'cantidad-fila'}>
        {formatearNumero(producto.stockActual)} <span className="cantidad-fila__unidad">{producto.unidadCorta}</span>
      </span>
      {bajo ? (
        <span className="insignia-bajo-minimo">Bajo mín. {minimo}</span>
      ) : (
        <span className="etiqueta etiqueta--pequena">Mín. {minimo}</span>
      )}
    </>
  )
}
