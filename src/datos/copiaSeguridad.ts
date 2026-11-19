import { ErrorStock } from '../dominio/errores'
import { fechaSinHora } from '../dominio/formato'
import type { AjustesDispositivo } from './ajustes'
import type { Recuento, VolcadoDatos } from './StockRepository'
import type { FotoReferencia, LoteCerrado, Movimiento, Pedido, Producto } from './tipos'

/**
 * Copia de seguridad en JSON (CLAUDE.md §7.7): todos los datos del laboratorio, con los
 * embeddings y las miniaturas en base64. En la fase 1 los datos solo viven en el móvil, así que
 * es la única forma de no perderlos o de pasarlos a otro móvil.
 */

export const FORMATO_COPIA = 'stock-laboratorio'
export const VERSION_COPIA = 1

/** Ajustes del laboratorio que viajan con la copia (el usuario es de cada móvil y no se copia). */
export type AjustesEnCopia = Pick<AjustesDispositivo, 'laboratorio' | 'umbral' | 'temperatura'>

type FotoEnCopia = Omit<FotoReferencia, 'miniatura'> & {
  /** data:image/jpeg;base64,… */
  miniatura: string
}

export interface ArchivoCopia {
  formato: typeof FORMATO_COPIA
  version: typeof VERSION_COPIA
  exportadaEn: string
  ajustes: AjustesEnCopia
  productos: Producto[]
  movimientos: Movimiento[]
  pedidos: Pedido[]
  fotos: FotoEnCopia[]
}

export interface CopiaLeida {
  exportadaEn: string
  ajustes: Partial<AjustesEnCopia>
  datos: VolcadoDatos
  recuento: Recuento
}

/** stock-laboratorio-2026-11-19.json */
export function nombreArchivoCopia(ahora: Date): string {
  return `stock-laboratorio-${fechaSinHora(ahora)}.json`
}

export async function crearCopia(datos: VolcadoDatos, ajustes: AjustesEnCopia, ahora: Date): Promise<string> {
  const copia: ArchivoCopia = {
    formato: FORMATO_COPIA,
    version: VERSION_COPIA,
    exportadaEn: ahora.toISOString(),
    ajustes: { laboratorio: ajustes.laboratorio, umbral: ajustes.umbral, temperatura: ajustes.temperatura },
    productos: datos.productos,
    movimientos: datos.movimientos,
    pedidos: datos.pedidos,
    fotos: await Promise.all(
      datos.fotos.map(async (foto) => ({ ...foto, miniatura: await blobADataUrl(foto.miniatura) })),
    ),
  }
  return JSON.stringify(copia)
}

/** Lee y comprueba una copia. Si algo no cuadra, lanza un ErrorStock con un mensaje claro. */
export function leerCopia(texto: string): CopiaLeida {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    throw noValida('El archivo no es una copia de seguridad de esta app (no es un JSON válido).')
  }
  if (!esObjeto(bruto) || bruto.formato !== FORMATO_COPIA) {
    throw noValida('El archivo no es una copia de seguridad de esta app.')
  }
  if (typeof bruto.version !== 'number' || bruto.version > VERSION_COPIA) {
    throw noValida('La copia es de una versión más nueva de la app. Actualiza la app y vuelve a intentarlo.')
  }

  const productos = lista(bruto.productos, 'productos').map((p, i) => comprobarProducto(p, i))
  const ids = new Set<string>()
  for (const p of productos) {
    if (ids.has(p.id)) throw noValida(`Hay dos productos con el mismo identificador (${p.codigo}).`)
    ids.add(p.id)
  }
  const movimientos = lista(bruto.movimientos, 'movimientos').map((m, i) => comprobarMovimiento(m, i, ids))
  const pedidos = lista(bruto.pedidos, 'pedidos').map((p, i) => comprobarPedido(p, i, ids))
  const fotos = lista(bruto.fotos, 'fotos').map((f, i) => comprobarFoto(f, i, ids))
  for (const [nombre, elementos] of [
    ['movimientos', movimientos],
    ['pedidos', pedidos],
    ['fotos', fotos],
  ] as const) {
    if (new Set(elementos.map((e) => e.id)).size !== elementos.length) {
      throw noValida(`Hay ${nombre} repetidos en la copia.`)
    }
  }

  const ajustes = esObjeto(bruto.ajustes) ? bruto.ajustes : {}
  return {
    exportadaEn: typeof bruto.exportadaEn === 'string' ? bruto.exportadaEn : '',
    ajustes: {
      ...(typeof ajustes.laboratorio === 'string' && ajustes.laboratorio.trim()
        ? { laboratorio: ajustes.laboratorio }
        : {}),
      ...(numeroEntre(ajustes.umbral, 0, 1) ? { umbral: ajustes.umbral } : {}),
      ...(numeroEntre(ajustes.temperatura, 0, 1) && ajustes.temperatura > 0 ? { temperatura: ajustes.temperatura } : {}),
    },
    datos: { productos, movimientos, pedidos, fotos },
    recuento: {
      productos: productos.length,
      movimientos: movimientos.length,
      pedidos: pedidos.length,
      fotos: fotos.length,
    },
  }
}

