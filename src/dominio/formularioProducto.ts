import type { DatosProductoNuevo } from '../datos/StockRepository'
import type { Categoria, Producto } from '../datos/tipos'
import { leerMesAnio } from './caducidad'
import { leerNumero, numeroParaCampo } from './numeros'

/** Lo que hay escrito en el formulario de alta o edición (todo texto, como en los campos). */
export interface ValoresProducto {
  categoria: Categoria
  codigo: string
  nombre: string
  formato: string
  unidadCorta: string
  armario: string
  balda: string
  stockMinimo: string
  cantidadPedidoSugerida: string
  /** Solo en el alta. */
  stockInicial: string
  /** Solo en el alta: lote de ese stock inicial (opcional). */
  loteInicial: string
  /** Solo en el alta: caducidad de ese stock inicial, «MM / AAAA» (opcional). */
  caducidadInicial: string
  notas: string
}

export type CampoProducto = keyof ValoresProducto

export type ErroresProducto = Partial<Record<CampoProducto, string>>

export const VALORES_PRODUCTO_VACIOS: ValoresProducto = {
  categoria: 'reactivo',
  codigo: '',
  nombre: '',
  formato: '',
  unidadCorta: '',
  armario: '',
  balda: '',
  stockMinimo: '',
  cantidadPedidoSugerida: '',
  stockInicial: '0',
  loteInicial: '',
  caducidadInicial: '',
  notas: '',
}

export function valoresDeProducto(p: Producto): ValoresProducto {
  return {
    categoria: p.categoria,
    codigo: p.codigo,
    nombre: p.nombre,
    formato: p.formato,
    unidadCorta: p.unidadCorta,
    armario: p.armario,
    balda: p.balda ?? '',
    stockMinimo: numeroParaCampo(p.stockMinimo),
    cantidadPedidoSugerida: numeroParaCampo(p.cantidadPedidoSugerida),
    stockInicial: numeroParaCampo(p.stockActual),
    loteInicial: '',
    caducidadInicial: '',
    notas: p.notas ?? '',
  }
}

/** Orden de los campos en pantalla (para llevar el foco al primer error). */
export const ORDEN_CAMPOS: readonly CampoProducto[] = [
  'nombre',
  'categoria',
  'codigo',
  'formato',
  'unidadCorta',
  'armario',
  'balda',
  'stockMinimo',
  'cantidadPedidoSugerida',
  'stockInicial',
  'loteInicial',
  'caducidadInicial',
  'notas',
]

export type ResultadoFormulario =
  | { valido: true; datos: DatosProductoNuevo }
  | { valido: false; errores: ErroresProducto }

/**
 * Revisa el formulario y devuelve los datos listos para el repositorio o los errores de cada
 * campo. En la edición (`esAlta: false`) el código es obligatorio y no se mira el stock inicial.
 */
export function validarFormularioProducto(v: ValoresProducto, { esAlta }: { esAlta: boolean }): ResultadoFormulario {
  const errores: ErroresProducto = {}
  const obligatorio = (campo: CampoProducto, mensaje: string) => {
    const valor = v[campo].trim()
    if (!valor) errores[campo] = mensaje
    return valor
  }
  const numero = (campo: CampoProducto, { opcional }: { opcional: boolean }): number | undefined => {
    const texto = v[campo].trim()
    if (!texto) {
      if (!opcional) errores[campo] = 'Escribe una cantidad.'
      return undefined
    }
    const valor = leerNumero(texto)
    if (valor === null) errores[campo] = 'Tiene que ser un número.'
    else if (valor < 0) errores[campo] = 'No puede ser negativo.'
    return valor ?? undefined
  }

  const nombre = obligatorio('nombre', 'Escribe el nombre del producto.')
  const codigo = esAlta ? v.codigo.trim() : obligatorio('codigo', 'El código no puede quedar vacío.')
  const formato = obligatorio('formato', 'Falta el formato.')
  const unidadCorta = obligatorio('unidadCorta', 'Falta la unidad.')
  const armario = obligatorio('armario', 'Falta el armario.')
  const stockMinimo = numero('stockMinimo', { opcional: false })
  const cantidadPedidoSugerida = numero('cantidadPedidoSugerida', { opcional: true })
  const stockInicial = esAlta ? numero('stockInicial', { opcional: true }) : undefined
  // Lote y caducidad son los de lo que hay al darlo de alta: sin stock inicial no hay a qué ponérselos.
  const loteInicial = esAlta ? v.loteInicial.trim() : ''
  const caducidad = esAlta ? leerMesAnio(v.caducidadInicial) : ({ estado: 'vacio' } as const)
  if (caducidad.estado === 'no-valido') errores.caducidadInicial = caducidad.mensaje
  const conLote = loteInicial !== '' || caducidad.estado !== 'vacio'
  if (conLote && !errores.stockInicial && !(stockInicial !== undefined && stockInicial > 0)) {
    errores.stockInicial = 'Para guardar el lote o la caducidad, escribe cuántas unidades hay.'
  }

  if (Object.keys(errores).length > 0) return { valido: false, errores }
  return {
    valido: true,
    datos: {
      ...(codigo ? { codigo } : {}),
      nombre,
      categoria: v.categoria,
      formato,
      unidadCorta,
      armario,
      ...(v.balda.trim() ? { balda: v.balda.trim() } : {}),
      stockMinimo: stockMinimo ?? 0,
      ...(cantidadPedidoSugerida ? { cantidadPedidoSugerida } : {}),
      ...(v.notas.trim() ? { notas: v.notas.trim() } : {}),
      stockInicial: stockInicial ?? 0,
      ...(loteInicial ? { loteInicial } : {}),
      ...(caducidad.estado === 'valido' ? { caducidadInicial: caducidad.caducidad } : {}),
    },
  }
}
