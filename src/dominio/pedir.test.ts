import { describe, expect, it } from 'vitest'
import type { Pedido, Producto } from '../datos/tipos'
import { csvListaPedir, listaAPedir, pedidosEnCurso, textoListaPedir } from './pedir'

function producto(parcial: Partial<Producto>): Producto {
  return {
    id: 'p',
    codigo: 'R-001',
    nombre: 'Etanol absoluto 1 L',
    categoria: 'reactivo',
    formato: 'Botella 1 L',
    unidadCorta: 'bot.',
    armario: 'Armario inflamables',
    balda: 'Balda 2',
    stockActual: 1,
    stockMinimo: 3,
    cantidadPedidoSugerida: 6,
    archivado: false,
    creadoEn: '2026-11-01T08:00:00.000Z',
    actualizadoEn: '2026-11-01T08:00:00.000Z',
    ...parcial,
  }
}

function pedido(parcial: Partial<Pedido>): Pedido {
  return { id: 'x', productoId: 'p', estado: 'pedido', fechaPedido: '2026-11-14T09:00:00.000Z', ...parcial }
}

const etanol = producto({ id: 'e', codigo: 'R-014' })
const puntas = producto({
  id: 'p2',
  codigo: 'F-012',
  nombre: 'Puntas de pipeta 200 µL',
  categoria: 'fungible',
  formato: 'Rack 96 uds',
  unidadCorta: 'racks',
  armario: 'Armario 2',
  balda: 'Balda 3',
  stockActual: 4,
  stockMinimo: 5,
  cantidadPedidoSugerida: 10,
})
const acido = producto({ id: 'a', codigo: 'R-031', nombre: 'Ácido acético 3 %', stockActual: 2, stockMinimo: 2 })
const sobrado = producto({ id: 's', codigo: 'R-002', stockActual: 9 })

describe('listaAPedir', () => {
  it('pone primero lo que menos tiene respecto a su mínimo', () => {
    const lista = listaAPedir([acido, sobrado, puntas, etanol], [])
    expect(lista.map((p) => p.codigo)).toEqual(['R-014', 'F-012', 'R-031'])
  })

  it('deja fuera lo que ya está pedido (duda 6) y lo archivado', () => {
    const lista = listaAPedir([etanol, puntas, { ...acido, archivado: true }], [pedido({ productoId: 'e' })])
    expect(lista.map((p) => p.codigo)).toEqual(['F-012'])
  })

  it('con mínimo 0, primero el que se ha quedado sin nada', () => {
    const sinMinimo = producto({ id: 'z', codigo: 'R-050', stockActual: 0, stockMinimo: 0 })
    expect(listaAPedir([acido, sinMinimo], []).map((p) => p.codigo)).toEqual(['R-050', 'R-031'])
  })
})

describe('pedidosEnCurso', () => {
  it('solo los no recibidos, del más antiguo al más reciente, con su producto', () => {
    const lista = pedidosEnCurso(
      [etanol, puntas],
      [
        pedido({ id: '1', productoId: 'p2', fechaPedido: '2026-11-17T09:00:00.000Z' }),
        pedido({ id: '2', productoId: 'e', fechaPedido: '2026-11-14T09:00:00.000Z' }),
        pedido({ id: '3', productoId: 'e', estado: 'recibido' }),
        pedido({ id: '4', productoId: 'no-existe' }),
      ],
    )
    expect(lista.map((p) => [p.pedido.id, p.producto.codigo])).toEqual([
      ['2', 'R-014'],
      ['1', 'F-012'],
    ])
  })
})

describe('textoListaPedir', () => {
  const ahora = new Date(2026, 10, 19, 10, 0)

  it('genera un texto limpio para compartir', () => {
    expect(textoListaPedir([etanol, puntas], 'Lab. caracterización', ahora)).toBe(
      'A pedir · Lab. caracterización · 19/11/2026\n\n' +
        '• Etanol absoluto 1 L: pedir 6 bot.\n' +
        '  R-014 · Botella 1 L · quedan 1, mínimo 3\n' +
        '• Puntas de pipeta 200 µL: pedir 10 racks\n' +
        '  F-012 · Rack 96 uds · quedan 4, mínimo 5\n\n' +
        '2 productos.',
    )
  })

  it('sin cantidad sugerida no inventa una, y usa coma decimal', () => {
    const texto = textoListaPedir(
      [producto({ cantidadPedidoSugerida: undefined, stockActual: 0.5, stockMinimo: 1.5 })],
      '',
      ahora,
    )
    expect(texto).toBe(
      'A pedir · 19/11/2026\n\n• Etanol absoluto 1 L\n  R-001 · Botella 1 L · quedan 0,5, mínimo 1,5\n\n1 producto.',
    )
  })
})

describe('csvListaPedir', () => {
  it('separa con punto y coma, usa coma decimal y entrecomilla lo necesario', () => {
    const csv = csvListaPedir([
      etanol,
      producto({ codigo: 'R-099', nombre: 'Disolución "A"; 0,1 M', stockActual: 12500, cantidadPedidoSugerida: 2.5 }),
    ])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Código;Producto;Formato;Quedan;Mínimo;Pedir;Unidad;Ubicación',
      'R-014;Etanol absoluto 1 L;Botella 1 L;1;3;6;bot.;Armario inflamables · Balda 2',
      'R-099;"Disolución ""A""; 0,1 M";Botella 1 L;12500;3;2,5;bot.;Armario inflamables · Balda 2',
      '',
    ])
  })
})
