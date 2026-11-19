import { describe, expect, it } from 'vitest'
import { crearCopia, leerCopia, nombreArchivoCopia } from './copiaSeguridad'
import { crearDatosEjemplo } from './ejemplo'
import type { VolcadoDatos } from './StockRepository'

const ahora = new Date(2026, 10, 19, 18, 30)
const ajustes = { laboratorio: 'Lab. caracterización', umbral: 0.62, temperatura: 0.04 }

function conFotos(): VolcadoDatos {
  const datos = crearDatosEjemplo(ahora)
  const producto = datos.productos[0]
  if (!producto) throw new Error('Sin productos de ejemplo')
  const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) % 256)
  return {
    ...datos,
    fotos: [
      {
        id: 'foto-1',
        productoId: producto.id,
        embedding: [0.6, -0.8, 0.000123456789],
        miniatura: new Blob([bytes], { type: 'image/jpeg' }),
        origen: 'alta',
        creadoEn: ahora.toISOString(),
      },
    ],
  }
}

async function bytesDe(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())]
}

describe('copia de seguridad', () => {
  it('se recupera tal cual, con embeddings y miniaturas', async () => {
    const datos = conFotos()
    const texto = await crearCopia(datos, { ...ajustes, usuario: 'JA' } as typeof ajustes, ahora)
    const leida = leerCopia(texto)

    expect(leida.exportadaEn).toBe(ahora.toISOString())
    expect(leida.ajustes).toEqual(ajustes)
    expect(texto).not.toContain('"usuario":"JA"') // el usuario es de cada móvil
    expect(leida.datos.productos).toEqual(datos.productos)
    expect(leida.datos.movimientos).toEqual(datos.movimientos)
    expect(leida.datos.pedidos).toEqual(datos.pedidos)
    expect(leida.recuento).toEqual({
      productos: datos.productos.length,
      movimientos: datos.movimientos.length,
      pedidos: datos.pedidos.length,
      fotos: 1,
    })

    const [original] = datos.fotos
    const [recuperada] = leida.datos.fotos
    expect(recuperada?.embedding).toEqual(original?.embedding)
    expect(recuperada?.miniatura.type).toBe('image/jpeg')
    expect(await bytesDe(recuperada!.miniatura)).toEqual(await bytesDe(original!.miniatura))
  })

  it('rechaza lo que no es una copia de la app', () => {
    expect(() => leerCopia('hola')).toThrow('no es un JSON válido')
    expect(() => leerCopia('{"formato":"otra-cosa"}')).toThrow('no es una copia de seguridad de esta app')
    expect(() => leerCopia('{"formato":"stock-laboratorio","version":99}')).toThrow('versión más nueva')
  })

  it('rechaza copias dañadas sin tocar nada', async () => {
    const copia = JSON.parse(await crearCopia(conFotos(), ajustes, ahora)) as Record<string, unknown[]>

    const sinProductos = { ...copia, productos: undefined }
    expect(() => leerCopia(JSON.stringify(sinProductos))).toThrow('faltan los productos')

    const huerfano = { ...copia, movimientos: [{ ...(copia.movimientos?.[0] as object), productoId: 'no-existe' }] }
    expect(() => leerCopia(JSON.stringify(huerfano))).toThrow('un producto que no está')

    const stockMalo = { ...copia, productos: [{ ...(copia.productos?.[0] as object), stockActual: '3' }] }
    expect(() => leerCopia(JSON.stringify(stockMalo))).toThrow('«stockActual»')

    const fotoMala = { ...copia, fotos: [{ ...(copia.fotos?.[0] as object), miniatura: 'no-es-base64' }] }
    expect(() => leerCopia(JSON.stringify(fotoMala))).toThrow('miniatura válida')

    const repetido = { ...copia, pedidos: [copia.pedidos?.[0], copia.pedidos?.[0]] }
    expect(() => leerCopia(JSON.stringify(repetido))).toThrow('pedidos repetidos')
  })

  it('ignora ajustes fuera de rango', async () => {
    const copia = JSON.parse(await crearCopia(conFotos(), ajustes, ahora)) as Record<string, unknown>
    const leida = leerCopia(JSON.stringify({ ...copia, ajustes: { laboratorio: ' ', umbral: 7, temperatura: 0 } }))
    expect(leida.ajustes).toEqual({})
  })

  it('nombra el archivo con la fecha', () => {
    expect(nombreArchivoCopia(ahora)).toBe('stock-laboratorio-2026-11-19.json')
  })
})
