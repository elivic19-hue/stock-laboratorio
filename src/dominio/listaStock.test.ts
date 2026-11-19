import { describe, expect, it } from 'vitest'
import { crearDatosEjemplo } from '../datos/ejemplo'
import type { Movimiento, Producto } from '../datos/tipos'
import { coincideBusqueda, normalizarTexto } from './busqueda'
import {
  OPCIONES_LISTA_INICIALES,
  agruparPorArmario,
  contarPorCategoria,
  filtrarSinCategoria,
  infoPorProducto,
  lineaSecundaria,
} from './listaStock'

const ahora = new Date(2026, 10, 19, 18, 30)

function producto(parcial: Partial<Producto>): Producto {
  return {
    id: 'p',
    codigo: 'R-001',
    nombre: 'Etanol absoluto',
    categoria: 'reactivo',
    formato: 'Botella 1 L',
    unidadCorta: 'bot.',
    armario: 'Armario inflamables',
    balda: 'Balda 2',
    stockActual: 5,
    stockMinimo: 3,
    archivado: false,
    creadoEn: '2026-11-01T08:00:00.000Z',
    actualizadoEn: '2026-11-01T08:00:00.000Z',
    ...parcial,
  }
}

function movimiento(parcial: Partial<Movimiento>): Movimiento {
  return {
    id: Math.random().toString(36),
    productoId: 'p',
    tipo: 'retirada_manual',
    cantidad: -1,
    stockResultante: 4,
    usuario: 'MG',
    fecha: new Date(2026, 10, 10, 9, 0).toISOString(),
    ...parcial,
  }
}

describe('búsqueda', () => {
  const puntas = producto({
    nombre: 'Puntas de pipeta 1000 µL',
    codigo: 'F-031',
    formato: 'Rack 96 uds',
    armario: 'Armario 2',
    balda: 'Balda 3',
  })

  it('no distingue mayúsculas ni tildes', () => {
    expect(normalizarTexto('  Ácido   ACÉTICO ')).toBe('acido acetico')
    expect(coincideBusqueda(producto({ nombre: 'Ácido acético 3 %' }), 'acido')).toBe(true)
  })

  it('busca por nombre, código y ubicación, con todas las palabras', () => {
    expect(coincideBusqueda(puntas, 'puntas 1000')).toBe(true)
    expect(coincideBusqueda(puntas, 'puntas 200')).toBe(false)
    expect(coincideBusqueda(puntas, 'f-031')).toBe(true)
    expect(coincideBusqueda(puntas, 'armario 2')).toBe(true)
    expect(coincideBusqueda(puntas, 'arm. 2 b3')).toBe(true)
    expect(coincideBusqueda(puntas, 'balda 3')).toBe(true)
    expect(coincideBusqueda(puntas, 'rack')).toBe(true)
    expect(coincideBusqueda(puntas, '')).toBe(true)
  })
})

describe('lineaSecundaria', () => {
  const p = producto({})

  it('último movimiento si es de hoy', () => {
    const info = { ultimoMovimiento: movimiento({ fecha: new Date(2026, 10, 19, 8, 12).toISOString() }) }
    expect(lineaSecundaria(p, info, ahora)).toBe('Botella 1 L · últ. mov. hoy 08:12')
  })

  it('primero, un lote ya caducado', () => {
    const info = {
      ultimoMovimiento: movimiento({ fecha: new Date(2026, 10, 19, 8, 12).toISOString() }),
      caducidadVencida: '2026-10-31',
    }
    expect(lineaSecundaria(p, info, ahora)).toBe('Botella 1 L · cad. 10/2026')
  })

  it('si no, la caducidad cercana en mes/año', () => {
    const info = { ultimoMovimiento: movimiento({}), caducidadProxima: '2026-12-31' }
    expect(lineaSecundaria(p, info, ahora)).toBe('Botella 1 L · cad. 12/2026')
  })

  it('si no, la balda', () => {
    expect(lineaSecundaria(p, { ultimoMovimiento: movimiento({}) }, ahora)).toBe('Botella 1 L · balda 2')
    expect(lineaSecundaria(producto({ balda: undefined }), undefined, ahora)).toBe('Botella 1 L')
  })
})

