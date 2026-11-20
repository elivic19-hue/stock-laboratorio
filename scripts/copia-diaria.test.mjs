// La copia diaria de GitHub tiene que poder restaurarse con la app: se comprueba con su propio lector.
import { describe, expect, it } from 'vitest'
import { leerCopia } from '../src/datos/copiaSeguridad.ts'
import { crearArchivoCopia, documentoAFila } from './copia-diaria.mjs'

const RUTA = 'projects/p/databases/(default)/documents/laboratorios/cromatografia'
const texto = (v) => ({ stringValue: v })
const entero = (v) => ({ integerValue: String(v) })

/** Documentos como los devuelve la API REST de Firestore. */
const documentos = {
  productos: [
    {
      name: `${RUTA}/productos/p1`,
      fields: {
        codigo: texto('R-001'),
        nombre: texto('Acetonitrilo HPLC'),
        categoria: texto('reactivo'),
        formato: texto('Botella 2,5 L'),
        unidadCorta: texto('bot.'),
        armario: texto('Armario 1'),
        stockActual: entero(3),
        stockMinimo: { doubleValue: 1.5 },
        archivado: { booleanValue: false },
        creadoEn: texto('2026-11-19T09:00:00.000Z'),
        actualizadoEn: texto('2026-11-19T09:00:00.000Z'),
        borrado: { booleanValue: false },
        modificadoEn: { timestampValue: '2026-11-19T09:00:01.000Z' },
      },
    },
    { name: `${RUTA}/productos/borrado`, fields: { borrado: { booleanValue: true } } },
  ],
  movimientos: [
    {
      name: `${RUTA}/movimientos/m1`,
      fields: {
        productoId: texto('p1'),
        tipo: texto('entrada'),
        cantidad: entero(3),
        stockResultante: entero(3),
        lote: texto('4920113'),
        caducidad: texto('2028-01-31'),
        usuario: texto('JA'),
        fecha: texto('2026-11-19T09:00:00.000Z'),
        loteCerrado: {
          mapValue: { fields: { como: texto('agotado'), usuario: texto('JA'), fecha: texto('2026-11-20T09:00:00.000Z') } },
        },
      },
    },
  ],
  fotos: [
    {
      name: `${RUTA}/fotos/f1`,
      fields: {
        productoId: texto('p1'),
        embedding: { arrayValue: { values: [{ doubleValue: 0.6 }, { doubleValue: 0.8 }] } },
        miniatura: { bytesValue: Buffer.from('jpeg').toString('base64') },
        origen: texto('alta'),
        creadoEn: texto('2026-11-19T09:00:00.000Z'),
      },
    },
  ],
  pedidos: [],
}

describe('copia diaria', () => {
  it('se restaura con la app: mismos datos, sin lo borrado', async () => {
    const filas = Object.fromEntries(
      Object.entries(documentos).map(([tabla, docs]) => [tabla, docs.map(documentoAFila).filter(Boolean)]),
    )
    const archivo = crearArchivoCopia('Lab. Cromatografía', filas, new Date('2026-11-21T06:00:00.000Z'))
    const copia = leerCopia(archivo)
    expect(copia.recuento).toEqual({ productos: 1, movimientos: 1, pedidos: 0, fotos: 1 })
    expect(copia.ajustes).toEqual({ laboratorio: 'Lab. Cromatografía' })
    const [producto] = copia.datos.productos
    expect(producto).toMatchObject({ id: 'p1', codigo: 'R-001', stockActual: 3, stockMinimo: 1.5 })
    expect(producto && 'borrado' in producto).toBe(false)
    expect(producto && 'modificadoEn' in producto).toBe(false)
    expect(copia.datos.movimientos[0]).toMatchObject({ lote: '4920113', loteCerrado: { como: 'agotado' } })
    const [foto] = copia.datos.fotos
    expect(foto?.embedding).toEqual([0.6, 0.8])
    expect(await foto?.miniatura.text()).toBe('jpeg')
  })
})
