import { describe, expect, it } from 'vitest'
import { hashDeRuta, leerRuta, type Ruta } from './rutas'

describe('rutas', () => {
  it('la dirección vacía es Stock', () => {
    expect(leerRuta('')).toEqual({ pantalla: 'stock' })
    expect(leerRuta('#')).toEqual({ pantalla: 'stock' })
    expect(leerRuta('#/')).toEqual({ pantalla: 'stock' })
  })

  it('ida y vuelta de todas las rutas', () => {
    const rutas: Ruta[] = [
      { pantalla: 'stock' },
      { pantalla: 'pedir' },
      { pantalla: 'retirar' },
      { pantalla: 'entrada' },
      { pantalla: 'entrada', productoId: '4f1c2d3e-0000-4000-8000-000000000001' },
      { pantalla: 'catalogo' },
      { pantalla: 'producto-nuevo' },
      { pantalla: 'producto', id: '4f1c2d3e-0000-4000-8000-000000000001' },
      { pantalla: 'producto-editar', id: '4f1c2d3e-0000-4000-8000-000000000001' },
      { pantalla: 'ajustes' },
      { pantalla: 'no-encontrada' },
    ]
    for (const ruta of rutas) expect(leerRuta(hashDeRuta(ruta))).toEqual(ruta)
  })

  it('las direcciones desconocidas o mal formadas no rompen la app', () => {
    expect(leerRuta('#/inventario')).toEqual({ pantalla: 'no-encontrada' })
    expect(leerRuta('#/pedir/extra')).toEqual({ pantalla: 'no-encontrada' })
    expect(leerRuta('#/producto')).toEqual({ pantalla: 'no-encontrada' })
    expect(leerRuta('#/producto/abc/borrar')).toEqual({ pantalla: 'no-encontrada' })
    expect(leerRuta('#/producto/%E0%A4%A')).toEqual({ pantalla: 'no-encontrada' })
  })
})
