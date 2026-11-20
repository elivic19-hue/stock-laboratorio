import type {
  Categoria,
  EstadoPedido,
  FotoReferencia,
  Movimiento,
  OrigenFoto,
  Pedido,
  Producto,
  TipoMovimiento,
} from './tipos'

/**
 * Único punto de acceso a los datos del laboratorio (CLAUDE.md §2).
 *
 * Las pantallas solo conocen esta interfaz. En la fase 1 la implementa LocalRepository
 * (IndexedDB en el móvil); en la fase 2 habrá otra implementación (Supabase o Firebase,
 * y después la nube de la empresa) sin tocar las pantallas.
 *
 * Reglas que cumple cualquier implementación:
 * - Cada cambio de stock es una transacción: se actualiza stockActual y se crea el Movimiento.
 * - El stock nunca queda negativo (se lanza ErrorStock con código 'stock-insuficiente').
 * - Una entrada pasa a «recibido» el pedido en curso del producto.
 * - Cerrar un lote caducado como desechado resta el stock con un ajuste, en la misma transacción.
 * - Máximo MAX_FOTOS_POR_PRODUCTO referencias por producto; al pasarse se descarta la
 *   foto de confirmación más antigua.
 */
export interface StockRepository {
  // Productos
  listarProductos(opciones?: { incluirArchivados?: boolean }): Promise<Producto[]>
  obtenerProducto(id: string): Promise<Producto | undefined>
  crearProducto(datos: DatosProductoNuevo, usuario: string): Promise<Producto>
  /** Para editar o archivar. El stock no se cambia aquí, solo con movimientos. */
  actualizarProducto(id: string, cambios: CambiosProducto): Promise<Producto>
  /**
   * Borra el producto y todo lo suyo (movimientos, fotos y pedidos). Es para deshacer un alta hecha
   * por error; lo que ya no se usa se archiva.
   */
  eliminarProducto(id: string): Promise<void>
  siguienteCodigo(categoria: Categoria): Promise<string>

  // Movimientos
  /**
   * Si es una retirada que dice su lote y lo deja a cero (o menos), el lote se archiva solo
   * (`loteArchivado`: su código o «cad. MM/AAAA»); deshacer la retirada lo vuelve a abrir.
   */
  registrarMovimiento(
    cambio: CambioStock,
  ): Promise<{ movimiento: Movimiento; producto: Producto; loteArchivado?: string }>
  /**
   * Deshace el último movimiento de un producto (el aviso «Deshacer» tras una retirada, o «Anular»
   * en la ficha). Si era el ajuste con que se desechó un lote caducado, el lote vuelve a abrirse.
   */
  deshacerMovimiento(movimientoId: string): Promise<Producto>
  /** Del más reciente al más antiguo. */
  listarMovimientos(filtro?: FiltroMovimientos): Promise<Movimiento[]>

  // Lotes caducados
  /**
   * Da por terminado el lote de una entrada con caducidad. «desechado» resta `cantidad` con un
   * ajuste «Caducado · lote …» en la misma transacción; «agotado» solo lo marca (ya no quedaba).
   */
  cerrarLote(entradaId: string, cierre: CierreLote): Promise<Movimiento>
  /** Deshace cerrarLote (y su ajuste, que tiene que ser el último movimiento del producto). */
  reabrirLote(entradaId: string): Promise<void>
  /**
   * Archiva un lote abierto del producto (`clave` de dominio/lotes): todas sus entradas quedan
   * cerradas como agotadas, sin tocar el stock.
   */
  archivarLote(productoId: string, clave: string, usuario: string): Promise<void>
  /** Vuelve a abrir las entradas de un lote archivado como agotado (las desechadas, no: se reabren anulando su ajuste). */
  desarchivarLote(productoId: string, clave: string): Promise<void>

  // Fotos de referencia
  listarFotos(productoId?: string): Promise<FotoReferencia[]>
  /** Devuelve null si era una foto de confirmación y no cabía (todas las demás son de alta). */
  guardarFoto(foto: FotoNueva): Promise<FotoReferencia | null>
  borrarFoto(id: string): Promise<void>
  /**
   * Sustituye el vector de reconocimiento de fotos ya guardadas (al recalcularlos desde sus
   * miniaturas). Las que ya no existen se saltan. Devuelve cuántas se han cambiado.
   */
  actualizarEmbeddings(cambios: readonly { id: string; embedding: number[] }[]): Promise<number>

  // Pedidos
  listarPedidos(estado?: EstadoPedido): Promise<Pedido[]>
  /** Si el producto ya tiene un pedido en curso, devuelve ese. */
  marcarPedido(productoId: string, cantidad?: number): Promise<Pedido>
  cancelarPedido(id: string): Promise<void>

  // Todos los datos (datos de ejemplo, copias de seguridad, borrado)
  contar(): Promise<Recuento>
  volcar(): Promise<VolcadoDatos>
  reemplazarTodo(datos: VolcadoDatos): Promise<void>
  borrarTodo(): Promise<void>

  /** Avisa de cualquier cambio en los datos. Devuelve la función para dejar de escuchar. */
  suscribir(alCambiar: () => void): () => void
}

export const MAX_FOTOS_POR_PRODUCTO = 20

export interface DatosProductoNuevo {
  /** Si se omite o va vacío, se asigna el siguiente de su categoría (R-001, F-001…). */
  codigo?: string
  nombre: string
  categoria: Categoria
  formato: string
  unidadCorta: string
  armario: string
  balda?: string
  stockMinimo: number
  cantidadPedidoSugerida?: number
  notas?: string
  /**
   * Stock con el que empieza. Si es mayor que 0 queda en el historial como «Stock inicial»: una
   * entrada si lleva lote o caducidad (así cuenta como un lote más) y, si no, un ajuste.
   */
  stockInicial: number
  /** Lote de ese stock inicial (opcional, solo con stockInicial > 0). */
  loteInicial?: string
  /** Caducidad de ese stock inicial, AAAA-MM-DD (opcional, solo con stockInicial > 0). */
  caducidadInicial?: string
}

export type CambiosProducto = Partial<
  Pick<
    Producto,
    | 'codigo'
    | 'nombre'
    | 'categoria'
    | 'formato'
    | 'unidadCorta'
    | 'armario'
    | 'balda'
    | 'stockMinimo'
    | 'cantidadPedidoSugerida'
    | 'notas'
    | 'archivado'
  >
>

export interface CambioStock {
  productoId: string
  tipo: TipoMovimiento
  /** Con signo: negativa en retiradas, positiva en entradas. */
  cantidad: number
  usuario: string
  lote?: string
  /** AAAA-MM-DD */
  caducidad?: string
  nota?: string
  /** Solo en retirada_foto. */
  confianza?: number
}

export interface CierreLote {
  como: 'desechado' | 'agotado'
  usuario: string
  /** Unidades desechadas (solo con «desechado», mayor que cero). */
  cantidad?: number
}

export interface FiltroMovimientos {
  productoId?: string
  tipo?: TipoMovimiento
  /** Número máximo de movimientos (los más recientes). */
  limite?: number
}

export interface FotoNueva {
  productoId: string
  embedding: number[]
  miniatura: Blob
  origen: OrigenFoto
}

export interface Recuento {
  productos: number
  movimientos: number
  fotos: number
  pedidos: number
}

/** Todos los datos del laboratorio de una vez. */
export interface VolcadoDatos {
  productos: Producto[]
  fotos: FotoReferencia[]
  movimientos: Movimiento[]
  pedidos: Pedido[]
}
