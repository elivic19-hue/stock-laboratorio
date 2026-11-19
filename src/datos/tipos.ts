/**
 * Modelo de datos (CLAUDE.md §4).
 *
 * - Todos los identificadores son UUID (no autoincrementales) para poder fusionar datos en la fase 2.
 * - Las fechas son cadenas ISO 8601; la caducidad es una fecha sin hora (AAAA-MM-DD).
 */

export type Categoria = 'reactivo' | 'fungible'

export interface Producto {
  id: string
  /** Automático: R-001… para reactivos, F-001… para fungible. Editable. */
  codigo: string
  /** «Puntas de pipeta 1000 µL» */
  nombre: string
  categoria: Categoria
  /** «Rack 96 uds», «Botella 1 L», «Bolsa 100 uds» */
  formato: string
  /** «racks», «bot.», «uds», «bid.» */
  unidadCorta: string
  /** «Armario 2», «Armario inflamables» */
  armario: string
  /** «Balda 3» */
  balda?: string
  stockActual: number
  /** Se avisa cuando stockActual <= stockMinimo. */
  stockMinimo: number
  cantidadPedidoSugerida?: number
  notas?: string
  archivado: boolean
  creadoEn: string
  actualizadoEn: string
}

export type OrigenFoto = 'alta' | 'confirmacion'

export interface FotoReferencia {
  id: string
  productoId: string
  /** Vector de MobileNet normalizado (L2). */
  embedding: number[]
  /** JPEG de unos 160 px para la galería. */
  miniatura: Blob
  /** Hecha a propósito («alta») o guardada al confirmar una retirada («confirmacion»). */
  origen: OrigenFoto
  creadoEn: string
}

/**
 * Lote caducado que alguien ha dado por terminado (docs/decisiones.md, duda 7b): desechado (se resta
 * con un ajuste) o que ya no quedaba en el armario. Solo en entradas con caducidad.
 */
export interface LoteCerrado {
  como: 'desechado' | 'agotado'
  usuario: string
  fecha: string
  /** Ajuste con el que se restó lo desechado (para poder deshacerlo). */
  ajusteId?: string
}

export type TipoMovimiento = 'retirada_foto' | 'retirada_manual' | 'entrada' | 'ajuste'

export interface Movimiento {
  id: string
  productoId: string
  tipo: TipoMovimiento
  /** Negativa en retiradas, positiva en entradas; en ajustes, con el signo que corresponda. */
  cantidad: number
  stockResultante: number
  lote?: string
  /** AAAA-MM-DD */
  caducidad?: string
  nota?: string
  /** Solo en retirada_foto (de 0 a 1). */
  confianza?: number
  /** Nombre o iniciales de quien hizo el movimiento. */
  usuario: string
  fecha: string
  /** Solo en entradas: el lote se ha dado por terminado. */
  loteCerrado?: LoteCerrado
}

export type EstadoPedido = 'pedido' | 'recibido'

export interface Pedido {
  id: string
  productoId: string
  cantidad?: number
  estado: EstadoPedido
  fechaPedido: string
  fechaRecepcion?: string
}