// ─── Comprobaciones ─────────────────────────────────────────────────────────

type Objeto = Record<string, unknown>

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function noValida(mensaje: string): ErrorStock {
  return new ErrorStock('copia-no-valida', mensaje)
}

function lista(valor: unknown, nombre: string): Objeto[] {
  if (!Array.isArray(valor) || !valor.every(esObjeto)) throw noValida(`La copia está incompleta: faltan los ${nombre}.`)
  return valor
}

function numeroEntre(valor: unknown, min: number, max: number): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max
}

function texto(o: Objeto, campo: string, donde: string): string {
  const valor = o[campo]
  if (typeof valor !== 'string' || !valor) throw noValida(`La copia está dañada: ${donde} no tiene «${campo}».`)
  return valor
}

function numero(o: Objeto, campo: string, donde: string): number {
  const valor = o[campo]
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw noValida(`La copia está dañada: ${donde} no tiene «${campo}».`)
  }
  return valor
}

function opcional<T>(o: Objeto, campo: string, tipo: 'string' | 'number', donde: string): T | undefined {
  const valor = o[campo]
  if (valor === undefined || valor === null) return undefined
  if (typeof valor !== tipo) throw noValida(`La copia está dañada: en ${donde}, «${campo}» no es válido.`)
  return valor as T
}

function sinIndefinidos<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

function comprobarProducto(o: Objeto, i: number): Producto {
  const donde = `el producto ${i + 1}`
  const categoria = o.categoria
  if (categoria !== 'reactivo' && categoria !== 'fungible') {
    throw noValida(`La copia está dañada: ${donde} no tiene una categoría válida.`)
  }
  return sinIndefinidos<Producto>({
    id: texto(o, 'id', donde),
    codigo: texto(o, 'codigo', donde),
    nombre: texto(o, 'nombre', donde),
    categoria,
    formato: typeof o.formato === 'string' ? o.formato : '',
    unidadCorta: texto(o, 'unidadCorta', donde),
    armario: typeof o.armario === 'string' ? o.armario : '',
    balda: opcional(o, 'balda', 'string', donde),
    stockActual: numero(o, 'stockActual', donde),
    stockMinimo: numero(o, 'stockMinimo', donde),
    cantidadPedidoSugerida: opcional(o, 'cantidadPedidoSugerida', 'number', donde),
    notas: opcional(o, 'notas', 'string', donde),
    archivado: o.archivado === true,
    creadoEn: texto(o, 'creadoEn', donde),
    actualizadoEn: texto(o, 'actualizadoEn', donde),
  })
}

const TIPOS_MOVIMIENTO = new Set(['retirada_foto', 'retirada_manual', 'entrada', 'ajuste'])

