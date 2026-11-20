import Dexie from 'dexie'
import { normalizarCodigo, siguienteCodigo as calcularSiguienteCodigo } from '../dominio/codigos'
import { ErrorStock } from '../dominio/errores'
import { aplicarCambiosProducto, limpiarDatosProducto } from '../dominio/producto'
import { formatearMesAnio } from '../dominio/formato'
import { claveLote, lotesDeProducto, nombreDeLote, normalizarLote, type LoteProducto } from '../dominio/lotes'
import { calcularStockResultante, validarCantidad } from '../dominio/stock'
import type { BaseDatosStock } from './db'
import {
  MAX_FOTOS_POR_PRODUCTO,
  type CambioStock,
  type CierreLote,
  type CambiosProducto,
  type DatosProductoNuevo,
  type FiltroMovimientos,
  type FotoNueva,
  type Recuento,
  type StockRepository,
  type VolcadoDatos,
} from './StockRepository'
import type { Categoria, EstadoPedido, FotoReferencia, LoteCerrado, Movimiento, Pedido, Producto } from './tipos'
import { sinIndefinidos, textoOpcional } from './utilidades'
import { nuevoId } from './uuid'

const ordenNombres = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })
const FECHA_SIN_HORA = /^\d{4}-\d{2}-\d{2}$/

export interface OpcionesLocalRepository {
  /** Reloj inyectable (para los tests). */
  reloj?: () => Date
}

/** StockRepository de la fase 1: los datos viven en IndexedDB, solo en este móvil. */
export class LocalRepository implements StockRepository {
  readonly #db: BaseDatosStock
  readonly #reloj: () => Date
  readonly #oyentes = new Set<() => void>()
  readonly #canal: BroadcastChannel | undefined
  #avisoPendiente = false

  constructor(db: BaseDatosStock, opciones: OpcionesLocalRepository = {}) {
    this.#db = db
    this.#reloj = opciones.reloj ?? (() => new Date())
    // Si la app está abierta en varias pestañas, se avisan entre ellas de los cambios.
    this.#canal =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel(`${db.name}:cambios`) : undefined
    this.#canal?.addEventListener('message', () => this.#notificar())
  }

  /** Deja de escuchar a otras pestañas. La base de datos la cierra quien la creó. */
  cerrar(): void {
    this.#canal?.close()
  }

  // ─── Productos ────────────────────────────────────────────────────────────

  async listarProductos({ incluirArchivados = false }: { incluirArchivados?: boolean } = {}): Promise<Producto[]> {
    const productos = await this.#db.productos.toArray()
    return productos
      .filter((p) => incluirArchivados || !p.archivado)
      .sort((a, b) => ordenNombres.compare(a.nombre, b.nombre))
  }

  obtenerProducto(id: string): Promise<Producto | undefined> {
    return this.#db.productos.get(id)
  }

