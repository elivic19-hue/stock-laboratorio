import { describe, expect, it } from 'vitest'
import { crearDatosEjemplo } from '../datos/ejemplo'
import type { Movimiento, Producto } from '../datos/tipos'
import { calcularResumen, entradasQueCaducanPronto } from './resumen'

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
      entrada('a', '2026-11-18'), // ya caducado: no (pendiente de decidir, duda 7)
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
