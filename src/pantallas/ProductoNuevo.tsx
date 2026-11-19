import { useAjustes } from '../app/hooks'
import { useRepositorio } from '../app/contexto'
import { mostrarAviso } from '../app/avisos'
import { navegar } from '../app/navegacion'
import { VALORES_PRODUCTO_VACIOS } from '../dominio/formularioProducto'
import { CabeceraVolver } from '../ui/CabeceraVolver'
import { PantallaCompleta } from '../ui/Pantalla'
import { FormularioProducto } from './FormularioProducto'

/** Alta de producto (sin maqueta). Al guardar se pasa a la ficha, donde se hacen las fotos de referencia. */
export function ProductoNuevo() {
  const repo = useRepositorio()
  const ajustes = useAjustes()

  return (
    <PantallaCompleta>
      <CabeceraVolver volverA={{ pantalla: 'catalogo' }} titulo="Nuevo producto" />
      {ajustes && (
        <FormularioProducto
          valoresIniciales={VALORES_PRODUCTO_VACIOS}
          esAlta
          textoGuardar="Dar de alta"
          alGuardar={async (datos) => {
            const producto = await repo.crearProducto(datos, ajustes.usuario)
            // La etapa 3 llevará de aquí directamente a hacer las fotos de referencia.
            navegar({ pantalla: 'producto', id: producto.id }, { reemplazar: true })
            mostrarAviso({ texto: `${producto.codigo} dado de alta. Falta hacerle las fotos de referencia.` })
          }}
        />
      )}
    </PantallaCompleta>
  )
}
