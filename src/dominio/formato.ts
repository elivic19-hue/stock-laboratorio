/**
 * Formatos de España (CLAUDE.md §1): coma decimal y fechas dd/mm/aaaa.
 * Los textos cortos («hoy 08:12», «12 nov») van en minúscula; las etiquetas mono los pasan a
 * mayúsculas con CSS, así los lectores de pantalla no los deletrean.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

/** Signo menos tipográfico (U+2212), como en las maquetas. */
export const MENOS = '−'

const formatoNumero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })

/** 2,5 · 150 · 12.500 */
export function formatearNumero(valor: number): string {
  return formatoNumero.format(valor).replace('-', MENOS)
}

/** +10 · −1 · 0 */
export function formatearCantidadConSigno(valor: number): string {
  return valor > 0 ? `+${formatearNumero(valor)}` : formatearNumero(valor)
}

/** 850 KB · 14,2 MB */
export function formatearTamano(bytes: number): string {
  const megas = bytes / (1024 * 1024)
  if (megas < 1) return `${formatearNumero(Math.max(1, Math.round(bytes / 1024)))} KB`
  return `${formatearNumero(Math.round(megas * 10) / 10)} MB`
}

function dosCifras(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Convierte una fecha ISO, o una fecha sin hora (AAAA-MM-DD, que se interpreta en hora local),
 * en Date.
 */
export function aFecha(valor: string | Date): Date {
  if (valor instanceof Date) return valor
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soloFecha) {
    return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
  }
  return new Date(valor)
}

/** Fecha local sin hora: AAAA-MM-DD (así se guarda la caducidad). */
export function fechaSinHora(fecha: Date): string {
  return `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}`
}

/** dd/mm/aaaa */
export function formatearFecha(valor: string | Date): string {
  const f = aFecha(valor)
  return `${dosCifras(f.getDate())}/${dosCifras(f.getMonth() + 1)}/${f.getFullYear()}`
}

/** hh:mm (24 h) */
export function formatearHora(valor: string | Date): string {
  const f = aFecha(valor)
  return `${dosCifras(f.getHours())}:${dosCifras(f.getMinutes())}`
}

/** dd/mm/aaaa hh:mm */
export function formatearFechaHora(valor: string | Date): string {
  return `${formatearFecha(valor)} ${formatearHora(valor)}`
}

/** mm/aaaa, como la caducidad de la lista de Stock («cad. 12/2026»). */
export function formatearMesAnio(valor: string | Date): string {
  const f = aFecha(valor)
  return `${dosCifras(f.getMonth() + 1)}/${f.getFullYear()}`
}

/** Días naturales de una fecha a otra, sin tener en cuenta la hora (negativo si «hasta» es anterior). */
export function diasEntre(desde: Date, hasta: Date): number {
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  return Math.round((b - a) / 86_400_000)
}

/** «14 nov», o «14 nov 2025» si no es del año en curso. */
export function formatearDiaMes(valor: string | Date, ahora: Date): string {
  const f = aFecha(valor)
  const diaMes = `${f.getDate()} ${MESES[f.getMonth()] ?? ''}`
  return f.getFullYear() === ahora.getFullYear() ? diaMes : `${diaMes} ${f.getFullYear()}`
}

/** «hoy 08:12», «ayer 16:40», y si es más antiguo, «12 nov». */
export function formatearMomento(valor: string | Date, ahora: Date): string {
  const f = aFecha(valor)
  const dias = diasEntre(f, ahora)
  if (dias === 0) return `hoy ${formatearHora(f)}`
  if (dias === 1) return `ayer ${formatearHora(f)}`
  return formatearDiaMes(f, ahora)
}
