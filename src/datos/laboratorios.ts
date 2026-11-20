/**
 * Laboratorios que comparten la app. Cada uno tiene su propio stock: en la nube va en
 * `laboratorios/{id}` y en el móvil, en su propia base de datos. Cada persona elige cuál ve
 * (docs/decisiones.md, «Dos laboratorios e inicio de sesión»).
 */
export const LABORATORIOS = [
  { id: 'cromatografia', nombre: 'Lab. Cromatografía' },
  { id: 'foodcontact', nombre: 'Lab. Food Contact' },
] as const

export type IdLaboratorio = (typeof LABORATORIOS)[number]['id']

export function esIdLaboratorio(valor: unknown): valor is IdLaboratorio {
  return LABORATORIOS.some((l) => l.id === valor)
}

export function nombreLaboratorio(id: IdLaboratorio): string {
  return LABORATORIOS.find((l) => l.id === id)?.nombre ?? id
}

/** Base de datos del móvil con el stock de ese laboratorio (también la lee public/sw-avisos.js). */
export function nombreBaseDatos(id: IdLaboratorio): string {
  return `stock-laboratorio-${id}`
}
