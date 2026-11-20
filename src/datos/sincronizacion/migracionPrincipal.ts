import { normalizarTexto } from '../../dominio/busqueda'
import { normalizarCodigo, siguienteCodigo } from '../../dominio/codigos'
import { MAX_FOTOS_POR_PRODUCTO, type VolcadoDatos } from '../StockRepository'
import type { FotoReferencia, Producto } from '../tipos'

/**
 * Recuperar el stock de antes de separar los laboratorios (docs/decisiones.md, «Recuperar el stock
 * de antes y que las actualizaciones no lo pierdan»). La versión del 20/11/2026 empezó a guardar
 * cada laboratorio aparte y dejó el stock compartido en `laboratorios/principal` sin leerlo. El
 * usuario eligió pasarlo a Lab. Cromatografía, sumándolo a lo que ya se había metido allí:
 *
 * - Un producto que ya está (mismo nombre y categoría) se queda como está y solo recibe las fotos
 *   de referencia de antes (sin pasar de 20): sus movimientos no se traen para no sumar el stock dos veces.
 * - Los demás se traen enteros (producto, movimientos, fotos y pedidos), con sus mismos
 *   identificadores; si su código ya lo usa otro producto, se le da el siguiente libre.
 * - Lo que ya esté con el mismo identificador no se toca: repetir la recuperación no duplica nada.
 */

export const LABORATORIO_ANTERIOR = 'principal'
export const LABORATORIO_DESTINO = 'cromatografia'
/** Nombre de la marca en `laboratorios/{destino}/migraciones/`. */
export const MARCA_MIGRACION = 'principal'

export interface ResumenMigracion {
  productosNuevos: number
  /** Productos que ya estaban (mismo nombre): solo se les añaden fotos. */
  productosQueYaEstaban: number
  movimientos: number
  fotos: number
  pedidos: number
  /** Códigos que se han cambiado porque ya los usaba otro producto. */
  codigosCambiados: { antes: string; despues: string }[]
}

export interface PlanMigracion extends VolcadoDatos {
  resumen: ResumenMigracion
}

function claveNombre(p: Pick<Producto, 'nombre' | 'categoria'>): string {
  return `${p.categoria}:${normalizarTexto(p.nombre)}`
}

/** Qué hay que añadir al destino para traer el origen (función pura). */
export function planificarMigracion(origen: VolcadoDatos, destino: VolcadoDatos): PlanMigracion {
  const idsDestino = {
    productos: new Set(destino.productos.map((p) => p.id)),
    movimientos: new Set(destino.movimientos.map((m) => m.id)),
    fotos: new Set(destino.fotos.map((f) => f.id)),
    pedidos: new Set(destino.pedidos.map((p) => p.id)),
  }
  const porNombre = new Map(destino.productos.map((p) => [claveNombre(p), p]))
  const codigosUsados = new Set(destino.productos.map((p) => normalizarCodigo(p.codigo)))
  const fotosPorProducto = new Map<string, number>()
  for (const f of destino.fotos) fotosPorProducto.set(f.productoId, (fotosPorProducto.get(f.productoId) ?? 0) + 1)

  const productos: Producto[] = []
  const nuevos = new Set<string>()
  /** Producto de antes → producto del destino que ya estaba (para llevarle las fotos). */
  const yaEstaban = new Map<string, string>()
  const codigosCambiados: ResumenMigracion['codigosCambiados'] = []

  for (const p of origen.productos) {
    if (idsDestino.productos.has(p.id)) continue // ya recuperado antes
    const igual = porNombre.get(claveNombre(p))
    if (igual) {
      yaEstaban.set(p.id, igual.id)
      continue
    }
    let codigo = normalizarCodigo(p.codigo)
    if (codigosUsados.has(codigo)) {
      const nuevo = siguienteCodigo(p.categoria, codigosUsados)
      codigosCambiados.push({ antes: p.codigo, despues: nuevo })
      codigo = nuevo
    }
    codigosUsados.add(codigo)
    productos.push(codigo === p.codigo ? p : { ...p, codigo })
    nuevos.add(p.id)
  }

  const movimientos = origen.movimientos.filter((m) => nuevos.has(m.productoId) && !idsDestino.movimientos.has(m.id))
  const pedidos = origen.pedidos.filter((p) => nuevos.has(p.productoId) && !idsDestino.pedidos.has(p.id))

  const fotos: FotoReferencia[] = origen.fotos.filter((f) => nuevos.has(f.productoId) && !idsDestino.fotos.has(f.id))
  // A los que ya estaban, las fotos de antes que quepan: primero las hechas a propósito y las más recientes.
  const candidatas = origen.fotos
    .filter((f) => yaEstaban.has(f.productoId) && !idsDestino.fotos.has(f.id))
    .sort((a, b) => (a.origen === b.origen ? b.creadoEn.localeCompare(a.creadoEn) : a.origen === 'alta' ? -1 : 1))
  for (const f of candidatas) {
    const destinoId = yaEstaban.get(f.productoId)
    if (!destinoId) continue
    const tiene = fotosPorProducto.get(destinoId) ?? 0
    if (tiene >= MAX_FOTOS_POR_PRODUCTO) continue
    fotosPorProducto.set(destinoId, tiene + 1)
    fotos.push({ ...f, productoId: destinoId })
  }

  return {
    productos,
    movimientos,
    fotos,
    pedidos,
    resumen: {
      productosNuevos: productos.length,
      productosQueYaEstaban: yaEstaban.size,
      movimientos: movimientos.length,
      fotos: fotos.length,
      pedidos: pedidos.length,
      codigosCambiados,
    },
  }
}
