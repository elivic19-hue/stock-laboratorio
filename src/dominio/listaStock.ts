import type { Categoria, Movimiento, Producto } from '../datos/tipos'
import { coincideBusqueda } from './busqueda'
import { diasEntre, formatearMesAnio, formatearMomento } from './formato'
import { entradasQueCaducanPronto } from './resumen'
import { estaBajoMinimo } from './stock'

const orden = new Intl.Collator('es', { numeric: true, sensitivity: 'base' })

export type FiltroCategoria = 'todos' | Categoria

export type OrdenLista = 'nombre' | 'codigo' | 'urgencia'

export interface OpcionesLista {
  texto: string
  categoria: FiltroCategoria
  soloBajoMinimo: boolean
  soloCaducanPronto: boolean
  orden: OrdenLista
}

export const OPCIONES_LISTA_INICIALES: OpcionesLista = {
  texto: '',
  categoria: 'todos',
  soloBajoMinimo: false,
  soloCaducanPronto: false,
  orden: 'nombre',
}

/** Lo que la lista necesita saber de los movimientos de cada producto. */
export interface InfoProducto {
  ultimoMovimiento?: Movimiento
  /** Caducidad más cercana (AAAA-MM-DD) entre las entradas que caducan en menos de 30 días. */
  caducidadProxima?: string
}

export function infoPorProducto(
  productos: readonly Producto[],
  movimientos: readonly Movimiento[],
  hoy: Date,
): Map<string, InfoProducto> {
  const info = new Map<string, InfoProducto>()
  const de = (id: string) => {
    let actual = info.get(id)
    if (!actual) info.set(id, (actual = {}))
    return actual
  }
  for (const m of movimientos) {
    const actual = de(m.productoId)
    if (!actual.ultimoMovimiento || m.fecha > actual.ultimoMovimiento.fecha) actual.ultimoMovimiento = m
  }
  for (const m of entradasQueCaducanPronto(productos, movimientos, hoy)) {
    const actual = de(m.productoId)
    if (m.caducidad && (!actual.caducidadProxima || m.caducidad < actual.caducidadProxima)) {
      actual.caducidadProxima = m.caducidad
    }
  }
  return info
}

/** «balda 3», como en la maqueta (solo se baja la inicial). */
function baldaEnLinea(balda: string): string {
  const limpia = balda.trim()
  return limpia.charAt(0).toLowerCase() + limpia.slice(1)
}

/**
 * Línea secundaria de la fila (docs/decisiones.md): formato y, detrás, el último movimiento si
 * es de hoy; si no, la caducidad si está cerca; si no, la balda.
 */
export function lineaSecundaria(producto: Producto, info: InfoProducto | undefined, ahora: Date): string {
  const partes = [producto.formato]
  const ultimo = info?.ultimoMovimiento
  if (ultimo && diasEntre(new Date(ultimo.fecha), ahora) === 0) {
    partes.push(`últ. mov. ${formatearMomento(ultimo.fecha, ahora)}`)
  } else if (info?.caducidadProxima) {
    partes.push(`cad. ${formatearMesAnio(info.caducidadProxima)}`)
  } else if (producto.balda?.trim()) {
    partes.push(baldaEnLinea(producto.balda))
  }
  return partes.join(' · ')
}

/** Cuántas veces el mínimo queda el stock (para ordenar por urgencia). */
function holgura(p: Producto): number {
  return p.stockMinimo > 0 ? p.stockActual / p.stockMinimo : p.stockActual > 0 ? Infinity : 0
}

function comparar(criterio: OrdenLista): (a: Producto, b: Producto) => number {
  switch (criterio) {
    case 'codigo':
      return (a, b) => orden.compare(a.codigo, b.codigo)
    case 'urgencia':
      return (a, b) =>
        Number(estaBajoMinimo(b)) - Number(estaBajoMinimo(a)) ||
        holgura(a) - holgura(b) ||
        orden.compare(a.nombre, b.nombre)
    case 'nombre':
      return (a, b) => orden.compare(a.nombre, b.nombre)
  }
}

/** Productos no archivados que cumplen los filtros (sin tener en cuenta la categoría). */
export function filtrarSinCategoria(
  productos: readonly Producto[],
  info: ReadonlyMap<string, InfoProducto>,
  opciones: Omit<OpcionesLista, 'categoria' | 'orden'>,
): Producto[] {
  return productos.filter(
    (p) =>
      !p.archivado &&
      coincideBusqueda(p, opciones.texto) &&
      (!opciones.soloBajoMinimo || estaBajoMinimo(p)) &&
      (!opciones.soloCaducanPronto || info.get(p.id)?.caducidadProxima !== undefined),
  )
}

export interface GrupoArmario {
  armario: string
  productos: Producto[]
}

/** Lista de Stock agrupada por armario (armarios en orden alfabético y natural: 1, 2, 10…). */
export function agruparPorArmario(productos: readonly Producto[], criterio: OrdenLista): GrupoArmario[] {
  const grupos = new Map<string, GrupoArmario>()
  for (const p of productos) {
    const clave = p.armario.trim().toLocaleLowerCase('es')
    let grupo = grupos.get(clave)
    if (!grupo) grupos.set(clave, (grupo = { armario: p.armario.trim(), productos: [] }))
    grupo.productos.push(p)
  }
  const lista = [...grupos.values()].sort((a, b) => orden.compare(a.armario, b.armario))
  for (const grupo of lista) grupo.productos.sort(comparar(criterio))
  return lista
}

export function contarPorCategoria(productos: readonly Producto[]): Record<FiltroCategoria, number> {
  return {
    todos: productos.length,
    reactivo: productos.filter((p) => p.categoria === 'reactivo').length,
    fungible: productos.filter((p) => p.categoria === 'fungible').length,
  }
}

/** Hay algún filtro (aparte de la búsqueda y la categoría) o un orden distinto del normal. */
export function hayFiltrosActivos(opciones: OpcionesLista): boolean {
  return opciones.soloBajoMinimo || opciones.soloCaducanPronto || opciones.orden !== 'nombre'
}

/** Ordena para el Catálogo: por código. */
export function ordenarPorCodigo(productos: readonly Producto[]): Producto[] {
  return [...productos].sort(comparar('codigo'))
}