  async siguienteCodigo(categoria: Categoria): Promise<string> {
    return calcularSiguienteCodigo(categoria, await this.#codigos())
  }

  async crearProducto(datos: DatosProductoNuevo, usuario: string): Promise<Producto> {
    const limpios = limpiarDatosProducto(datos)
    const quien = exigirUsuario(usuario)
    const ahora = this.#ahora()
    const db = this.#db

    const producto = await db.transaction('rw', db.productos, db.movimientos, async () => {
      const codigos = await this.#codigos()
      const codigo = limpios.codigo ?? calcularSiguienteCodigo(limpios.categoria, codigos)
      if (codigos.some((c) => normalizarCodigo(c) === codigo)) {
        throw new ErrorStock('codigo-duplicado', `Ya hay otro producto con el código ${codigo}.`)
      }
      const nuevo = sinIndefinidos<Producto>({
        id: nuevoId(),
        codigo,
        nombre: limpios.nombre,
        categoria: limpios.categoria,
        formato: limpios.formato,
        unidadCorta: limpios.unidadCorta,
        armario: limpios.armario,
        balda: limpios.balda,
        stockActual: limpios.stockInicial,
        stockMinimo: limpios.stockMinimo,
        cantidadPedidoSugerida: limpios.cantidadPedidoSugerida,
        notas: limpios.notas,
        archivado: false,
        creadoEn: ahora,
        actualizadoEn: ahora,
      })
      await db.productos.add(nuevo)
      if (limpios.stockInicial > 0) {
        // Con lote o caducidad es una entrada (cuenta en Caducidades y en el historial de lotes).
        const conLote = limpios.loteInicial !== undefined || limpios.caducidadInicial !== undefined
        await db.movimientos.add({
          id: nuevoId(),
          productoId: nuevo.id,
          tipo: conLote ? 'entrada' : 'ajuste',
          cantidad: limpios.stockInicial,
          stockResultante: limpios.stockInicial,
          ...(limpios.loteInicial ? { lote: limpios.loteInicial } : {}),
          ...(limpios.caducidadInicial ? { caducidad: limpios.caducidadInicial } : {}),
          nota: 'Stock inicial',
          usuario: quien,
          fecha: ahora,
        })
      }
      return nuevo
    })

    this.#avisar()
    return producto
  }

  async actualizarProducto(id: string, cambios: CambiosProducto): Promise<Producto> {
    const ahora = this.#ahora()
    const db = this.#db

    const actualizado = await db.transaction('rw', db.productos, async () => {
      const actual = await db.productos.get(id)
      if (!actual) throw productoNoEncontrado()
      const siguiente = aplicarCambiosProducto(actual, cambios, ahora)
      if (siguiente.codigo !== actual.codigo) {
        const repetido = await db.productos
          .where('codigo')
          .equalsIgnoreCase(siguiente.codigo)
          .filter((p) => p.id !== id)
          .first()
        if (repetido) {
          throw new ErrorStock('codigo-duplicado', `Ya hay otro producto con el código ${siguiente.codigo}.`)
        }
      }
      await db.productos.put(siguiente)
      return siguiente
    })

    this.#avisar()
    return actualizado
  }

  async eliminarProducto(id: string): Promise<void> {
    const db = this.#db
    await db.transaction('rw', db.productos, db.movimientos, db.fotos, db.pedidos, async () => {
      if (!(await db.productos.get(id))) throw productoNoEncontrado()
      await db.movimientos.where('productoId').equals(id).delete()
      await db.fotos.where('productoId').equals(id).delete()
      await db.pedidos.where('productoId').equals(id).delete()
      await db.productos.delete(id)
    })
    this.#avisar()
  }

  // ─── Movimientos ──────────────────────────────────────────────────────────

  async registrarMovimiento(
    cambio: CambioStock,
  ): Promise<{ movimiento: Movimiento; producto: Producto; loteArchivado?: string }> {
    const revisado = revisarCambio(cambio)
    const db = this.#db
    const resultado = await db.transaction('rw', db.productos, db.movimientos, db.pedidos, () =>
      this.#aplicarMovimiento(revisado),
    )
    this.#avisar()
    return resultado
  }

  /** Aplica un cambio ya revisado. Se llama dentro de una transacción con productos, movimientos y pedidos. */
  async #aplicarMovimiento(
    cambio: CambioRevisado,
  ): Promise<{ movimiento: Movimiento; producto: Producto; loteArchivado?: string }> {
    const db = this.#db
    const { usuario, caducidad, confianza } = cambio
    const producto = await db.productos.get(cambio.productoId)
    if (!producto) throw productoNoEncontrado()
    const stockResultante = calcularStockResultante(producto, cambio.cantidad)
    const fecha = await this.#fechaParaMovimiento(producto.id)
    const movimiento = sinIndefinidos<Movimiento>({
      id: nuevoId(),
      productoId: producto.id,
      tipo: cambio.tipo,
      cantidad: cambio.cantidad,
      stockResultante,
      lote: textoOpcional(cambio.lote),
      caducidad,
      nota: textoOpcional(cambio.nota),
      confianza,
      usuario,
      fecha,
    })
    const actualizado: Producto = { ...producto, stockActual: stockResultante, actualizadoEn: fecha }
    await db.productos.put(actualizado)
    await db.movimientos.add(movimiento)
    if (cambio.tipo === 'entrada') {
      // El pedido en curso pasa a recibido, con la fecha de esta entrada (así se puede deshacer).
      await db.pedidos
        .where('[productoId+estado]')
        .equals([producto.id, 'pedido'])
        .modify({ estado: 'recibido', fechaRecepcion: fecha })
    }
    const loteArchivado = await this.#archivarSiSeTermina(movimiento)
    return { movimiento, producto: actualizado, ...(loteArchivado ? { loteArchivado } : {}) }
  }

