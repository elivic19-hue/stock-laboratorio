/**
 * Rutas de la app. Van en el «hash» de la dirección (#/pedir, #/producto/<id>…): así la app
 * funciona sin conexión y en cualquier alojamiento (GitHub Pages, Netlify) sin configurar nada.
 */
export type Ruta =
  | { pantalla: 'stock' }
  | { pantalla: 'pedir' }
  | { pantalla: 'retirar' }
  | { pantalla: 'entrada'; productoId?: string }
  | { pantalla: 'catalogo' }
  | { pantalla: 'caducidades' }
  | { pantalla: 'producto-nuevo' }
  | { pantalla: 'producto'; id: string }
  | { pantalla: 'producto-editar'; id: string }
  | { pantalla: 'ajustes' }
  | { pantalla: 'no-encontrada' }

const NO_ENCONTRADA: Ruta = { pantalla: 'no-encontrada' }

export function leerRuta(hash: string): Ruta {
  const sinAlmohadilla = hash.startsWith('#') ? hash.slice(1) : hash
  const [camino = '', consulta = ''] = sinAlmohadilla.split('?', 2)

  let partes: string[]
  try {
    partes = camino.split('/').filter(Boolean).map((parte) => decodeURIComponent(parte))
  } catch {
    return NO_ENCONTRADA
  }
  const [primera, segunda, tercera, ...resto] = partes
  if (resto.length > 0) return NO_ENCONTRADA
  const sinMas = segunda === undefined

  switch (primera) {
    case undefined:
      return { pantalla: 'stock' }
    case 'pedir':
      return sinMas ? { pantalla: 'pedir' } : NO_ENCONTRADA
    case 'retirar':
      return sinMas ? { pantalla: 'retirar' } : NO_ENCONTRADA
    case 'entrada': {
      if (!sinMas) return NO_ENCONTRADA
      const productoId = new URLSearchParams(consulta).get('producto')
      return productoId ? { pantalla: 'entrada', productoId } : { pantalla: 'entrada' }
    }
    case 'catalogo':
      return sinMas ? { pantalla: 'catalogo' } : NO_ENCONTRADA
    case 'caducidades':
      return sinMas ? { pantalla: 'caducidades' } : NO_ENCONTRADA
    case 'ajustes':
      return sinMas ? { pantalla: 'ajustes' } : NO_ENCONTRADA
    case 'producto':
      if (segunda === undefined) return NO_ENCONTRADA
      if (segunda === 'nuevo') return tercera === undefined ? { pantalla: 'producto-nuevo' } : NO_ENCONTRADA
      if (tercera === undefined) return { pantalla: 'producto', id: segunda }
      return tercera === 'editar' ? { pantalla: 'producto-editar', id: segunda } : NO_ENCONTRADA
    default:
      return NO_ENCONTRADA
  }
}

export function hashDeRuta(ruta: Ruta): string {
  switch (ruta.pantalla) {
    case 'stock':
      return '#/'
    case 'pedir':
      return '#/pedir'
    case 'retirar':
      return '#/retirar'
    case 'entrada':
      return ruta.productoId ? `#/entrada?producto=${encodeURIComponent(ruta.productoId)}` : '#/entrada'
    case 'catalogo':
      return '#/catalogo'
    case 'caducidades':
      return '#/caducidades'
    case 'producto-nuevo':
      return '#/producto/nuevo'
    case 'producto':
      return `#/producto/${encodeURIComponent(ruta.id)}`
    case 'producto-editar':
      return `#/producto/${encodeURIComponent(ruta.id)}/editar`
    case 'ajustes':
      return '#/ajustes'
    case 'no-encontrada':
      return '#/no-encontrada'
  }
}
