import { useResumenStock } from '../app/hooks'
import { EnConstruccion } from '../ui/EnConstruccion'
import { Icono } from '../ui/Icono'
import { PantallaConBarra } from '../ui/Pantalla'

/** Maqueta Pedir. En la etapa 1: cabecera con el contador real. */
export function APedir() {
  const aPedir = useResumenStock()?.aPedir

  return (
    <PantallaConBarra activa="pedir">
      <header className="cabecera-lista">
        <div className="cabecera-lista__titulos">
          <span
            className={
              aPedir
                ? 'etiqueta cabecera-lista__contador cabecera-lista__contador--alerta'
                : 'etiqueta cabecera-lista__contador'
            }
          >
            {aPedir === undefined ? ' ' : `${aPedir} bajo mínimo`}
          </span>
          <h1 className="cabecera-lista__titulo">A pedir</h1>
        </div>
        <button type="button" className="boton boton--compacto" disabled>
          <Icono nombre="compartir" tamano={16} />
          Compartir lista
        </button>
      </header>

      <main className="contenido">
        <EnConstruccion etapa={4}>
          Aquí irán los productos en su mínimo o por debajo (quedan / mínimo / sugerido) con «Marcar pedido», la
          sección «Pedidos en curso» y el botón «Compartir lista».
        </EnConstruccion>
      </main>
    </PantallaConBarra>
  )
}