  /**
   * Si una retirada que dice su lote lo deja a cero (o menos), se archiva el lote: sus entradas
   * abiertas quedan agotadas, apuntando a la retirada para que deshacerla lo vuelva a abrir.
   * Devuelve cómo se llama el lote («K4920113» o «cad. 05/2028»). Dentro de una transacción.
   */
  async #archivarSiSeTermina(retirada: Movimiento): Promise<string | undefined> {
    if (retirada.tipo !== 'retirada_foto' && retirada.tipo !== 'retirada_manual') return undefined
    const clave = claveLote(retirada)
    if (!clave) return undefined
    const db = this.#db
    const delProducto = await db.movimientos.where('productoId').equals(retirada.productoId).toArray()
    const lote = lotesDeProducto(delProducto, this.#reloj()).find((l) => l.clave === clave)
    if (!lote || lote.archivado || lote.quedan > 0) return undefined
    const cierre: LoteCerrado = { como: 'agotado', usuario: retirada.usuario, fecha: retirada.fecha, movimientoId: retirada.id }
    for (const entrada of lote.entradas) {
      if (!entrada.loteCerrado) await db.movimientos.put({ ...entrada, loteCerrado: cierre })
    }
    return nombreDeLote(lote)
  }

  async deshacerMovimiento(movimientoId: string): Promise<Producto> {
    const ahora = this.#ahora()
    const db = this.#db

    const producto = await db.transaction('rw', db.productos, db.movimientos, db.pedidos, () =>
      this.#deshacerEnTransaccion(movimientoId, ahora),
    )
    this.#avisar()
    return producto
  }

