import { Enlace } from '../app/Enlace'
import { useResumenStock } from '../app/hooks'
import './BarraInferior.css'
import { Icono } from './Icono'

export type PestanaPrincipal = 'stock' | 'pedir' | 'catalogo'

export function BarraInferior({ activa }: { activa: PestanaPrincipal }) {
  const aPedir = useResumenStock()?.aPedir ?? 0
  const actual = (pestana: PestanaPrincipal) => (activa === pestana ? 'page' : undefined)

  return (
    <nav className="barra-inferior" aria-label="Navegación principal">
      <Enlace ruta={{ pantalla: 'stock' }} className="barra-inferior__enlace" aria-current={actual('stock')}>
        <Icono nombre="stock" tamano={22} />
        Stock
      </Enlace>
      <Enlace ruta={{ pantalla: 'pedir' }} className="barra-inferior__enlace" aria-current={actual('pedir')}>
        <Icono nombre="pedir" tamano={22} />
        A pedir
        {aPedir > 0 && (
          <>
            <span className="barra-inferior__contador" aria-hidden="true">
              {aPedir > 99 ? '99+' : aPedir}
            </span>
            <span className="solo-lector">: {aPedir === 1 ? '1 producto' : `${aPedir} productos`}</span>
          </>
        )}
      </Enlace>
      <Enlace ruta={{ pantalla: 'retirar' }} className="barra-inferior__camara" aria-label="Retirar con foto">
        <Icono nombre="camara" tamano={28} />
      </Enlace>
      <Enlace ruta={{ pantalla: 'entrada' }} className="barra-inferior__enlace">
        <Icono nombre="mas" tamano={22} />
        Entrada
      </Enlace>
      <Enlace ruta={{ pantalla: 'catalogo' }} className="barra-inferior__enlace" aria-current={actual('catalogo')}>
        <Icono nombre="catalogo" tamano={22} />
        Catálogo
      </Enlace>
    </nav>
  )
}
