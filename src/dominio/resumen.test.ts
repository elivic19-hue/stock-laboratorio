import { describe, expect, it } from 'vitest'
import { crearDatosEjemplo } from '../datos/ejemplo'
import type { Movimiento, Producto } from '../datos/tipos'
import { calcularResumen, entradasQueCaducanPronto, lotesCaducados } from './resumen'

const hoy = new Date(2026, 10, 19, 18, 30)

describe('calcularResumen', () => {
  it('con los datos de ejemplo da los números de las maquetas', () => {
    const { productos, pedidos, movimientos } = crearDatosEjemplo(hoy)
    expect(calcularResumen(productos, pedidos, movimientos, hoy)).toEqual({
      productos: 9,
      reactivos: 3,
      fungible: 6,
      aPedir: 4,
      caducanPronto: 1,
      caducados: 1,
    })
  })
})

describe('entradasQueCaducanPronto', () => {
  const producto = (id: string, stockActual: number, archivado = false): Producto => ({
    id,
    codigo: id,
    nombre: id,
    categoria: 'reactivo',
    formato: 'Botella 1 L',
    unidadCorta: 'bot.',
    armario: 'Armario 1',
    stockActual,
    stockMinimo: 1,
    archivado,
    creadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  })
  const entrada = (productoId: string, caducidad?: string): Movimiento => ({
    id: `${productoId}-${caducidad ?? 'sin'}`,
    productoId,
    tipo: 'entrada',
    cantidad: 1,
    stockResultante: 1,
    usuario: 'JA',
    fecha: '2026-10-01T08:00:00.000Z',
    ...(caducidad ? { caducidad } : {}),
  })

  it('cuenta de hoy a dentro de 30 días, solo si el producto tiene stock', () => {
    const productos = [producto('a', 2), producto('b', 0), producto('c', 3, true)]
    const movimientos = [
      entrada('a', '2026-11-19'), // hoy: sí
      entrada('a', '2026-12-19'), // dentro de 30 días: sí
      entrada('a', '2026-12-20'), // dentro de 31: no
      entrada('a', '2026-11-18'), // ya caducado: no (va en lotesCaducados)
      entrada('a'), // sin caducidad: no
      entrada('b', '2026-11-25'), // sin stock: no
      entrada('c', '2026-11-25'), // archivado: no
    ]
    expect(entradasQueCaducanPronto(productos, movimientos, hoy).map((m) => m.caducidad)).toEqual([
      '2026-11-19',
      '2026-12-19',
    ])
  })
})

describe('lotesCaducados', () => {
  const p = (id: string, stockActual: number): Producto => ({
    id,
    codigo: id,
    nombre: id,
    categoria: 'reactivo',
    formato: 'Botella 1 L',
    unidadCorta: 'bot.',
    armario: 'Armario 1',
    stockActual,
    stockMinimo: 1,
    archivado: false,
    creadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  })
  const entrada = (id: string, productoId: string, caducidad: string, cerrado = false): Movimiento => ({
    id,
    productoId,
    tipo: 'entrada',
    cantidad: 1,
    stockResultante: 1,
    usuario: 'JA',
    fecha: '2026-09-01T08:00:00.000Z',
    caducidad,
    ...(cerrado ? { loteCerrado: { como: 'agotado' as const, usuario: 'MG', fecha: '2026-11-10T08:00:00.000Z' } } : {}),
  })

  it('cuenta los lotes con la caducidad pasada, de productos con stock, hasta que se cierran', () => {
    const productos = [p('a', 2), p('b', 0)]
    const movimientos = [
      entrada('vencido', 'a', '2026-10-31'),
      entrada('mas-antiguo', 'a', '2026-08-31'),
      entrada('cerrado', 'a', '2026-09-30', true),
      entrada('hoy', 'a', '2026-11-19'), // caduca hoy: aún vale, cuenta en «caducan <30 d»
      entrada('sin-stock', 'b', '2026-10-31'),
    ]
    expect(lotesCaducados(productos, movimientos, hoy).map((m) => m.id)).toEqual(['mas-antiguo', 'vencido'])
    expect(entradasQueCaducanPronto(productos, movimientos, hoy).map((m) => m.id)).toEqual(['hoy'])
  })

  it('un lote cerrado tampoco cuenta en «caducan <30 d»', () => {
    const movimientos = [entrada('pronto', 'a', '2026-11-30', true)]
    expect(entradasQueCaducanPronto([p('a', 2)], movimientos, hoy)).toEqual([])
  })
})
