import Dexie, { type EntityTable } from 'dexie'
import type { AjustesDispositivo } from './ajustes'
import type { FotoReferencia, Movimiento, Pedido, Producto } from './tipos'

export const NOMBRE_BASE_DATOS = 'stock-laboratorio'

export interface RegistroAjustes {
  clave: string
  valor: Partial<AjustesDispositivo>
}

/**
 * Base de datos IndexedDB del móvil (Dexie). Solo la usan LocalRepository y AlmacenAjustesLocal;
 * las pantallas nunca acceden a ella directamente.
 *
 * Nota: los booleanos no son claves válidas en IndexedDB, por eso «archivado» no tiene índice.
 */
export class BaseDatosStock extends Dexie {
  declare productos: EntityTable<Producto, 'id'>
  declare fotos: EntityTable<FotoReferencia, 'id'>
  declare movimientos: EntityTable<Movimiento, 'id'>
  declare pedidos: EntityTable<Pedido, 'id'>
  declare ajustes: EntityTable<RegistroAjustes, 'clave'>

  constructor(nombre: string = NOMBRE_BASE_DATOS) {
    super(nombre)
    this.version(1).stores({
      productos: 'id, codigo, categoria, armario',
      fotos: 'id, productoId, [productoId+creadoEn]',
      movimientos: 'id, productoId, tipo, fecha, [productoId+fecha]',
      pedidos: 'id, productoId, estado, [productoId+estado]',
      ajustes: 'clave',
    })
  }
}
