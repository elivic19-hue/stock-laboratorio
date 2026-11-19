import type { Producto } from '../datos/tipos'
import { ubicacionCorta, ubicacionMedia } from './ubicacion'

/** Minúsculas y sin tildes: «Ácido» y «acido» son lo mismo al buscar. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

type ProductoBuscable = Pick<Producto, 'nombre' | 'codigo' | 'formato' | 'armario' | 'balda'>

function textoBuscable(p: ProductoBuscable): string {
  // Incluye las formas abreviadas de la ubicación para que «arm. 2», «b3» o «balda 3» encuentren lo mismo.
  return normalizarTexto(
    [p.nombre, p.codigo, p.formato, p.armario, p.balda, ubicacionCorta(p), ubicacionMedia(p)].join(' | '),
  )
}

/**
 * Busca por nombre, código, formato o ubicación. Cada palabra tiene que aparecer en algún sitio
 * («puntas 200», «inflamables etanol», «r-014», «b3»).
 */
export function coincideBusqueda(producto: ProductoBuscable, consulta: string): boolean {
  const palabras = normalizarTexto(consulta).split(' ').filter(Boolean)
  if (palabras.length === 0) return true
  const texto = textoBuscable(producto)
  return palabras.every((palabra) => texto.includes(palabra))
}
