import { CabeceraVolver } from '../ui/CabeceraVolver'
import { EnConstruccion } from '../ui/EnConstruccion'
import { PantallaCompleta } from '../ui/Pantalla'

/** Maqueta Entrada. En la etapa 1: estructura de la pantalla. */
export function Entrada() {
  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'stock' }} titulo="Registrar entrada" />
      <main className="contenido">
        <EnConstruccion etapa={2}>
          Aquí irán el selector de producto con buscador, las unidades recibidas con −/+, «Stock X → Y», lote,
          caducidad y nota.
        </EnConstruccion>
      </main>
      <div className="barra-accion">
        <button type="button" className="boton boton--primario boton--grande boton--ancho" disabled>
          Guardar entrada
        </button>
      </div>
    </PantallaCompleta>
  )
}