  /** Deshace el último movimiento de un producto. Se llama dentro de una transacción. */
  async #deshacerEnTransaccion(movimientoId: string, ahora: string): Promise<Producto> {
    const db = this.#db
    const movimiento = await db.movimientos.get(movimientoId)
    if (!movimiento) throw new ErrorStock('movimiento-no-encontrado', 'Ese movimiento ya no existe.')
    const ultimo = await this.#ultimoMovimiento(movimiento.productoId)
    if (ultimo?.id !== movimiento.id) {
      throw new ErrorStock(
        'no-es-el-ultimo-movimiento',
        'Solo se puede deshacer el último movimiento del producto.',
      )
    }
    const actual = await db.productos.get(movimiento.productoId)
    if (!actual) throw productoNoEncontrado()
    const stockActual = calcularStockResultante(actual, -movimiento.cantidad)
    const actualizado: Producto = { ...actual, stockActual, actualizadoEn: ahora }
    await db.productos.put(actualizado)
    await db.movimientos.delete(movimiento.id)
    // Si era el ajuste con que se desechó un lote caducado, o la retirada que terminó un lote, ese
    // lote vuelve a estar abierto.
    await db.movimientos
      .where('productoId')
      .equals(movimiento.productoId)
      .filter((m) => m.loteCerrado?.ajusteId === movimiento.id || m.loteCerrado?.movimientoId === movimiento.id)
      .modify((m) => {
        delete m.loteCerrado
      })
    if (movimiento.tipo === 'entrada') {
      // Reabre el pedido que cerró esa entrada (se cerró con su misma fecha).
      await db.pedidos
        .where('[productoId+estado]')
        .equals([movimiento.productoId, 'recibido'])
        .filter((p) => p.fechaRecepcion === movimiento.fecha)
        .modify((p) => {
          p.estado = 'pedido'
          delete p.fechaRecepcion
        })
    }
    return actualizado
  }

  // ─── Lotes ────────────────────────────────────────────────────────────────

  async archivarLote(productoId: string, clave: string, usuario: string): Promise<void> {
    const quien = exigirUsuario(usuario)
    const db = this.#db
    await db.transaction('rw', db.productos, db.movimientos, async () => {
      if (!(await db.productos.get(productoId))) throw productoNoEncontrado()
      const lote = await this.#lote(productoId, clave)
      if (lote.archivado) throw new ErrorStock('datos-no-validos', 'Ese lote ya está archivado.')
      const cierre: LoteCerrado = { como: 'agotado', usuario: quien, fecha: this.#ahora() }
      for (const entrada of lote.entradas) {
        if (!entrada.loteCerrado) await db.movimientos.put({ ...entrada, loteCerrado: cierre })
      }
    })
    this.#avisar()
  }

  async desarchivarLote(productoId: string, clave: string): Promise<void> {
    const db = this.#db
    await db.transaction('rw', db.movimientos, async () => {
      const lote = await this.#lote(productoId, clave)
      const agotadas = lote.entradas.filter((e) => e.loteCerrado?.como === 'agotado')
      if (agotadas.length === 0) {
        throw new ErrorStock(
          'datos-no-validos',
          'Ese lote se desechó: para volver a abrirlo, anula el ajuste con que se desechó.',
        )
      }
      for (const entrada of agotadas) {
        const abierta: Movimiento = { ...entrada }
        delete abierta.loteCerrado
        await db.movimientos.put(abierta)
      }
    })
    this.#avisar()
  }

  /** Un lote del producto por su clave. Se llama dentro de una transacción con movimientos. */
  async #lote(productoId: string, clave: string): Promise<LoteProducto> {
    const delProducto = await this.#db.movimientos.where('productoId').equals(productoId).toArray()
    const buscada = clave.startsWith('cad:') ? clave : normalizarLote(clave)
    const lote = lotesDeProducto(delProducto, this.#reloj()).find((l) => l.clave === buscada)
    if (!lote) throw new ErrorStock('datos-no-validos', 'No se encuentra ese lote del producto.')
    return lote
  }

  // ─── Lotes caducados ──────────────────────────────────────────────────────

  async cerrarLote(entradaId: string, cierre: CierreLote): Promise<Movimiento> {
    const usuario = exigirUsuario(cierre.usuario)
    if (cierre.como === 'desechado' && !(Number.isFinite(cierre.cantidad) && (cierre.cantidad ?? 0) > 0)) {
      throw new ErrorStock('cantidad-no-valida', 'Indica cuántas unidades se desechan (más de cero).')
    }
    const db = this.#db

    const entrada = await db.transaction('rw', db.productos, db.movimientos, db.pedidos, async () => {
      const actual = await db.movimientos.get(entradaId)
      if (!actual) throw new ErrorStock('movimiento-no-encontrado', 'Esa entrada ya no existe.')
      if (actual.tipo !== 'entrada' || !actual.caducidad) {
        throw new ErrorStock('datos-no-validos', 'Solo se pueden cerrar los lotes de entradas con caducidad.')
      }
      if (actual.loteCerrado) throw new ErrorStock('datos-no-validos', 'Ese lote ya está cerrado.')

      let ajusteId: string | undefined
      if (cierre.como === 'desechado') {
        const etiqueta = actual.lote ? `lote ${actual.lote}` : `cad. ${formatearMesAnio(actual.caducidad)}`
        const { movimiento } = await this.#aplicarMovimiento(
          revisarCambio({
            productoId: actual.productoId,
            tipo: 'ajuste',
            cantidad: -(cierre.cantidad ?? 0),
            usuario,
            nota: `Caducado · ${etiqueta}`,
          }),
        )
        ajusteId = movimiento.id
      }
      const cerrada: Movimiento = {
        ...actual,
        loteCerrado: sinIndefinidos({ como: cierre.como, usuario, fecha: this.#ahora(), ajusteId }),
      }
      await db.movimientos.put(cerrada)
      return cerrada
    })

    this.#avisar()
    return entrada
  }

  async reabrirLote(entradaId: string): Promise<void> {
    const ahora = this.#ahora()
    const db = this.#db
    await db.transaction('rw', db.productos, db.movimientos, db.pedidos, async () => {
      const actual = await db.movimientos.get(entradaId)
      if (!actual?.loteCerrado) throw new ErrorStock('datos-no-validos', 'Ese lote no está cerrado.')
      if (actual.loteCerrado.ajusteId && (await db.movimientos.get(actual.loteCerrado.ajusteId))) {
        await this.#deshacerEnTransaccion(actual.loteCerrado.ajusteId, ahora)
      }
      const reabierta: Movimiento = { ...actual }
      delete reabierta.loteCerrado
      await db.movimientos.put(reabierta)
    })
    this.#avisar()
  }

  async listarMovimientos({ productoId, tipo, limite }: FiltroMovimientos = {}): Promise<Movimiento[]> {
    const db = this.#db
    let movimientos: Movimiento[]
    if (productoId !== undefined) {
      movimientos = await db.movimientos
        .where('[productoId+fecha]')
        .between([productoId, Dexie.minKey], [productoId, Dexie.maxKey])
        .reverse()
        .toArray()
      if (tipo !== undefined) movimientos = movimientos.filter((m) => m.tipo === tipo)
    } else if (tipo !== undefined) {
      movimientos = (await db.movimientos.where('tipo').equals(tipo).toArray()).sort(porFechaDescendente)
    } else {
      movimientos = await db.movimientos.orderBy('fecha').reverse().toArray()
    }
    return limite === undefined ? movimientos : movimientos.slice(0, limite)
  }

  // ─── Fotos de referencia ──────────────────────────────────────────────────

  async listarFotos(productoId?: string): Promise<FotoReferencia[]> {
    if (productoId === undefined) return this.#db.fotos.toArray()
    return this.#db.fotos
      .where('[productoId+creadoEn]')
      .between([productoId, Dexie.minKey], [productoId, Dexie.maxKey])
      .toArray()
  }

  async guardarFoto(foto: FotoNueva): Promise<FotoReferencia | null> {
    exigirEmbeddingValido(foto.embedding)
    const db = this.#db
    const nueva: FotoReferencia = {
      id: nuevoId(),
      productoId: foto.productoId,
      embedding: [...foto.embedding],
      miniatura: foto.miniatura,
      origen: foto.origen,
      creadoEn: this.#ahora(),
    }

    const guardada = await db.transaction('rw', db.productos, db.fotos, async () => {
      if (!(await db.productos.get(foto.productoId))) throw productoNoEncontrado()
      const existentes = await db.fotos.where('productoId').equals(foto.productoId).toArray()
      const sobran = existentes.length + 1 - MAX_FOTOS_POR_PRODUCTO
      if (sobran <= 0) {
        await db.fotos.add(nueva)
        return nueva
      }
      // Al pasarse del máximo se descartan las fotos de confirmación más antiguas
      // (la nueva va la última: es la más reciente).
      const confirmaciones = [...existentes, nueva].filter((f) => f.origen === 'confirmacion').sort(porCreacion)
      if (confirmaciones.length < sobran) {
        throw new ErrorStock(
          'limite-fotos',
          `Este producto ya tiene ${MAX_FOTOS_POR_PRODUCTO} fotos de referencia hechas a propósito.`,
        )
      }
      const descartadas = confirmaciones.slice(0, sobran)
      if (descartadas.some((f) => f.id === nueva.id)) return null
      await db.fotos.bulkDelete(descartadas.map((f) => f.id))
      await db.fotos.add(nueva)
      return nueva
    })

    if (guardada) this.#avisar()
    return guardada
  }

  async borrarFoto(id: string): Promise<void> {
    await this.#db.fotos.delete(id)
    this.#avisar()
  }

  async actualizarEmbeddings(cambios: readonly { id: string; embedding: number[] }[]): Promise<number> {
    for (const { embedding } of cambios) exigirEmbeddingValido(embedding)
    const db = this.#db
    const cambiadas = await db.transaction('rw', db.fotos, async () => {
      let cuenta = 0
      for (const { id, embedding } of cambios) cuenta += await db.fotos.update(id, { embedding: [...embedding] })
      return cuenta
    })
    if (cambiadas > 0) this.#avisar()
    return cambiadas
  }

  // ─── Pedidos ──────────────────────────────────────────────────────────────

  async listarPedidos(estado?: EstadoPedido): Promise<Pedido[]> {
    const pedidos =
      estado === undefined
        ? await this.#db.pedidos.toArray()
        : await this.#db.pedidos.where('estado').equals(estado).toArray()
    return pedidos.sort((a, b) => a.fechaPedido.localeCompare(b.fechaPedido))
  }

  async marcarPedido(productoId: string, cantidad?: number): Promise<Pedido> {
    if (cantidad !== undefined && !(Number.isFinite(cantidad) && cantidad > 0)) {
      throw new ErrorStock('cantidad-no-valida', 'La cantidad del pedido tiene que ser mayor que cero.')
    }
    const ahora = this.#ahora()
    const db = this.#db

    const pedido = await db.transaction('rw', db.productos, db.pedidos, async () => {
      const producto = await db.productos.get(productoId)
      if (!producto) throw productoNoEncontrado()
      const enCurso = await db.pedidos.where('[productoId+estado]').equals([productoId, 'pedido']).first()
      if (enCurso) return enCurso
      const nuevo = sinIndefinidos<Pedido>({
        id: nuevoId(),
        productoId,
        cantidad: cantidad ?? producto.cantidadPedidoSugerida,
        estado: 'pedido',
        fechaPedido: ahora,
      })
      await db.pedidos.add(nuevo)
      return nuevo
    })

    this.#avisar()
    return pedido
  }

  async cancelarPedido(id: string): Promise<void> {
    const db = this.#db
    await db.transaction('rw', db.pedidos, async () => {
      const pedido = await db.pedidos.get(id)
      if (!pedido) throw new ErrorStock('pedido-no-encontrado', 'Ese pedido ya no existe.')
      if (pedido.estado !== 'pedido') throw new ErrorStock('datos-no-validos', 'Ese pedido ya se ha recibido.')
      await db.pedidos.delete(id)
    })
    this.#avisar()
  }

  // ─── Todos los datos ──────────────────────────────────────────────────────

  async contar(): Promise<Recuento> {
    const db = this.#db
    const [productos, movimientos, fotos, pedidos] = await Promise.all([
      db.productos.count(),
      db.movimientos.count(),
      db.fotos.count(),
      db.pedidos.count(),
    ])
    return { productos, movimientos, fotos, pedidos }
  }

  async volcar(): Promise<VolcadoDatos> {
    const db = this.#db
    return db.transaction('r', db.productos, db.fotos, db.movimientos, db.pedidos, async () => {
      const [productos, fotos, movimientos, pedidos] = await Promise.all([
        db.productos.toArray(),
        db.fotos.toArray(),
        db.movimientos.toArray(),
        db.pedidos.toArray(),
      ])
      return { productos, fotos, movimientos, pedidos }
    })
  }

  async reemplazarTodo(datos: VolcadoDatos): Promise<void> {
    const db = this.#db
    await db.transaction('rw', db.productos, db.fotos, db.movimientos, db.pedidos, async () => {
      await Promise.all([db.productos.clear(), db.fotos.clear(), db.movimientos.clear(), db.pedidos.clear()])
      await db.productos.bulkAdd(datos.productos)
      await db.fotos.bulkAdd(datos.fotos)
      await db.movimientos.bulkAdd(datos.movimientos)
      await db.pedidos.bulkAdd(datos.pedidos)
    })
    this.#avisar()
  }

  async borrarTodo(): Promise<void> {
    const db = this.#db
    await db.transaction('rw', db.productos, db.fotos, db.movimientos, db.pedidos, async () => {
      await Promise.all([db.productos.clear(), db.fotos.clear(), db.movimientos.clear(), db.pedidos.clear()])
    })
    this.#avisar()
  }

  // ─── Avisos de cambios ────────────────────────────────────────────────────

  /** Han cambiado los datos por otra vía (llegan de otro móvil): avisa a las pantallas. */
  avisarCambioExterno(): void {
    this.#avisar()
  }

  suscribir(alCambiar: () => void): () => void {
    this.#oyentes.add(alCambiar)
    return () => {
      this.#oyentes.delete(alCambiar)
    }
  }

  #avisar(): void {
    this.#canal?.postMessage('cambio')
    this.#notificar()
  }

  /** Agrupa los avisos de una misma tanda en uno solo. */
  #notificar(): void {
    if (this.#avisoPendiente) return
    this.#avisoPendiente = true
    queueMicrotask(() => {
      this.#avisoPendiente = false
      for (const oyente of [...this.#oyentes]) {
        try {
          oyente()
        } catch (error) {
          console.error('Error al avisar de un cambio en los datos', error)
        }
      }
    })
  }

  // ─── Internos ─────────────────────────────────────────────────────────────

  #ahora(): string {
    return this.#reloj().toISOString()
  }

  async #codigos(): Promise<string[]> {
    return (await this.#db.productos.orderBy('codigo').keys()).map(String)
  }

  #ultimoMovimiento(productoId: string): Promise<Movimiento | undefined> {
    return this.#db.movimientos
      .where('[productoId+fecha]')
      .between([productoId, Dexie.minKey], [productoId, Dexie.maxKey])
      .last()
  }

  /** Ahora, pero siempre posterior al último movimiento del producto (orden estricto del historial). */
  async #fechaParaMovimiento(productoId: string): Promise<string> {
    const ahora = this.#reloj().getTime()
    const ultimo = await this.#ultimoMovimiento(productoId)
    const despuesDelUltimo = ultimo ? Date.parse(ultimo.fecha) + 1 : -Infinity
    return new Date(Math.max(ahora, despuesDelUltimo)).toISOString()
  }
}

