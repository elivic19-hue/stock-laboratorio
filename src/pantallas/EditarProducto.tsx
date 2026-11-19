import { useRepositorio } from '../app/contexto'
import { mostrarAviso } from '../app/avisos'
import { useConsulta } from '../app/hooks'
import { volver } from '../app/navegacion'
import { valoresDeProducto } from '../dominio/formularioProducto'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { PantallaCompleta } from '../ui/Pantalla'
import { FormularioProducto } from './FormularioProducto'

/** Edición de producto (sin maqueta): el mismo formulario del alta, sin el stock (que se cambia con un ajuste). */
export function EditarProducto({ id }: { id: string }) {
  const repo = useRepositorio()
  // El formulario toma los valores al abrirse: si el producto cambia mientras se edita, no se pisa lo escrito.
  const { datos: producto, cargando } = useConsulta((r) => r.obtenerProducto(id), [id])
  const ficha = { pantalla: 'producto', id } as const

  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={ficha} titulo="Editar producto" />
      {!cargando && !producto && (
        <main className="contenido">
          <p className="texto-secundario">No se encuentra este producto. Puede que se haya borrado.</p>
        </main>
      )}
      {producto && (
        <FormularioProducto
          key={producto.id}
          valoresIniciales={valoresDeProducto(producto)}
          esAlta={false}
          textoGuardar="Guardar cambios"
          alGuardar={async (datos) => {
            // El stock no se toca aquí. Los opcionales que se dejen en blanco se borran.
            await repo.actualizarProducto(id, {
              codigo: datos.codigo,
              nombre: datos.nombre,
              categoria: datos.categoria,
              formato: datos.formato,
              unidadCorta: datos.unidadCorta,
              armario: datos.armario,
              balda: datos.balda ?? '',
              stockMinimo: datos.stockMinimo,
              cantidadPedidoSugerida: datos.cantidadPedidoSugerida,
              notas: datos.notas ?? '',
            })
            volver(ficha)
            mostrarAviso({ texto: 'Cambios guardados.' })
          }}
        />
      )}
    </PantallaCompleta>
  )
}
