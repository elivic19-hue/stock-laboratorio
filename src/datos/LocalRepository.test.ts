import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BaseDatosStock } from './db'
import { crearDatosEjemplo } from './ejemplo'
import { LocalRepository } from './LocalRepository'
import { MAX_FOTOS_POR_PRODUCTO, type DatosProductoNuevo, type FotoNueva } from './StockRepository'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Reloj que avanza un segundo en cada lectura. */
function relojDePrueba(inicio = new Date(2026, 10, 19, 9, 0)): () => Date {
  let t = inicio.getTime()
  return () => new Date((t += 1000))
}

let numeroBase = 0
let db: BaseDatosStock
let repo: LocalRepository

beforeEach(() => {
  db = new BaseDatosStock(`prueba-${++numeroBase}`)
  repo = new LocalRepository(db, { reloj: relojDePrueba() })
})

afterEach(async () => {
  repo.cerrar()
  await db.delete()
})

const etanol: DatosProductoNuevo = {
  nombre: 'Etanol absoluto',
  categoria: 'reactivo',
  formato: 'Botella 1 L',
  unidadCorta: 'bot.',
  armario: 'Armario inflamables',
  balda: 'Balda 2',
  stockMinimo: 3,
  cantidadPedidoSugerida: 6,
  stockInicial: 0,
}

describe('productos', () => {
  it('asigna un UUID y el siguiente código de su categoría', async () => {
    const a = await repo.crearProducto(etanol, 'JA')
    const b = await repo.crearProducto({ ...etanol, nombre: 'Acetona' }, 'JA')
    const c = await repo.crearProducto({ ...etanol, nombre: 'Viales 2 mL', categoria: 'fungible' }, 'JA')
    expect([a.codigo, b.codigo, c.codigo]).toEqual(['R-001', 'R-002', 'F-001'])
    expect(a.id).toMatch(UUID)
    expect(await repo.siguienteCodigo('reactivo')).toBe('R-003')
  })

  it('respeta un código escrito a mano y no deja repetirlo', async () => {
    const p = await repo.crearProducto({ ...etanol, codigo: ' r-014 ' }, 'JA')
    expect(p.codigo).toBe('R-014')
    await expect(repo.crearProducto({ ...etanol, codigo: 'R-014' }, 'JA')).rejects.toMatchObject({
      codigo: 'codigo-duplicado',
    })
    expect(await repo.siguienteCodigo('reactivo')).toBe('R-015')
  })

  it('guarda el stock inicial como movimiento de ajuste', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 4 }, 'JA')
    expect(p.stockActual).toBe(4)
    const [inicial] = await repo.listarMovimientos({ productoId: p.id })
    expect(inicial).toMatchObject({ tipo: 'ajuste', cantidad: 4, stockResultante: 4, usuario: 'JA', nota: 'Stock inicial' })
  })

  it('rechaza datos incompletos y no guarda nada', async () => {
    await expect(repo.crearProducto({ ...etanol, nombre: '  ' }, 'JA')).rejects.toMatchObject({
      codigo: 'datos-no-validos',
    })
    await expect(repo.crearProducto({ ...etanol, stockMinimo: -1 }, 'JA')).rejects.toMatchObject({
      codigo: 'datos-no-validos',
    })
    expect(await repo.listarProductos()).toHaveLength(0)
  })

  it('edita sin tocar el stock y archiva sin borrar', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 5 }, 'JA')
    const editado = await repo.actualizarProducto(p.id, { nombre: 'Etanol absoluto 99,8 %', balda: '' })
    expect(editado.nombre).toBe('Etanol absoluto 99,8 %')
    expect(editado.balda).toBeUndefined()
    expect(editado.stockActual).toBe(5)

    await repo.actualizarProducto(p.id, { archivado: true })
    expect(await repo.listarProductos()).toHaveLength(0)
    expect(await repo.listarProductos({ incluirArchivados: true })).toHaveLength(1)
  })

  it('no deja poner a un producto el código de otro', async () => {
    await repo.crearProducto(etanol, 'JA')
    const acetona = await repo.crearProducto({ ...etanol, nombre: 'Acetona' }, 'JA')
    await expect(repo.actualizarProducto(acetona.id, { codigo: 'r-001' })).rejects.toMatchObject({
      codigo: 'codigo-duplicado',
    })
  })

  it('ordena por nombre como una persona (10 antes que 200 y que 1000)', async () => {
    for (const nombre of ['Puntas de pipeta 1000 µL', 'Puntas de pipeta 10 µL', 'Puntas de pipeta 200 µL']) {
      await repo.crearProducto({ ...etanol, nombre, categoria: 'fungible' }, 'JA')
    }
    expect((await repo.listarProductos()).map((p) => p.nombre)).toEqual([
      'Puntas de pipeta 10 µL',
      'Puntas de pipeta 200 µL',
      'Puntas de pipeta 1000 µL',
    ])
  })
})

