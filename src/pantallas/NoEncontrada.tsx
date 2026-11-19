import { Enlace } from '../app/Enlace'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { PantallaCompleta } from '../ui/Pantalla'

export function NoEncontrada() {
  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'stock' }} titulo="Página no encontrada" />
      <main className="contenido">
        <p className="texto-secundario">Esta dirección no corresponde a ninguna pantalla de la app.</p>
        <Enlace ruta={{ pantalla: 'stock' }} reemplazar className="boton boton--primario">
          Ir a Stock
        </Enlace>
      </main>
    </PantallaCompleta>
  )
}
