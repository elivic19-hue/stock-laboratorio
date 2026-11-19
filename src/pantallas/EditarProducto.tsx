import { CabeceraVolver } from '../ui/CabeceraVolver'
import { EnConstruccion } from '../ui/EnConstruccion'
import { PantallaCompleta } from '../ui/Pantalla'

/** Edición de producto (sin maqueta). */
export function EditarProducto({ id }: { id: string }) {
  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'producto', id }} titulo="Editar producto" />
      <main className="contenido">
        <EnConstruccion etapa={2}>Aquí irá el mismo formulario que en el alta, con los datos del producto.</EnConstruccion>
      </main>
    </PantallaCompleta>
  )
}
