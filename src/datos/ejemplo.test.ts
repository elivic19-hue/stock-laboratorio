import { describe, expect, it } from 'vitest'
import { formatearDiaMes, formatearMomento } from '../dominio/formato'
import { crearDatosEjemplo } from './ejemplo'

const ahora = new Date(2026, 10, 19, 18, 30)
const datos = crearDatosEjemplo(ahora)
const porCodigo = new Map(datos.productos.map((p) => [p.codigo, p]))

describe('datos de ejemplo', () => {
  it('son los productos de las maquetas, con su stock', () => {
    const stock = Object.fromEntries(datos.productos.map((p) => [p.codigo, p.stockActual]))
    expect(stock).toEqual({
      'R-014': 1, // Etanol absoluto
      'R-022': 3, // Isooctano
      'R-031': 2, // Ácido acético 3 %
      'F-031': 12, // Puntas 1000 µL
      'F-030': 4, // Puntas 200 µL
      'F-012': 150, // Tapones rosca
      'F-029': 6, // Puntas 10 µL
      'F-007': 1, // Guantes nitrilo M
      'F-024': 0, // Filtros jeringa
    })
  })

  it('tienen identificadores únicos', () => {
    const ids = [...datos.productos, ...datos.movimientos, ...datos.pedidos].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('el stock de cada producto cuadra con su historial', () => {
    for (const producto of datos.productos) {
      const propios = datos.movimientos
        .filter((m) => m.productoId === producto.id)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
      let stock = 0
      for (const m of propios) {
        stock += m.cantidad
        expect(m.stockResultante).toBe(stock)
      }
      expect(producto.stockActual).toBe(stock)
    }
  })

  it('no tienen fechas en el futuro y reproducen las de las maquetas', () => {
    const fechas = [...datos.movimientos.map((m) => m.fecha), ...datos.pedidos.map((p) => p.fechaPedido)]
    expect(fechas.every((f) => Date.parse(f) <= ahora.getTime())).toBe(true)

    const etanol = porCodigo.get('R-014')
    const ultimoEtanol = datos.movimientos
      .filter((m) => m.productoId === etanol?.id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    expect(ultimoEtanol && formatearMomento(ultimoEtanol.fecha, ahora)).toBe('hoy 08:12')

    const enCurso = datos.pedidos.filter((p) => p.estado === 'pedido')
    expect(enCurso.map((p) => formatearDiaMes(p.fechaPedido, ahora))).toEqual(['14 nov', '17 nov'])
  })

  it('el pedido recibido queda enlazado con su entrada', () => {
    const recibido = datos.pedidos.find((p) => p.estado === 'recibido')
    const entrada = datos.movimientos.find((m) => m.tipo === 'entrada' && m.fecha === recibido?.fechaRecepcion)
    expect(entrada?.productoId).toBe(porCodigo.get('F-031')?.id)
    expect(entrada?.cantidad).toBe(10)
  })

  it('si se cargan de madrugada, el «hoy 08:12» no queda en el futuro', () => {
    const temprano = new Date(2026, 10, 19, 7, 0)
    const madrugada = crearDatosEjemplo(temprano)
    expect(madrugada.movimientos.every((m) => Date.parse(m.fecha) <= temprano.getTime())).toBe(true)
  })
})
