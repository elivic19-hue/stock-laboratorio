import { describe, expect, it } from 'vitest'
import type { VolcadoDatos } from '../StockRepository'
import type { FotoReferencia, Movimiento, Pedido, Producto } from '../tipos'
import { planificarMigracion } from './migracionPrincipal'

const FECHA = '2026-11-19T09:00:00.000Z'

function producto(id: string, codigo: string, nombre: string, categoria: Producto['categoria'] = 'reactivo'): Producto {
  return {
    id,
    codigo,
    nombre,
    categoria,
    formato: 'Botella 1 L',
    unidadCorta: 'bot.',
    armario: 'Armario 1',
    stockActual: 2,
    stockMinimo: 1,
    archivado: false,
    creadoEn: FECHA,
    actualizadoEn: FECHA,
  }
}
const mov = (id: string, productoId: string): Movimiento => ({
  id,
  productoId,
  tipo: 'entrada',
  cantidad: 2,
  stockResultante: 2,
  usuario: 'JA',
  fecha: FECHA,
})
const foto = (id: string, productoId: string, origen: FotoReferencia['origen'] = 'alta', creadoEn = FECHA): FotoReferencia => ({
  id,
  productoId,
  embedding: [1, 0],
  miniatura: new Blob(['x']),
  origen,
  creadoEn,
})
const pedido = (id: string, productoId: string): Pedido => ({ id, productoId, estado: 'pedido', fechaPedido: FECHA })
const vacio: VolcadoDatos = { productos: [], movimientos: [], fotos: [], pedidos: [] }

describe('planificarMigracion', () => {
  const origen: VolcadoDatos = {
    productos: [
      producto('a', 'R-001', 'Acetonitrilo HPLC'),
      producto('b', 'R-002', 'Metanol'),
      producto('c', 'F-001', 'Puntas 1000 µL', 'fungible'),
    ],
    movimientos: [mov('m1', 'a'), mov('m2', 'b'), mov('m3', 'c')],
    fotos: [foto('f1', 'a'), foto('f2', 'b'), foto('f3', 'b', 'confirmacion')],
    pedidos: [pedido('p1', 'b')],
  }

  it('al laboratorio vacío se trae todo tal cual', () => {
    const plan = planificarMigracion(origen, vacio)
    expect(plan.productos.map((p) => p.codigo)).toEqual(['R-001', 'R-002', 'F-001'])
    expect(plan.movimientos).toHaveLength(3)
    expect(plan.fotos).toHaveLength(3)
    expect(plan.pedidos).toHaveLength(1)
    expect(plan.resumen).toMatchObject({ productosNuevos: 3, productosQueYaEstaban: 0, codigosCambiados: [] })
  })

  it('lo que ya está con el mismo nombre se queda; solo recibe las fotos de antes', () => {
    // Hoy se ha metido «metanol» (R-001) y otro reactivo con el código R-002.
    const destino: VolcadoDatos = {
      ...vacio,
      productos: [producto('hoy1', 'R-001', ' METANOL '), producto('hoy2', 'R-002', 'Ácido acético')],
      fotos: [foto('fh', 'hoy1')],
    }
    const plan = planificarMigracion(origen, destino)
    // Acetonitrilo y las puntas son nuevos; el acetonitrilo no puede quedarse con R-001.
    expect(plan.productos.map((p) => [p.id, p.codigo])).toEqual([
      ['a', 'R-003'],
      ['c', 'F-001'],
    ])
    expect(plan.resumen.codigosCambiados).toEqual([{ antes: 'R-001', despues: 'R-003' }])
    // Del metanol de antes no se traen movimientos ni pedidos (no se suma el stock dos veces)…
    expect(plan.movimientos.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(plan.pedidos).toEqual([])
    // …pero sus fotos pasan al metanol de hoy (primero las hechas a propósito).
    expect(plan.fotos.filter((f) => f.productoId === 'hoy1').map((f) => f.id)).toEqual(['f2', 'f3'])
    expect(plan.resumen).toMatchObject({ productosNuevos: 2, productosQueYaEstaban: 1, fotos: 3 })
  })

  it('no pasa de 20 fotos por producto', () => {
    const destino: VolcadoDatos = {
      ...vacio,
      productos: [producto('hoy1', 'R-009', 'Metanol')],
      fotos: Array.from({ length: 19 }, (_, i) => foto(`fh${i}`, 'hoy1')),
    }
    const plan = planificarMigracion(origen, destino)
    expect(plan.fotos.filter((f) => f.productoId === 'hoy1').map((f) => f.id)).toEqual(['f2'])
  })

  it('repetirla no duplica nada', () => {
    const primera = planificarMigracion(origen, vacio)
    const despues: VolcadoDatos = {
      productos: primera.productos,
      movimientos: primera.movimientos,
      fotos: primera.fotos,
      pedidos: primera.pedidos,
    }
    const segunda = planificarMigracion(origen, despues)
    expect(segunda.resumen).toMatchObject({ productosNuevos: 0, movimientos: 0, fotos: 0, pedidos: 0 })
  })
})
