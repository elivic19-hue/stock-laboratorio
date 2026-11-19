import { useLayoutEffect } from 'react'
import { Ajustes } from '../pantallas/Ajustes'
import { APedir } from '../pantallas/APedir'
import { Bienvenida } from '../pantallas/Bienvenida'
import { Catalogo } from '../pantallas/Catalogo'
import { EditarProducto } from '../pantallas/EditarProducto'
import { Entrada } from '../pantallas/Entrada'
import { FichaProducto } from '../pantallas/FichaProducto'
import { NoEncontrada } from '../pantallas/NoEncontrada'
import { ProductoNuevo } from '../pantallas/ProductoNuevo'
import { Retirar } from '../pantallas/Retirar'
import { Stock } from '../pantallas/Stock'
import { AvisoActualizacion } from './AvisoActualizacion'
import { AvisoGlobal } from './AvisoGlobal'
import { useAviso } from './avisos'
import { useAjustes } from './hooks'
import { colocarScroll, useRuta } from './navegacion'
import type { Ruta } from './rutas'

export function App() {
  const ajustes = useAjustes()
  const ruta = useRuta()
  const hayAviso = useAviso() !== null

  useLayoutEffect(() => {
    colocarScroll()
  }, [ruta])

  let contenido
  if (!ajustes) contenido = <div className="pantalla" aria-busy="true" />
  else if (!ajustes.usuario) contenido = <Bienvenida />
  else contenido = <Pantalla ruta={ruta} />

  return (
    <>
      {contenido}
      <AvisoGlobal />
      {/* El aviso de versión nueva espera a que no haya otro aviso a la vista. */}
      <AvisoActualizacion oculto={hayAviso} />
    </>
  )
}

function Pantalla({ ruta }: { ruta: Ruta }) {
  switch (ruta.pantalla) {
    case 'stock':
      return <Stock />
    case 'pedir':
      return <APedir />
    case 'retirar':
      return <Retirar />
    case 'entrada':
      return <Entrada productoId={ruta.productoId} />
    case 'catalogo':
      return <Catalogo />
    case 'producto-nuevo':
      return <ProductoNuevo />
    case 'producto':
      return <FichaProducto id={ruta.id} />
    case 'producto-editar':
      return <EditarProducto id={ruta.id} />
    case 'ajustes':
      return <Ajustes />
    case 'no-encontrada':
      return <NoEncontrada />
  }
}
