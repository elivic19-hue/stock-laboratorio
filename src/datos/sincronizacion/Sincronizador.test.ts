import { afterEach, describe, expect, it } from 'vitest'
import { BaseDatosStock } from '../db'
import { crearDatosEjemplo } from '../ejemplo'
import { LocalRepository } from '../LocalRepository'
import type { DatosProductoNuevo } from '../StockRepository'
import { type AlmacenRemoto, type CambioRemoto, type DatosRemotos, type Tabla } from './remoto'
import { MARCAS_INICIALES, Sincronizador } from './Sincronizador'

/** La nube en memoria. Con `pausar()` simula estar sin conexión: lo escrito no llega hasta `reanudar()`. */
class RemotoEnMemoria {
  readonly docs = new Map<string, { datos: DatosRemotos | null; marca: number }>()
  #reloj = 0
  escrituras = 0

  conectar(): AlmacenRemoto & { pausar(): void; reanudar(): void } {
    const oyentes = new Set<{ tabla: Tabla; alCambiar: (c: CambioRemoto[], s: boolean) => void }>()
    let enPausa: (() => void)[] | null = null
    return {
      escribir: (tabla, id, datos) => {
        const hacer = () => this.#escribir(tabla, id, datos)
        if (enPausa) {
          return new Promise<void>((ok) =>
            enPausa?.push(() => {
              hacer()
              ok()
            }),
          )
        }
        hacer()
        return Promise.resolve()
      },
      escuchar: (tabla, desde, alCambiar) => {
        const oyente = { tabla, alCambiar }
        oyentes.add(oyente)
        this.#oyentes.add(oyente)
        const iniciales = this.#cambios(tabla, desde)
        queueMicrotask(() => alCambiar(iniciales, true))
        return () => {
          oyentes.delete(oyente)
          this.#oyentes.delete(oyente)
        }
      },
      pausar: () => {
        enPausa = []
        for (const o of oyentes) this.#oyentes.delete(o)
      },
      reanudar: () => {
        const cola = enPausa ?? []
        enPausa = null
        for (const hacer of cola) hacer()
        for (const o of oyentes) {
          this.#oyentes.add(o)
          // Al volver la conexión, la escucha recibe lo que cambió mientras tanto.
          queueMicrotask(() => o.alCambiar(this.#cambios(o.tabla, 0), true))
        }
      },
    }
  }

  #oyentes = new Set<{ tabla: Tabla; alCambiar: (c: CambioRemoto[], s: boolean) => void }>()

  #escribir(tabla: Tabla, id: string, datos: DatosRemotos | null) {
    this.escrituras++
    const marca = ++this.#reloj
    // Como Firestore: lo que se guarda es una copia (los Uint8Array llegan como bytes nuevos).
    const copia = datos && structuredClone(datos)
    this.docs.set(`${tabla}/${id}`, { datos: copia, marca })
    for (const o of this.#oyentes) {
      if (o.tabla === tabla) queueMicrotask(() => o.alCambiar([{ id, datos: copia && structuredClone(copia), marca }], true))
    }
  }

  #cambios(tabla: Tabla, desde: number): CambioRemoto[] {
    return [...this.docs]
      .filter(([clave, d]) => clave.startsWith(`${tabla}/`) && d.marca >= desde)
      .map(([clave, d]) => ({ id: clave.slice(tabla.length + 1), datos: d.datos && structuredClone(d.datos), marca: d.marca }))
  }
}

interface Movil {
  db: BaseDatosStock
  repo: LocalRepository
  sync: Sincronizador
  red: ReturnType<RemotoEnMemoria['conectar']>
}

let numero = 0
const abiertos: Movil[] = []

function movil(nube: RemotoEnMemoria): Movil {
  const db = new BaseDatosStock(`sync-${++numero}`)
  const repo = new LocalRepository(db)
  const red = nube.conectar()
  const sync = new Sincronizador({
    db,
    remoto: red,
    marcas: MARCAS_INICIALES,
    alGuardarMarcas: () => {},
    alCambiarDatos: () => {},
    alCambiarEstado: () => {},
  })
  const m = { db, repo, sync, red }
  abiertos.push(m)
  return m
}

/** Deja que todo se mande y se aplique en todos los móviles (hasta que nada cambie en dos vueltas). */
async function asentar(...moviles: Movil[]) {
  let estables = 0
  let anterior = ''
  for (let i = 0; i < 60 && estables < 2; i++) {
    for (const m of moviles) await m.sync.esperar()
    await new Promise((r) => setTimeout(r, 10))
    const foto = JSON.stringify(await Promise.all(moviles.map((m) => m.repo.contar())))
    const ahora = `${foto}|${moviles.map((m) => m.sync.estado.enviosPendientes).join()}`
    estables = ahora === anterior ? estables + 1 : 0
    anterior = ahora
  }
}

afterEach(async () => {
  for (const m of abiertos.splice(0)) {
    m.sync.detener()
    m.repo.cerrar()
    await m.db.delete()
  }
})

const puntas: DatosProductoNuevo = {
  nombre: 'Puntas de pipeta 1000 µL',
  categoria: 'fungible',
  formato: 'Rack 96 uds',
  unidadCorta: 'racks',
  armario: 'Armario 2',
  stockMinimo: 5,
  stockInicial: 12,
}

