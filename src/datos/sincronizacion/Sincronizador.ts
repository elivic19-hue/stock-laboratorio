import type { Transaction } from 'dexie'
import { redondear } from '../../dominio/numeros'
import type { BaseDatosStock } from '../db'
import type { FotoReferencia, Movimiento, Producto } from '../tipos'
import { TABLAS, type AlmacenRemoto, type CambioRemoto, type DatosRemotos, type Tabla } from './remoto'

/**
 * Sincroniza la base de datos del móvil (Dexie) con la del laboratorio en la nube (fase 2).
 *
 * - Las pantallas y LocalRepository no cambian: siguen leyendo y escribiendo en el móvil, así que
 *   todo funciona igual sin conexión.
 * - Cada cambio local (lo detectan los hooks de Dexie) se manda como documento entero; borrar
 *   manda una lápida. Si no hay conexión, Firebase lo guarda en cola y lo manda al volver.
 * - Los cambios de otros móviles llegan por escuchas y se aplican en el móvil sin volver a mandarse.
 * - El stock de un producto es la suma de sus movimientos: al recibir movimientos se recalcula. Así,
 *   dos retiradas a la vez en dos móviles suman bien (no gana la última en escribirse).
 */

export type MarcasSincronizacion = Record<Tabla, number>

export const MARCAS_INICIALES: MarcasSincronizacion = { productos: 0, movimientos: 0, fotos: 0, pedidos: 0 }

export interface EstadoSincronizador {
  /** Escrituras mandadas que el servidor aún no ha confirmado (sin conexión se acumulan). */
  enviosPendientes: number
  /** Todas las escuchas han recibido datos del servidor (hay conexión). */
  conServidor: boolean
  /** ISO de la última vez que se recibió algo del servidor. */
  ultimaSincronizacion?: string
  error?: string
}

export interface OpcionesSincronizador {
  db: BaseDatosStock
  remoto: AlmacenRemoto
  marcas: MarcasSincronizacion
  alGuardarMarcas: (marcas: MarcasSincronizacion) => void
  /** Han llegado datos de otros móviles: hay que refrescar las pantallas. */
  alCambiarDatos: () => void
  alCambiarEstado: (estado: EstadoSincronizador) => void
}

/** Transacciones que aplican cambios recibidos: sus escrituras no se vuelven a mandar. */
const transaccionesRemotas = new WeakSet<Transaction>()

type FilaLocal = Producto | Movimiento | FotoReferencia | { id: string }

export class Sincronizador {
  readonly #db: BaseDatosStock
  readonly #remoto: AlmacenRemoto
  readonly #opciones: OpcionesSincronizador
  #marcas: MarcasSincronizacion
  #pendientes = new Map<Tabla, Set<string>>()
  #temporizador: ReturnType<typeof setTimeout> | undefined
  #cola: Promise<void> = Promise.resolve()
  #envios = new Set<Promise<void>>()
  #dejarDeEscuchar: (() => void)[] = []
  #quitarHooks: (() => void)[] = []
  #conServidor = new Set<Tabla>()
  #estado: EstadoSincronizador = { enviosPendientes: 0, conServidor: false }
  #activo = false

  constructor(opciones: OpcionesSincronizador) {
    this.#db = opciones.db
    this.#remoto = opciones.remoto
    this.#opciones = opciones
    this.#marcas = { ...opciones.marcas }
  }

  get estado(): EstadoSincronizador {
    return this.#estado
  }