describe('eliminar producto', () => {
  it('borra el producto con sus movimientos, fotos y pedidos, y nada más', async () => {
    const malo = await repo.crearProducto({ ...etanol, nombre: 'Creado por error', stockInicial: 4 }, 'JA')
    const bueno = await repo.crearProducto({ ...etanol, stockInicial: 2 }, 'JA')
    await repo.marcarPedido(malo.id)
    await repo.guardarFoto({ productoId: malo.id, embedding: [1, 0], miniatura: new Blob(['x']), origen: 'alta' })
    await repo.eliminarProducto(malo.id)
    expect(await repo.obtenerProducto(malo.id)).toBeUndefined()
    expect(await repo.listarMovimientos({ productoId: malo.id })).toEqual([])
    expect(await repo.listarFotos(malo.id)).toEqual([])
    expect(await repo.listarPedidos()).toEqual([])
    expect(await repo.contar()).toEqual({ productos: 1, movimientos: 1, fotos: 0, pedidos: 0 })
    expect((await repo.obtenerProducto(bueno.id))?.stockActual).toBe(2)
    await expect(repo.eliminarProducto(malo.id)).rejects.toMatchObject({ codigo: 'producto-no-encontrado' })
  })
})

describe('movimientos', () => {
  it('actualiza el stock y crea el movimiento a la vez', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 5 }, 'JA')
    const { movimiento, producto } = await repo.registrarMovimiento({
      productoId: p.id,
      tipo: 'retirada_foto',
      cantidad: -2,
      usuario: 'MG',
      confianza: 0.93,
    })
    expect(producto.stockActual).toBe(3)
    expect(movimiento).toMatchObject({ cantidad: -2, stockResultante: 3, usuario: 'MG', confianza: 0.93 })
    expect(movimiento.id).toMatch(UUID)
    expect((await repo.obtenerProducto(p.id))?.stockActual).toBe(3)
    const historial = await repo.listarMovimientos({ productoId: p.id })
    expect(historial.map((m) => m.cantidad)).toEqual([-2, 5])
  })

  it('no deja el stock en negativo y, si falla, no guarda nada', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 1 }, 'JA')
    await expect(
      repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_manual', cantidad: -2, usuario: 'JA' }),
    ).rejects.toMatchObject({ codigo: 'stock-insuficiente' })
    expect((await repo.obtenerProducto(p.id))?.stockActual).toBe(1)
    expect(await repo.listarMovimientos({ productoId: p.id })).toHaveLength(1)
  })

  it('rechaza cantidades con el signo equivocado y movimientos sin usuario', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 5 }, 'JA')
    await expect(
      repo.registrarMovimiento({ productoId: p.id, tipo: 'entrada', cantidad: -1, usuario: 'JA' }),
    ).rejects.toMatchObject({ codigo: 'cantidad-no-valida' })
    await expect(
      repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_foto', cantidad: -1, usuario: ' ' }),
    ).rejects.toMatchObject({ codigo: 'datos-no-validos' })
  })

  it('guarda lote y caducidad en la entrada, y la confianza solo en retiradas con foto', async () => {
    const p = await repo.crearProducto(etanol, 'JA')
    const { movimiento: entrada } = await repo.registrarMovimiento({
      productoId: p.id,
      tipo: 'entrada',
      cantidad: 6,
      usuario: 'JA',
      lote: ' K5341298 ',
      caducidad: '2029-03-31',
      nota: '',
      confianza: 0.5,
    })
    expect(entrada).toMatchObject({ lote: 'K5341298', caducidad: '2029-03-31' })
    expect(entrada.nota).toBeUndefined()
    expect(entrada.confianza).toBeUndefined()
    await expect(
      repo.registrarMovimiento({ productoId: p.id, tipo: 'entrada', cantidad: 1, usuario: 'JA', caducidad: '03/2029' }),
    ).rejects.toMatchObject({ codigo: 'datos-no-validos' })
  })

  it('una entrada pasa a recibido el pedido en curso', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 1 }, 'JA')
    await repo.marcarPedido(p.id)
    const { movimiento } = await repo.registrarMovimiento({ productoId: p.id, tipo: 'entrada', cantidad: 6, usuario: 'JA' })
    const [pedido] = await repo.listarPedidos()
    expect(pedido).toMatchObject({ estado: 'recibido', fechaRecepcion: movimiento.fecha, cantidad: 6 })
  })

  it('deshacer devuelve el stock y borra el movimiento', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 5 }, 'JA')
    const { movimiento } = await repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_foto', cantidad: -1, usuario: 'JA' })
    const producto = await repo.deshacerMovimiento(movimiento.id)
    expect(producto.stockActual).toBe(5)
    expect(await repo.listarMovimientos({ productoId: p.id })).toHaveLength(1)
  })

  it('solo deja deshacer el último movimiento del producto', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 5 }, 'JA')
    const primero = await repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_foto', cantidad: -1, usuario: 'JA' })
    await repo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_foto', cantidad: -1, usuario: 'JA' })
    await expect(repo.deshacerMovimiento(primero.movimiento.id)).rejects.toMatchObject({
      codigo: 'no-es-el-ultimo-movimiento',
    })
  })

  it('deshacer una entrada vuelve a abrir el pedido que había cerrado', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 1 }, 'JA')
    await repo.marcarPedido(p.id)
    const { movimiento } = await repo.registrarMovimiento({ productoId: p.id, tipo: 'entrada', cantidad: 6, usuario: 'JA' })
    await repo.deshacerMovimiento(movimiento.id)
    const [pedido] = await repo.listarPedidos()
    expect(pedido?.estado).toBe('pedido')
    expect(pedido?.fechaRecepcion).toBeUndefined()
  })

  it('mantiene el orden del historial aunque el reloj no avance', async () => {
    const fijo = new Date(2026, 10, 19, 9, 0)
    const repoFijo = new LocalRepository(db, { reloj: () => fijo })
    const p = await repoFijo.crearProducto({ ...etanol, stockInicial: 5 }, 'JA')
    const a = await repoFijo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_foto', cantidad: -1, usuario: 'JA' })
    const b = await repoFijo.registrarMovimiento({ productoId: p.id, tipo: 'retirada_foto', cantidad: -1, usuario: 'JA' })
    expect(b.movimiento.fecha > a.movimiento.fecha).toBe(true)
    await repoFijo.deshacerMovimiento(b.movimiento.id)
    expect((await repoFijo.obtenerProducto(p.id))?.stockActual).toBe(4)
    repoFijo.cerrar()
  })
})

