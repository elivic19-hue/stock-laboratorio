import type { CambiosProducto, DatosProductoNuevo } from '../datos/StockRepository'
import type { Categoria, Producto } from '../datos/tipos'
import { sinIndefinidos, textoOpcional } from '../datos/utilidades'
import { normalizarCodigo } from './codigos'
import { ErrorStock } from './errores'

const CATEGORIAS: readonly Categoria[] = ['reactivo', 'fungible']

function exigirTexto(valor: string | undefined, mensaje: string): string {
  const limpio = valor?.trim()
  if (!limpio) throw new ErrorStock('datos-no-validos', mensaje)
  return limpio
}

function exigirNumero(valor: number, minimo: number, mensaje: string): number {
  if (!Number.isFinite(valor) || valor < minimo) throw new ErrorStock('datos-no-validos', mensaje)
  return valor
}

function cantidadSugeridaValida(valor: number | undefined): number | undefined {
  if (valor === undefined) return undefined
  return exigirNumero(valor, 0, 'La cantidad de pedido sugerida no puede ser negativa.') || undefined
}

/** Datos de alta revisados: textos recortados, opcionales vacíos fuera y números válidos. */
export function limpiarDatosProducto(datos: DatosProductoNuevo): DatosProductoNuevo {
  if (!CATEGORIAS.includes(datos.categoria)) {
    throw new ErrorStock('datos-no-validos', 'La categoría tiene que ser reactivo o fungible.')
  }
  const codigo = textoOpcional(datos.codigo)
  const stockInicial = exigirNumero(datos.stockInicial, 0, 'El stock inicial no puede ser negativo.')
  const loteInicial = textoOpcional(datos.loteInicial)
  if (loteInicial !== undefined && stockInicial <= 0) {
    throw new ErrorStock('datos-no-validos', 'El lote va con el stock inicial: indica cuántas unidades hay.')
  }
  return sinIndefinidos({
    codigo: codigo === undefined ? undefined : normalizarCodigo(codigo),
    nombre: exigirTexto(datos.nombre, 'Falta el nombre del producto.'),
    categoria: datos.categoria,
    formato: exigirTexto(datos.formato, 'Falta el formato (p. ej. «Botella 1 L»).'),
    unidadCorta: exigirTexto(datos.unidadCorta, 'Falta la unidad (p. ej. «bot.»).'),
    armario: exigirTexto(datos.armario, 'Falta el armario.'),
    balda: textoOpcional(datos.balda),
    stockMinimo: exigirNumero(datos.stockMinimo, 0, 'El stock mínimo no puede ser negativo.'),
    cantidadPedidoSugerida: cantidadSugeridaValida(datos.cantidadPedidoSugerida),
    notas: textoOpcional(datos.notas),
    stockInicial,
    loteInicial,
  })
}

/**
 * Producto tras aplicar los cambios, revisado. Solo se aplican los campos editables: el stock
 * cambia únicamente con movimientos. Un opcional vacío («balda: ''») borra el valor.
 */
export function aplicarCambiosProducto(actual: Producto, cambios: CambiosProducto, ahora: string): Producto {
  const siguiente: Producto = { ...actual, actualizadoEn: ahora }

  if (cambios.codigo !== undefined) {
    siguiente.codigo = normalizarCodigo(exigirTexto(cambios.codigo, 'El código no puede quedar vacío.'))
  }
  if (cambios.nombre !== undefined) siguiente.nombre = exigirTexto(cambios.nombre, 'Falta el nombre del producto.')
  if (cambios.categoria !== undefined) {
    if (!CATEGORIAS.includes(cambios.categoria)) {
      throw new ErrorStock('datos-no-validos', 'La categoría tiene que ser reactivo o fungible.')
    }
    siguiente.categoria = cambios.categoria
  }
  if (cambios.formato !== undefined) siguiente.formato = exigirTexto(cambios.formato, 'Falta el formato.')
  if (cambios.unidadCorta !== undefined) siguiente.unidadCorta = exigirTexto(cambios.unidadCorta, 'Falta la unidad.')
  if (cambios.armario !== undefined) siguiente.armario = exigirTexto(cambios.armario, 'Falta el armario.')
  if ('balda' in cambios) siguiente.balda = textoOpcional(cambios.balda)
  if (cambios.stockMinimo !== undefined) {
    siguiente.stockMinimo = exigirNumero(cambios.stockMinimo, 0, 'El stock mínimo no puede ser negativo.')
  }
  if ('cantidadPedidoSugerida' in cambios) {
    siguiente.cantidadPedidoSugerida = cantidadSugeridaValida(cambios.cantidadPedidoSugerida)
  }
  if ('notas' in cambios) siguiente.notas = textoOpcional(cambios.notas)
  if (cambios.archivado !== undefined) siguiente.archivado = cambios.archivado

  return sinIndefinidos(siguiente)
}
