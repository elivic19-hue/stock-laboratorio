import { Enlace } from '../app/Enlace'
import { useConsulta } from '../app/hooks'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { EnConstruccion } from '../ui/EnConstruccion'
import { PantallaCompleta } from '../ui/Pantalla'
import './FichaProducto.css'

/** Maqueta Producto. En la etapa 1: carga el producto por su ruta y muestra su título. */
export function FichaProducto({ id }: { id: string }) {
  const { datos: producto, cargando } = useConsulta((repo) => repo.obtenerProducto(id), [id])

  return (
    <PantallaCompleta>
      <CabeceraVolver
        volverA={{ pantalla: 'stock' }}
        accion={
          producto && (
            <Enlace ruta={{ pantalla: 'producto-editar', id }} className="boton">
              Editar
            </Enlace>
          )
        }
      />
      <main className="contenido">
        {!cargando && !producto && (
          <p className="texto-secundario">No se encuentra este producto. Puede que se haya borrado.</p>
        )}
        {producto && (
          <div className="ficha-producto__titulo">
            <div className="ficha-producto__insignias">
              <span className="insignia-categoria">{producto.categoria === 'reactivo' ? 'Reactivo' : 'Fungible'}</span>
              <span className="etiqueta">{producto.codigo}</span>
            </div>
            <h1 className="ficha-producto__nombre">{producto.nombre}</h1>
          </div>
        )}
        <EnConstruccion etapa={2}>
          Aquí irán el stock, «avisar con ≤», la unidad y la ubicación, las fotos de reconocimiento, el historial
          de movimientos, el ajuste manual de stock y archivar.
        </EnConstruccion>
      </main>
    </PantallaCompleta>
  )
}