describe('lotes caducados', () => {
  async function conLote() {
    const p = await repo.crearProducto(etanol, 'JA')
    const { movimiento } = await repo.registrarMovimiento({
      productoId: p.id,
      tipo: 'entrada',
      cantidad: 6,
      usuario: 'LP',
      lote: 'K4920113',
      caducidad: '2026-10-31',
    })
    return { p, entrada: movimiento }
  }

  it('desechar resta con un ajuste «Caducado · lote …» y cierra el lote a la vez', async () => {
    const { p, entrada } = await conLote()
    const cerrada = await repo.cerrarLote(entrada.id, { como: 'desechado', cantidad: 4, usuario: 'MG' })
    expect(cerrada.loteCerrado).toMatchObject({ como: 'desechado', usuario: 'MG' })
    expect((await repo.obtenerProducto(p.id))?.stockActual).toBe(2)
    const [ajuste] = await repo.listarMovimientos({ productoId: p.id })
    expect(ajuste).toMatchObject({ tipo: 'ajuste', cantidad: -4, nota: 'Caducado · lote K4920113', usuario: 'MG' })
    expect(cerrada.loteCerrado?.ajusteId).toBe(ajuste?.id)
  })

  it('«ya no queda» solo marca el lote, sin tocar el stock', async () => {
    const { p, entrada } = await conLote()
    await repo.cerrarLote(entrada.id, { como: 'agotado', usuario: 'MG' })
    expect((await repo.obtenerProducto(p.id))?.stockActual).toBe(6)
    expect(await repo.listarMovimientos({ productoId: p.id })).toHaveLength(1)
  })

  it('reabrir deshace el ajuste y quita la marca', async () => {
    const { p, entrada } = await conLote()
    await repo.cerrarLote(entrada.id, { como: 'desechado', cantidad: 6, usuario: 'MG' })
    await repo.reabrirLote(entrada.id)
    expect((await repo.obtenerProducto(p.id))?.stockActual).toBe(6)
    const historial = await repo.listarMovimientos({ productoId: p.id })
    expect(historial).toHaveLength(1)
    expect(historial[0]?.loteCerrado).toBeUndefined()
  })

  it('anular el ajuste de un lote desechado vuelve a abrir el lote', async () => {
    const { p, entrada } = await conLote()
    const cerrada = await repo.cerrarLote(entrada.id, { como: 'desechado', cantidad: 4, usuario: 'MG' })
    await repo.deshacerMovimiento(cerrada.loteCerrado?.ajusteId ?? '')
    expect((await repo.obtenerProducto(p.id))?.stockActual).toBe(6)
    const [entradaOtraVez] = await repo.listarMovimientos({ productoId: p.id })
    expect(entradaOtraVez?.id).toBe(entrada.id)
    expect(entradaOtraVez?.loteCerrado).toBeUndefined()
  })

  it('si falla el ajuste no se cierra nada', async () => {
    const { p, entrada } = await conLote()
    await expect(repo.cerrarLote(entrada.id, { como: 'desechado', cantidad: 9, usuario: 'MG' })).rejects.toMatchObject({
      codigo: 'stock-insuficiente',
    })
    expect((await repo.listarMovimientos({ productoId: p.id }))[0]?.loteCerrado).toBeUndefined()
  })

  it('solo entradas con caducidad, una sola vez y con cantidad al desechar', async () => {
    const { p, entrada } = await conLote()
    const { movimiento: sinCaducidad } = await repo.registrarMovimiento({
      productoId: p.id,
      tipo: 'entrada',
      cantidad: 1,
      usuario: 'LP',
    })
    await expect(repo.cerrarLote(sinCaducidad.id, { como: 'agotado', usuario: 'MG' })).rejects.toMatchObject({
      codigo: 'datos-no-validos',
    })
    await expect(repo.cerrarLote(entrada.id, { como: 'desechado', usuario: 'MG' })).rejects.toMatchObject({
      codigo: 'cantidad-no-valida',
    })
    await repo.cerrarLote(entrada.id, { como: 'agotado', usuario: 'MG' })
    await expect(repo.cerrarLote(entrada.id, { como: 'agotado', usuario: 'MG' })).rejects.toMatchObject({
      codigo: 'datos-no-validos',
    })
  })
})

