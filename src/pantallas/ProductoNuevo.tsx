import { CabeceraVolver } from '../ui/CabeceraVolver'
import { EnConstruccion } from '../ui/EnConstruccion'
import { PantallaCompleta } from '../ui/Pantalla'

/** Alta de producto (sin maqueta). */
export function ProductoNuevo() {
  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'catalogo' }} titulo="Nuevo producto" />
      <main className="contenido">
        <EnConstruccion etapa={2}>
          Aquí irá el formulario de alta: nombre, categoría, formato, unidad, armario, balda, mínimo, cantidad
          sugerida y stock inicial. Al terminar se pasa a las fotos de referencia.
        </EnConstruccion>
      </main>
    </PantallaCompleta>
  )
}