function comprobarMovimiento(o: Objeto, i: number, productos: Set<string>): Movimiento {
  const donde = `el movimiento ${i + 1}`
  const productoId = texto(o, 'productoId', donde)
  if (!productos.has(productoId)) throw noValida(`La copia está dañada: ${donde} es de un producto que no está.`)
  if (typeof o.tipo !== 'string' || !TIPOS_MOVIMIENTO.has(o.tipo)) {
    throw noValida(`La copia está dañada: ${donde} no tiene un tipo válido.`)
  }
  const cierre = o.loteCerrado
  return sinIndefinidos<Movimiento>({
    id: texto(o, 'id', donde),
    productoId,
    tipo: o.tipo as Movimiento['tipo'],
    cantidad: numero(o, 'cantidad', donde),
    stockResultante: numero(o, 'stockResultante', donde),
    lote: opcional(o, 'lote', 'string', donde),
    caducidad: opcional(o, 'caducidad', 'string', donde),
    nota: opcional(o, 'nota', 'string', donde),
    confianza: opcional(o, 'confianza', 'number', donde),
    usuario: typeof o.usuario === 'string' ? o.usuario : '',
    fecha: texto(o, 'fecha', donde),
    loteCerrado:
      esObjeto(cierre) && (cierre.como === 'desechado' || cierre.como === 'agotado')
        ? sinIndefinidos<LoteCerrado>({
            como: cierre.como,
            usuario: typeof cierre.usuario === 'string' ? cierre.usuario : '',
            fecha: texto(cierre, 'fecha', donde),
            ajusteId: opcional<string>(cierre, 'ajusteId', 'string', donde),
          })
        : undefined,
  })
}

function comprobarPedido(o: Objeto, i: number, productos: Set<string>): Pedido {
  const donde = `el pedido ${i + 1}`
  const productoId = texto(o, 'productoId', donde)
  if (!productos.has(productoId)) throw noValida(`La copia está dañada: ${donde} es de un producto que no está.`)
  if (o.estado !== 'pedido' && o.estado !== 'recibido') {
    throw noValida(`La copia está dañada: ${donde} no tiene un estado válido.`)
  }
  return sinIndefinidos<Pedido>({
    id: texto(o, 'id', donde),
    productoId,
    cantidad: opcional(o, 'cantidad', 'number', donde),
    estado: o.estado,
    fechaPedido: texto(o, 'fechaPedido', donde),
    fechaRecepcion: opcional(o, 'fechaRecepcion', 'string', donde),
  })
}

function comprobarFoto(o: Objeto, i: number, productos: Set<string>): FotoReferencia {
  const donde = `la foto ${i + 1}`
  const productoId = texto(o, 'productoId', donde)
  if (!productos.has(productoId)) throw noValida(`La copia está dañada: ${donde} es de un producto que no está.`)
  const embedding = o.embedding
  if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every((v) => typeof v === 'number')) {
    throw noValida(`La copia está dañada: ${donde} no tiene sus datos de reconocimiento.`)
  }
  if (o.origen !== 'alta' && o.origen !== 'confirmacion') {
    throw noValida(`La copia está dañada: ${donde} no tiene un origen válido.`)
  }
  return {
    id: texto(o, 'id', donde),
    productoId,
    embedding: embedding as number[],
    miniatura: dataUrlABlob(texto(o, 'miniatura', donde), donde),
    origen: o.origen,
    creadoEn: texto(o, 'creadoEn', donde),
  }
}

// ─── Miniaturas ─────────────────────────────────────────────────────────────

async function blobADataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binario)}`
}

function dataUrlABlob(dataUrl: string, donde: string): Blob {
  const partes = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]*)$/.exec(dataUrl)
  if (!partes) throw noValida(`La copia está dañada: ${donde} no tiene una miniatura válida.`)
  const binario = atob(partes[2] ?? '')
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: partes[1] })
}