describe('infoPorProducto', () => {
  it('guarda el último movimiento y la caducidad más cercana', () => {
    const p = producto({ stockActual: 3 })
    const movimientos = [
      movimiento({ id: 'a', fecha: '2026-11-10T09:00:00.000Z' }),
      movimiento({ id: 'b', fecha: '2026-11-12T09:00:00.000Z' }),
      movimiento({ id: 'c', tipo: 'entrada', cantidad: 2, caducidad: '2026-12-15', fecha: '2026-11-01T09:00:00.000Z' }),
      movimiento({ id: 'd', tipo: 'entrada', cantidad: 2, caducidad: '2026-11-30', fecha: '2026-10-01T09:00:00.000Z' }),
    ]
    const info = infoPorProducto([p], movimientos, ahora).get('p')
    expect(info?.ultimoMovimiento?.id).toBe('b')
    expect(info?.caducidadProxima).toBe('2026-11-30')
  })
})

describe('lista agrupada por armario', () => {
  const { productos, movimientos } = crearDatosEjemplo(ahora)
  const info = infoPorProducto(productos, movimientos, ahora)

  it('agrupa por armario en orden natural y ordena dentro de cada grupo', () => {
    const grupos = agruparPorArmario(filtrarSinCategoria(productos, info, OPCIONES_LISTA_INICIALES), 'nombre')
    expect(grupos.map((g) => g.armario)).toEqual([
      'Armario 1',
      'Armario 2',
      'Armario ácidos',
      'Armario inflamables',
    ])
    expect(grupos[3]?.productos.map((p) => p.codigo)).toEqual(['R-014', 'R-022'])
  })

  it('junta armarios escritos con distintas mayúsculas', () => {
    const grupos = agruparPorArmario([producto({ id: 'a', armario: 'Armario 2' }), producto({ id: 'b', armario: 'armario 2 ' })], 'nombre')
    expect(grupos).toHaveLength(1)
  })

  it('ordena por urgencia: primero lo bajo mínimo y lo más justo', () => {
    const lista = [
      producto({ id: 'holgado', nombre: 'A', stockActual: 10, stockMinimo: 2 }),
      producto({ id: 'justo', nombre: 'B', stockActual: 3, stockMinimo: 2 }),
      producto({ id: 'bajo', nombre: 'C', stockActual: 2, stockMinimo: 2 }),
      producto({ id: 'agotado', nombre: 'D', stockActual: 0, stockMinimo: 5 }),
    ]
    const [grupo] = agruparPorArmario(lista, 'urgencia')
    expect(grupo?.productos.map((p) => p.id)).toEqual(['agotado', 'bajo', 'justo', 'holgado'])
  })

  it('filtra bajo mínimo, caducidad próxima y archivados, y cuenta por categoría', () => {
    const conArchivado = [...productos, producto({ id: 'viejo', archivado: true })]
    const base = { ...OPCIONES_LISTA_INICIALES }
    const todos = filtrarSinCategoria(conArchivado, info, base)
    expect(contarPorCategoria(todos)).toEqual({ todos: 9, reactivo: 3, fungible: 6 })
    expect(filtrarSinCategoria(productos, info, { ...base, soloBajoMinimo: true }).map((p) => p.codigo).sort()).toEqual(
      ['F-007', 'F-012', 'F-024', 'F-030', 'R-014', 'R-031'],
    )
    expect(
      filtrarSinCategoria(productos, info, { ...base, soloCaducanPronto: true })
        .map((p) => p.codigo)
        .sort(),
    ).toEqual(['R-022', 'R-031'])
    expect(filtrarSinCategoria(productos, info, { ...base, texto: 'puntas' })).toHaveLength(3)
  })
})