describe('fotos de referencia', () => {
  const miniatura = new Blob(['jpeg'], { type: 'image/jpeg' })
  const foto = (productoId: string, origen: FotoNueva['origen']): FotoNueva => ({
    productoId,
    embedding: [0.6, 0.8],
    miniatura,
    origen,
  })

  it(`con más de ${MAX_FOTOS_POR_PRODUCTO} descarta la foto de confirmación más antigua`, async () => {
    const p = await repo.crearProducto(etanol, 'JA')
    for (let i = 0; i < 10; i++) await repo.guardarFoto(foto(p.id, 'alta'))
    const confirmaciones: string[] = []
    for (let i = 0; i < 10; i++) {
      const f = await repo.guardarFoto(foto(p.id, 'confirmacion'))
      if (f) confirmaciones.push(f.id)
    }
    expect(await repo.listarFotos(p.id)).toHaveLength(MAX_FOTOS_POR_PRODUCTO)

    const nueva = await repo.guardarFoto(foto(p.id, 'confirmacion'))
    const ids = (await repo.listarFotos(p.id)).map((f) => f.id)
    expect(ids).toHaveLength(MAX_FOTOS_POR_PRODUCTO)
    expect(ids).not.toContain(confirmaciones[0])
    expect(ids).toContain(confirmaciones[1])
    expect(ids).toContain(nueva?.id)
  })

  it(`no admite más de ${MAX_FOTOS_POR_PRODUCTO} fotos hechas a propósito`, async () => {
    const p = await repo.crearProducto(etanol, 'JA')
    for (let i = 0; i < MAX_FOTOS_POR_PRODUCTO; i++) await repo.guardarFoto(foto(p.id, 'alta'))
    await expect(repo.guardarFoto(foto(p.id, 'alta'))).rejects.toMatchObject({ codigo: 'limite-fotos' })
    expect(await repo.guardarFoto(foto(p.id, 'confirmacion'))).toBeNull()
    expect(await repo.listarFotos(p.id)).toHaveLength(MAX_FOTOS_POR_PRODUCTO)
  })

  it('rechaza fotos sin vector de reconocimiento', async () => {
    const p = await repo.crearProducto(etanol, 'JA')
    await expect(repo.guardarFoto({ ...foto(p.id, 'alta'), embedding: [] })).rejects.toMatchObject({
      codigo: 'datos-no-validos',
    })
  })
})