  iniciar(): void {
    if (this.#activo) return
    this.#activo = true
    for (const tabla of TABLAS) {
      this.#ponerHooks(tabla)
      this.#dejarDeEscuchar.push(
        this.#remoto.escuchar(
          tabla,
          this.#marcas[tabla],
          (cambios, desdeServidor) => this.#recibir(tabla, cambios, desdeServidor),
          (error) => this.#cambiarEstado({ error: describirError(error) }),
        ),
      )
    }
  }

  detener(): void {
    this.#activo = false
    for (const quitar of this.#quitarHooks) quitar()
    for (const dejar of this.#dejarDeEscuchar) dejar()
    this.#quitarHooks = []
    this.#dejarDeEscuchar = []
    if (this.#temporizador) clearTimeout(this.#temporizador)
    this.#temporizador = undefined
  }

  /** Marca como pendiente todo lo que hay en el móvil (para subirlo al conectar el primer móvil). */
  async marcarTodo(): Promise<void> {
    for (const tabla of TABLAS) {
      const ids = (await this.#db.table(tabla).toCollection().primaryKeys()) as string[]
      this.#marcar(tabla, ids)
    }
  }

  /**
   * Ejecuta `cambiar` (p. ej. restaurar una copia) y manda después todo lo que había antes y lo que
   * hay ahora: lo que ya no está se borra en la nube. Hace falta porque vaciar una tabla de Dexie
   * no avisa a los hooks.
   */
  async conTodoMarcado(cambiar: () => Promise<void>): Promise<void> {
    await this.marcarTodo()
    await cambiar()
    await this.marcarTodo()
  }

  /** Vacía el móvil sin mandar nada (al conectarse a un laboratorio que ya tiene datos). */
  async vaciarLocal(): Promise<void> {
    const db = this.#db
    await db.transaction('rw', db.productos, db.movimientos, db.fotos, db.pedidos, async (tx) => {
      transaccionesRemotas.add(tx)
      await Promise.all(TABLAS.map((t) => db.table(t).clear()))
    })
    this.#marcas = { ...MARCAS_INICIALES }
    this.#opciones.alGuardarMarcas(this.#marcas)
    this.#opciones.alCambiarDatos()
  }

  /** Espera a que se hayan mandado y aplicado los cambios en curso (para los tests y al desconectar). */
  async esperar({ confirmados = true }: { confirmados?: boolean } = {}): Promise<void> {
    for (let i = 0; i < 20; i++) {
      if (this.#temporizador) await new Promise((r) => setTimeout(r, 0))
      await this.#cola
      if (confirmados) await Promise.all(this.#envios)
      if (!this.#temporizador && this.#pendientes.size === 0) return
    }
  }

  // ─── Cambios locales → nube ─────────────────────────────────────────────

  #ponerHooks(tabla: Tabla): void {
    const t = this.#db.table(tabla)
    const marcar = (id: unknown, transaccion: Transaction) => {
      if (!transaccionesRemotas.has(transaccion) && typeof id === 'string') this.#marcar(tabla, [id])
    }
    const alCrear = function (this: unknown, clave: unknown, fila: { id?: string }, transaccion: Transaction) {
      marcar(fila.id ?? clave, transaccion)
    }
    const alCambiar = function (this: unknown, _cambios: object, clave: unknown, _fila: unknown, transaccion: Transaction) {
      marcar(clave, transaccion)
    }
    const alBorrar = function (this: unknown, clave: unknown, _fila: unknown, transaccion: Transaction) {
      marcar(clave, transaccion)
    }
    t.hook('creating', alCrear)
    t.hook('updating', alCambiar)
    t.hook('deleting', alBorrar)
    this.#quitarHooks.push(() => {
      t.hook.creating.unsubscribe(alCrear)
      t.hook.updating.unsubscribe(alCambiar)
      t.hook.deleting.unsubscribe(alBorrar)
    })
  }

  #marcar(tabla: Tabla, ids: string[]): void {
    if (ids.length === 0) return
    let conjunto = this.#pendientes.get(tabla)
    if (!conjunto) this.#pendientes.set(tabla, (conjunto = new Set()))
    for (const id of ids) conjunto.add(id)
    if (this.#temporizador) return
    // Se manda cuando termina la transacción: la lectura espera a que se confirme y, si se
    // deshace, se manda lo que de verdad quedó (se mira el estado, no lo que se intentó).
    this.#temporizador = setTimeout(() => {
      this.#temporizador = undefined
      this.#encolar(() => this.#mandarPendientes())
    }, 0)
  }

  async #mandarPendientes(): Promise<void> {
    const lote = this.#pendientes
    this.#pendientes = new Map()
    for (const [tabla, conjunto] of lote) {
      const ids = [...conjunto]
      const filas = (await this.#db.table(tabla).bulkGet(ids)) as (FilaLocal | undefined)[]
      for (const [i, id] of ids.entries()) {
        const fila = filas[i]
        this.#mandar(tabla, id, fila ? await aRemoto(tabla, fila) : null)
      }
    }
  }

  #mandar(tabla: Tabla, id: string, datos: DatosRemotos | null): void {
    const envio = this.#remoto
      .escribir(tabla, id, datos)
      .catch((error: unknown) => this.#cambiarEstado({ error: describirError(error) }))
      .finally(() => {
        this.#envios.delete(envio)
        this.#cambiarEstado({})
      })
    this.#envios.add(envio)
    this.#cambiarEstado({})
  }

  // ─── Nube → móvil ───────────────────────────────────────────────────────

  #recibir(tabla: Tabla, cambios: CambioRemoto[], desdeServidor: boolean): void {
    if (desdeServidor) this.#conServidor.add(tabla)
    else this.#conServidor.delete(tabla)
    if (cambios.length === 0) {
      this.#cambiarEstado(desdeServidor ? { ultimaSincronizacion: new Date().toISOString() } : {})
      return
    }
    this.#encolar(async () => {
      await this.#aplicar(tabla, cambios)
      this.#cambiarEstado(desdeServidor ? { ultimaSincronizacion: new Date().toISOString(), error: undefined } : {})
    })
  }

  async #aplicar(tabla: Tabla, cambios: CambioRemoto[]): Promise<void> {
    const db = this.#db
    const t = db.table(tabla)
    const borrar = cambios.filter((c) => c.datos === null).map((c) => c.id)
    const poner = cambios.flatMap((c) => (c.datos === null ? [] : [deRemoto(tabla, c.id, c.datos)]))

    await db.transaction('rw', db.productos, db.movimientos, db.fotos, db.pedidos, async (tx) => {
      transaccionesRemotas.add(tx)
      // Productos cuyo stock hay que recalcular a partir de sus movimientos.
      const afectados = new Set<string>()
      if (tabla === 'movimientos') {
        const borrados = (await t.bulkGet(borrar)) as (Movimiento | undefined)[]
        for (const m of borrados) if (m) afectados.add(m.productoId)
        for (const m of poner as Movimiento[]) afectados.add(m.productoId)
      } else if (tabla === 'productos') {
        for (const p of poner) afectados.add(p.id)
      }
      if (borrar.length) await t.bulkDelete(borrar)
      if (poner.length) await t.bulkPut(poner)
      for (const productoId of afectados) await recalcularStock(db, productoId)
    })

    const maxima = Math.max(this.#marcas[tabla], ...cambios.map((c) => c.marca))
    if (maxima > this.#marcas[tabla]) {
      this.#marcas = { ...this.#marcas, [tabla]: maxima }
      this.#opciones.alGuardarMarcas(this.#marcas)
    }
    this.#opciones.alCambiarDatos()
  }

  // ─── Internos ───────────────────────────────────────────────────────────

  /** Todo (mandar y aplicar) va en fila, de uno en uno. */
  #encolar(tarea: () => Promise<void>): void {
    this.#cola = this.#cola.then(tarea).catch((error: unknown) => {
      console.error('Error de sincronización', error)
      this.#cambiarEstado({ error: describirError(error) })
    })
  }

  #cambiarEstado(cambios: Partial<EstadoSincronizador>): void {
    this.#estado = {
      ...this.#estado,
      ...cambios,
      enviosPendientes: this.#envios.size,
      conServidor: this.#conServidor.size === TABLAS.length,
    }
    this.#opciones.alCambiarEstado(this.#estado)
  }
}

