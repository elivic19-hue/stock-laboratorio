import type { LoteCerrado, Movimiento } from '../datos/tipos'
import { yaCaducado } from './caducidad'
import { aFecha, diasEntre, formatearMesAnio } from './formato'
import { redondear } from './numeros'
import { DIAS_AVISO_CADUCIDAD } from './resumen'

/**
 * Lotes de un producto (docs/decisiones.md, «Lotes: archivar y restar de un lote»).
 *
 * - Un lote es lo que entra con un mismo código de lote (puede llegar en varias entradas). Si una
 *   entrada no trae código pero sí caducidad, su lote es «sin código, cad. MM/AAAA».
 * - Las retiradas y ajustes que dicen de qué lote salen (campo `lote`, o solo `caducidad` en los
 *   lotes sin código) se restan de ese lote. Las que no lo dicen solo cuentan para el stock del
 *   producto, así que lo que «queda» de cada lote es una cuenta orientativa.
 * - Un lote está archivado cuando todas sus entradas están cerradas (agotado o desechado).
 */

export type EstadoLote =
  /** Archivado: alguien lo dio por terminado o se terminó al retirar. */
  | 'desechado'
  | 'agotado'
  /** Abierto, con la caducidad pasada. */
  | 'caducado'
  /** Abierto y caduca en los próximos 30 días (como «Caducan <30 d»). */
  | 'caduca-pronto'
  | 'vigente'
  | 'sin-caducidad'

export interface LoteProducto {
  /** Identifica el lote dentro del producto: el código normalizado o «cad:AAAA-MM-DD». */
  clave: string
  /** Código tal como se escribió en la primera entrada (sin código: undefined). */
  lote?: string
  /** La caducidad más próxima de sus entradas abiertas (o de todas, si está archivado). */
  caducidad?: string
  /** Entradas del lote, de la más antigua a la más reciente. */
  entradas: Movimiento[]
  entrado: number
  /** Lo que se ha retirado o ajustado diciendo este lote (en positivo). */
  salido: number
  /** entrado − salido: orientativo, porque no todas las retiradas dicen su lote. */
  quedan: number
  archivado: boolean
  /** Cierre más reciente (quién y cuándo se archivó), si está archivado. */
  cierre?: LoteCerrado
  estado: EstadoLote
}

/** Código de lote para comparar: sin espacios y en mayúsculas («k49 20113» = «K4920113»). */
export function normalizarLote(texto: string): string {
  return texto.replace(/\s+/g, '').toUpperCase()
}

/** Clave del lote al que pertenece un movimiento, o null si no dice ninguno. */
export function claveLote(m: Pick<Movimiento, 'lote' | 'caducidad'>): string | null {
  const lote = m.lote?.trim()
  if (lote) return normalizarLote(lote)
  return m.caducidad ? `cad:${m.caducidad}` : null
}

/** Lotes del producto (con sus movimientos): abiertos primero por caducidad, luego los archivados. */
export function lotesDeProducto(movimientos: readonly Movimiento[], hoy: Date): LoteProducto[] {
  const porClave = new Map<string, { entradas: Movimiento[]; otros: Movimiento[] }>()
  for (const m of movimientos) {
    const clave = claveLote(m)
    if (!clave) continue
    let grupo = porClave.get(clave)
    if (!grupo) porClave.set(clave, (grupo = { entradas: [], otros: [] }))
    if (m.tipo === 'entrada') grupo.entradas.push(m)
    else grupo.otros.push(m)
  }

  const lotes: LoteProducto[] = []
  for (const [clave, { entradas, otros }] of porClave) {
    // Un lote solo existe si ha entrado (una retirada con un código que nunca entró no crea lote).
    if (entradas.length === 0) continue
    entradas.sort((a, b) => a.fecha.localeCompare(b.fecha))
    const entrado = redondear(entradas.reduce((s, m) => s + m.cantidad, 0))
    const neto = redondear(otros.reduce((s, m) => s + m.cantidad, 0))
    const salido = redondear(-otros.reduce((s, m) => s + Math.min(0, m.cantidad), 0))
    const abiertas = entradas.filter((m) => !m.loteCerrado)
    const archivado = abiertas.length === 0
    const caducidades = (archivado ? entradas : abiertas).flatMap((m) => (m.caducidad ? [m.caducidad] : [])).sort()
    const cierres = entradas.flatMap((m) => (m.loteCerrado ? [m.loteCerrado] : []))
    cierres.sort((a, b) => b.fecha.localeCompare(a.fecha))
    const lote = entradas.find((m) => m.lote?.trim())?.lote?.trim()
    const caducidad = caducidades[0]
    lotes.push({
      clave,
      ...(lote ? { lote } : {}),
      ...(caducidad ? { caducidad } : {}),
      entradas,
      entrado,
      salido,
      quedan: redondear(entrado + neto),
      archivado,
      ...(archivado && cierres[0] ? { cierre: cierres[0] } : {}),
      estado: estadoDe(archivado, cierres, caducidad, hoy),
    })
  }
  return lotes.sort(porOrdenDeUso)
}

function estadoDe(archivado: boolean, cierres: LoteCerrado[], caducidad: string | undefined, hoy: Date): EstadoLote {
  if (archivado) return cierres.some((c) => c.como === 'desechado') ? 'desechado' : 'agotado'
  if (!caducidad) return 'sin-caducidad'
  if (yaCaducado(caducidad, hoy)) return 'caducado'
  if (diasEntre(hoy, aFecha(caducidad)) <= DIAS_AVISO_CADUCIDAD) return 'caduca-pronto'
  return 'vigente'
}

/**
 * Orden de uso: los abiertos primero, por caducidad (lo que caduca antes se gasta antes; sin
 * caducidad, al final) y luego por antigüedad; después los archivados, del más reciente al más antiguo.
 */
function porOrdenDeUso(a: LoteProducto, b: LoteProducto): number {
  if (a.archivado !== b.archivado) return a.archivado ? 1 : -1
  if (a.archivado) return (b.cierre?.fecha ?? '').localeCompare(a.cierre?.fecha ?? '')
  if (a.caducidad !== b.caducidad) {
    if (!a.caducidad) return 1
    if (!b.caducidad) return -1
    return a.caducidad.localeCompare(b.caducidad)
  }
  return (a.entradas[0]?.fecha ?? '').localeCompare(b.entradas[0]?.fecha ?? '')
}

/** Lotes que se pueden elegir al retirar: los abiertos, en orden de uso (el primero, el que toca gastar). */
export function lotesAbiertos(movimientos: readonly Movimiento[], hoy: Date): LoteProducto[] {
  return lotesDeProducto(movimientos, hoy).filter((l) => !l.archivado)
}

/** Cómo se nombra un lote en pantalla: su código o, si no tiene, «cad. 05/2028». */
export function nombreDeLote(lote: Pick<LoteProducto, 'lote' | 'caducidad'>): string {
  if (lote.lote) return lote.lote
  return lote.caducidad ? `cad. ${formatearMesAnio(lote.caducidad)}` : 'sin lote'
}

/** Lo que se guarda en una retirada para decir de qué lote sale. */
export function referenciaDeLote(lote: LoteProducto): Pick<Movimiento, 'lote' | 'caducidad'> {
  return lote.lote ? { lote: lote.lote } : lote.caducidad ? { caducidad: lote.caducidad } : {}
}