describe('pedidos', () => {
  it('marcar pedido usa la cantidad sugerida y no duplica el pedido en curso', async () => {
    const p = await repo.crearProducto({ ...etanol, stockInicial: 1 }, 'JA')
    const a = await repo.marcarPedido(p.id)
    const b = await repo.marcarPedido(p.id, 12)
    expect(a.cantidad).toBe(6)
    expect(b.id).toBe(a.id)
    expect(await repo.listarPedidos('pedido')).toHaveLength(1)
  })

  it('cancelar un pedido en curso lo quita', async () => {
    const p = await repo.crearProducto(etanol, 'JA')
    const pedido = await repo.marcarPedido(p.id)
    await repo.cancelarPedido(pedido.id)
    expect(await repo.listarPedidos()).toHaveLength(0)
  })
})

describe('todos los datos', () => {
  it('carga los datos de ejemplo y la numeración de códigos continúa', async () => {
    await repo.reemplazarTodo(crearDatosEjemplo(new Date(2026, 10, 19, 18, 30)))
    expect(await repo.contar()).toEqual({ productos: 9, movimientos: 31, fotos: 0, pedidos: 3 })
    expect(await repo.siguienteCodigo('reactivo')).toBe('R-032')
    expect(await repo.siguienteCodigo('fungible')).toBe('F-032')
  })

  it('volcar devuelve lo mismo que se cargó', async () => {
    const datos = crearDatosEjemplo()
    await repo.reemplazarTodo(datos)
    const volcado = await repo.volcar()
    const ordenar = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id))
    expect(ordenar(volcado.productos)).toEqual(ordenar(datos.productos))
    expect(ordenar(volcado.movimientos)).toEqual(ordenar(datos.movimientos))
    expect(ordenar(volcado.pedidos)).toEqual(ordenar(datos.pedidos))
  })

  it('borrarTodo lo deja vacío', async () => {
    await repo.reemplazarTodo(crearDatosEjemplo())
    await repo.borrarTodo()
    expect(await repo.contar()).toEqual({ productos: 0, movimientos: 0, fotos: 0, pedidos: 0 })
  })

  it('avisa a los suscriptores de cada cambio', async () => {
    let avisos = 0
    const dejarDeEscuchar = repo.suscribir(() => {
      avisos++
    })
    await repo.crearProducto(etanol, 'JA')
    await Promise.resolve()
    expect(avisos).toBe(1)

    dejarDeEscuchar()
    await repo.crearProducto({ ...etanol, nombre: 'Acetona' }, 'JA')
    await Promise.resolve()
    expect(avisos).toBe(1)
  })
})
