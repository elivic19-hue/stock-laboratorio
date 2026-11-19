import { Enlace } from '../app/Enlace'
import { useResumenStock } from '../app/hooks'
import { EnConstruccion } from '../ui/EnConstruccion'
import { Icono } from '../ui/Icono'
import { PantallaConBarra } from '../ui/Pantalla'

/** Catálogo (sin maqueta). En la etapa 1: cabecera y acceso al alta. */
export function Catalogo() {
  const productos = useResumenStock()?.productos

  return (
    <PantallaConBarra activa="catalogo">
      <header className="cabecera-lista">
        <div className="cabecera-lista__titulos">
          <span className="etiqueta cabecera-lista__contador">
            {productos === undefined ? ' ' : productos === 1 ? '1 producto' : `${productos} productos`}
          </span>
          <h1 className="cabecera-lista__titulo">Catálogo</h1>
        </div>
        <Enlace ruta={{ pantalla: 'producto-nuevo' }} className="boton boton--compacto">
          <Icono nombre="mas" tamano={16} />
          Nuevo producto
        </Enlace>
      </header>

      <main className="contenido">
        <EnConstruccion etapa={2}>
          Aquí irán la lista de todos los productos (también los archivados) y el alta, que termina pasando a
          las fotos de referencia.
        </EnConstruccion>
      </main>
    </PantallaConBarra>
  )
}