interface CambioRevisado extends CambioStock {
  caducidad: string | undefined
  confianza: number | undefined
}

/** Comprueba cantidad, usuario, caducidad y confianza antes de abrir la transacción. */
function revisarCambio(cambio: CambioStock): CambioRevisado {
  validarCantidad(cambio.tipo, cambio.cantidad)
  const usuario = exigirUsuario(cambio.usuario)
  const caducidad = textoOpcional(cambio.caducidad)
  if (caducidad !== undefined && !FECHA_SIN_HORA.test(caducidad)) {
    throw new ErrorStock('datos-no-validos', 'La caducidad tiene que ser una fecha (AAAA-MM-DD).')
  }
  const confianza = cambio.tipo === 'retirada_foto' ? cambio.confianza : undefined
  if (confianza !== undefined && !(confianza >= 0 && confianza <= 1)) {
    throw new ErrorStock('datos-no-validos', 'La confianza tiene que estar entre 0 y 1.')
  }
  return { ...cambio, usuario, caducidad, confianza }
}

function productoNoEncontrado(): ErrorStock {
  return new ErrorStock('producto-no-encontrado', 'No se encuentra el producto. Puede que se haya borrado.')
}

function exigirEmbeddingValido(embedding: readonly number[]): void {
  if (embedding.length === 0 || embedding.some((v) => !Number.isFinite(v))) {
    throw new ErrorStock('datos-no-validos', 'La foto no tiene un vector de reconocimiento válido.')
  }
}

function exigirUsuario(usuario: string): string {
  const limpio = usuario.trim()
  if (!limpio) throw new ErrorStock('datos-no-validos', 'Falta el usuario que hace el movimiento.')
  return limpio
}

function porCreacion(a: FotoReferencia, b: FotoReferencia): number {
  return a.creadoEn.localeCompare(b.creadoEn)
}

function porFechaDescendente(a: Movimiento, b: Movimiento): number {
  return b.fecha.localeCompare(a.fecha)
}