/** Stock = suma de los movimientos del producto (es lo que hace que los móviles cuadren entre sí). */
async function recalcularStock(db: BaseDatosStock, productoId: string): Promise<void> {
  const producto = await db.productos.get(productoId)
  if (!producto) return
  const movimientos = await db.movimientos.where('productoId').equals(productoId).toArray()
  const stock = redondear(movimientos.reduce((suma, m) => suma + m.cantidad, 0))
  if (stock !== producto.stockActual) await db.productos.put({ ...producto, stockActual: stock })
}

// ─── Conversión ───────────────────────────────────────────────────────────

const TIPO_MINIATURA = 'image/jpeg'

export async function aRemoto(tabla: Tabla, fila: FilaLocal): Promise<DatosRemotos> {
  const datos: DatosRemotos = { ...fila }
  delete datos.id
  if (tabla === 'fotos') {
    const miniatura = (fila as FotoReferencia).miniatura
    datos.miniatura = new Uint8Array(await miniatura.arrayBuffer())
  }
  return datos
}

export function deRemoto(tabla: Tabla, id: string, datos: DatosRemotos): FilaLocal {
  const fila: Record<string, unknown> = { ...datos, id }
  if (tabla === 'fotos' && datos.miniatura instanceof Uint8Array) {
    fila.miniatura = new Blob([new Uint8Array(datos.miniatura)], { type: TIPO_MINIATURA })
  }
  return fila as unknown as FilaLocal
}

function describirError(error: unknown): string {
  const codigo = (error as { code?: unknown } | null)?.code
  if (codigo === 'permission-denied') {
    return 'La nube no deja leer o escribir: revisa las reglas de Firestore o vuelve a conectar este móvil.'
  }
  if (codigo === 'resource-exhausted') return 'Se ha agotado la cuota gratuita de hoy. Mañana se reanuda.'
  if (codigo === 'unauthenticated') return 'La sesión ha caducado: vuelve a conectar este móvil en Ajustes.'
  return error instanceof Error ? error.message : 'Error de sincronización.'
}
