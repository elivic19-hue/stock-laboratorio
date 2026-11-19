import { useState } from 'react'
import type { Producto } from '../datos/tipos'
import { coincideBusqueda } from '../dominio/busqueda'
import { formatearNumero } from '../dominio/formato'
import { estaBajoMinimo } from '../dominio/stock'
import { ubicacionCorta } from '../dominio/ubicacion'
import { Buscador } from './Buscador'
import { Dialogo } from './Dialogo'
import './FilaProducto.css'
import './SelectorProducto.css'

/** Hoja para elegir un producto con buscador (Registrar entrada, «buscar a mano» en Retirar). */
export function SelectorProducto({
  titulo = 'Elegir producto',
  abierto,
  productos,
  elegido,
  alElegir,
  alCerrar,
}: {
  titulo?: string
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
      titulo={titulo}
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