describe('sincronización entre móviles', () => {
  it('lo que se hace en un móvil aparece en el otro', async () => {
    const nube = new RemotoEnMemoria()
    const a = movil(nube)
    const b = movil(nube)
    a.sync.iniciar()
    b.sync.iniciar()

    const p = await a.repo.crearProducto(puntas, 'JA')
    await a.repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_manual', cantidad: -2, usuario: 'JA' })
    await a.repo.guardarFoto({
      productoId: p.id,
      embedding: [0.6, 0.8],
      miniatura: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
      origen: 'alta',
    })
    await asentar(a, b)

    expect((await b.repo.obtenerProducto(p.id))?.stockActual).toBe(10)
    expect(await b.repo.listarMovimientos({ productoId: p.id })).toHaveLength(2)
    const [foto] = await b.repo.listarFotos(p.id)
    expect(foto?.embedding).toEqual([0.6, 0.8])
    expect([...new Uint8Array(await foto!.miniatura.arrayBuffer())]).toEqual([1, 2, 3])
  })

  it('dos retiradas a la vez sin conexión suman bien al volver', async () => {
    const nube = new RemotoEnMemoria()
    const a = movil(nube)
    const b = movil(nube)
    a.sync.iniciar()
    b.sync.iniciar()
    const p = await a.repo.crearProducto(puntas, 'JA')
    await asentar(a, b)

    a.red.pausar()
    b.red.pausar()
    await a.repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_foto', cantidad: -1, usuario: 'JA' })
    await b.repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_manual', cantidad: -3, usuario: 'LP' })
    await a.sync.esperar({ confirmados: false })
    await b.sync.esperar({ confirmados: false })
    // Cada uno, por su cuenta, ve solo lo suyo…
    expect((await a.repo.obtenerProducto(p.id))?.stockActual).toBe(11)
    expect((await b.repo.obtenerProducto(p.id))?.stockActual).toBe(9)

    a.red.reanudar()
    b.red.reanudar()
    await asentar(a, b)
    // …y al volver la conexión los dos cuadran: 12 − 1 − 3.
    expect((await a.repo.obtenerProducto(p.id))?.stockActual).toBe(8)
    expect((await b.repo.obtenerProducto(p.id))?.stockActual).toBe(8)
  })

  it('borrar (eliminar producto, deshacer, borrar foto) llega a los demás', async () => {
    const nube = new RemotoEnMemoria()
    const a = movil(nube)
    const b = movil(nube)
    a.sync.iniciar()
    b.sync.iniciar()
    const p = await a.repo.crearProducto(puntas, 'JA')
    const q = await a.repo.crearProducto({ ...puntas, nombre: 'Creado por error' }, 'JA')
    const { movimiento } = await a.repo.registrarMovimiento({
      productoId: p.id,
      tipo: 'entrada',
      cantidad: 5,
      usuario: 'JA',
    })
    await asentar(a, b)
    expect((await b.repo.obtenerProducto(p.id))?.stockActual).toBe(17)

    await b.repo.deshacerMovimiento(movimiento.id)
    await b.repo.eliminarProducto(q.id)
    await asentar(a, b)
    expect((await a.repo.obtenerProducto(p.id))?.stockActual).toBe(12)
    expect(await a.repo.obtenerProducto(q.id)).toBeUndefined()
    expect(await a.repo.contar()).toEqual({ productos: 1, movimientos: 1, fotos: 0, pedidos: 0 })
  })

  it('lo recibido no se vuelve a mandar (no hay eco)', async () => {
    const nube = new RemotoEnMemoria()
    const a = movil(nube)
    const b = movil(nube)
    a.sync.iniciar()
    b.sync.iniciar()
    await a.repo.crearProducto(puntas, 'JA') // producto + movimiento de stock inicial
    await asentar(a, b)
    await asentar(a, b)
    expect(nube.escrituras).toBe(2)
  })

  it('el primer móvil sube lo que tiene; uno nuevo lo baja entero', async () => {
    const nube = new RemotoEnMemoria()
    const a = movil(nube)
    await a.repo.reemplazarTodo(crearDatosEjemplo(new Date(2026, 10, 19)))
    a.sync.iniciar()
    await a.sync.marcarTodo()
    await asentar(a)

    const b = movil(nube)
    await b.repo.crearProducto({ ...puntas, nombre: 'Lo que había en el móvil nuevo' }, 'XX')
    await b.sync.vaciarLocal()
    b.sync.iniciar()
    await asentar(a, b)
    expect(await b.repo.volcar()).toEqual(await a.repo.volcar())
  })

  it('restaurar una copia en un móvil conectado sustituye los datos de todos', async () => {
    const nube = new RemotoEnMemoria()
    const a = movil(nube)
    const b = movil(nube)
    a.sync.iniciar()
    b.sync.iniciar()
    await a.repo.crearProducto(puntas, 'JA')
    await asentar(a, b)

    const copia = crearDatosEjemplo(new Date(2026, 10, 19))
    // Con una pausa antes de sustituir (como un móvil lento): el envío no puede salir a mitad.
    await a.sync.conTodoMarcado(async () => {
      await new Promise((r) => setTimeout(r, 30))
      await a.repo.reemplazarTodo(copia)
    })
    await asentar(a, b)
    const enB = await b.repo.volcar()
    expect(enB.productos.map((p) => p.codigo).sort()).toEqual(copia.productos.map((p) => p.codigo).sort())
    expect(enB.movimientos).toHaveLength(copia.movimientos.length)
  })
})
