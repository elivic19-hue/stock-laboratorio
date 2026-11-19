import { Enlace } from '../app/Enlace'
import { useAjustes, useResumenStock } from '../app/hooks'
import { formatearNumero } from '../dominio/formato'
import type { ResumenStock } from '../dominio/resumen'
import { EnConstruccion } from '../ui/EnConstruccion'
import { Icono } from '../ui/Icono'
import { PantallaConBarra } from '../ui/Pantalla'
import './Stock.css'

/** Pantalla de inicio (maqueta Main). En la etapa 1: cabecera y bloque resumen. */
export function Stock() {
  const ajustes = useAjustes()
  const resumen = useResumenStock()

  return (
    <PantallaConBarra activa="stock" colorBarraEstado="#FFFFFF">
      <header className="stock-cabecera">
        <div className="stock-cabecera__fila">
          <div className="stock-cabecera__titulos">
            <span className="stock-cabecera__laboratorio">{ajustes?.laboratorio}</span>
            <div className="stock-cabecera__linea">
              <h1 className="stock-cabecera__titulo">Stock</h1>
              {/* Fase 1: los datos solo están en este móvil. En la fase 2, la hora de sincronización. */}
              <span className="estado-guardado">
                <span className="estado-guardado__punto" aria-hidden="true" />
                Guardado en este móvil
              </span>
            </div>
          </div>
          <Enlace ruta={{ pantalla: 'ajustes' }} className="boton-perfil" aria-label="Perfil y ajustes">
            <Icono nombre="perfil" />
          </Enlace>
        </div>
        <BloqueResumen resumen={resumen} />
      </header>

      <main className="stock-contenido">
        <EnConstruccion etapa={2}>
          Aquí irán el buscador, los filtros Todos / Reactivos / Fungible y la lista de productos agrupada por
          armario.
        </EnConstruccion>
      </main>
    </PantallaConBarra>
  )
}

function BloqueResumen({ resumen }: { resumen: ResumenStock | undefined }) {
  const valor = (n: number | undefined) => (n === undefined ? '–' : formatearNumero(n))
  const hayQuePedir = (resumen?.aPedir ?? 0) > 0

  return (
    <div className="resumen" role="group" aria-label="Resumen del stock">
      <div className="resumen__celda">
        <span className="resumen__etiqueta">Productos</span>
        <span className="resumen__valor">{valor(resumen?.productos)}</span>
      </div>
      <Enlace
        ruta={{ pantalla: 'pedir' }}
        className={hayQuePedir ? 'resumen__celda resumen__celda--alerta' : 'resumen__celda'}
      >
        <span className="resumen__etiqueta">Bajo mínimo</span>
        <span className="resumen__valor">
          {valor(resumen?.aPedir)}
          <Icono nombre="siguiente" tamano={14} />
        </span>
      </Enlace>
      <div className="resumen__celda">
        <span className="resumen__etiqueta">Caducan &lt;30 d</span>
        <span className="resumen__valor">{valor(resumen?.caducanPronto)}</span>
      </div>
    </div>
  )
}
