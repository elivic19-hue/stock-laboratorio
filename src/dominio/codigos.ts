import type { Categoria } from '../datos/tipos'

const PREFIJOS: Record<Categoria, string> = { reactivo: 'R', fungible: 'F' }

/** Mayúsculas y sin espacios alrededor: así se comparan y se guardan los códigos. */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase()
}

/**
 * Siguiente código automático de la categoría: R-001… para reactivos, F-001… para fungible.
 * Sigue al número más alto existente (incluidos los archivados, para no reutilizar códigos) e
 * ignora los códigos editados a mano que no siguen el patrón.
 */
export function siguienteCodigo(categoria: Categoria, existentes: Iterable<string>): string {
  const prefijo = PREFIJOS[categoria]
  const patron = new RegExp(`^${prefijo}-(\\d+)$`)
  let mayor = 0
  for (const codigo of existentes) {
    const coincidencia = patron.exec(normalizarCodigo(codigo))
    if (coincidencia?.[1]) mayor = Math.max(mayor, Number(coincidencia[1]))
  }
  return `${prefijo}-${String(mayor + 1).padStart(3, '0')}`
}
