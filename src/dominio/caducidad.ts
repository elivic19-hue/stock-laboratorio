import { fechaSinHora } from './formato'

/**
 * Caducidad por mes y año (duda 7: en las etiquetas viene así). Se escribe «03 / 2029» y se
 * guarda como el último día de ese mes (2029-03-31): el producto vale hasta final de mes y el
 * campo sigue siendo una fecha AAAA-MM-DD normal para los cálculos y para la fase 2.
 */

export type LecturaMesAnio =
  | { estado: 'vacio' }
  | { estado: 'valido'; caducidad: string }
  | { estado: 'no-valido'; mensaje: string }

const MENSAJE = 'Escribe el mes y el año de la caducidad, p. ej. 03 / 2029.'

/** Último día del mes (mes de 1 a 12). */
export function ultimoDiaDelMes(anio: number, mes: number): Date {
  return new Date(anio, mes, 0)
}

/** Separa lo escrito en mes y año: «03/2029», «3-29», «032029» o «0329». */
function partes(texto: string): { mes: string; anio: string } | null {
  const limpio = texto.trim()
  const conSeparador = /^(\d{1,2})\s*[/.\-\s]\s*(\d{2}|\d{4})$/.exec(limpio)
  if (conSeparador) return { mes: conSeparador[1] ?? '', anio: conSeparador[2] ?? '' }
  const seguido = /^(\d{2})(\d{2}|\d{4})$/.exec(limpio)
  if (seguido) return { mes: seguido[1] ?? '', anio: seguido[2] ?? '' }
  return null
}

export function leerMesAnio(texto: string): LecturaMesAnio {
  if (!texto.trim()) return { estado: 'vacio' }
  const p = partes(texto)
  if (!p) return { estado: 'no-valido', mensaje: MENSAJE }
  const mes = Number(p.mes)
  const anio = p.anio.length === 2 ? 2000 + Number(p.anio) : Number(p.anio)
  if (mes < 1 || mes > 12) return { estado: 'no-valido', mensaje: 'El mes tiene que estar entre 01 y 12.' }
  if (anio < 2000 || anio > 2099) return { estado: 'no-valido', mensaje: 'Revisa el año de la caducidad.' }
  return { estado: 'valido', caducidad: fechaSinHora(ultimoDiaDelMes(anio, mes)) }
}

/**
 * Formato del campo mientras se escribe: los números se agrupan como «MM / AAAA».
 * Si se escribe el mes con una sola cifra y un separador («3/»), se completa con un cero.
 * `borrando` evita volver a poner la barra que se acaba de borrar.
 */
export function formatearEntradaMesAnio(texto: string, borrando = false): string {
  const conSeparador = borrando ? null : /^\s*(\d)\s*[/.\-\s]\s*(\d*)$/.exec(texto)
  const cifras = conSeparador ? `0${conSeparador[1] ?? ''}${conSeparador[2] ?? ''}` : texto.replace(/\D/g, '')
  const recortadas = cifras.slice(0, 6)
  if (recortadas.length <= 2) {
    // Al escribir el separador detrás del mes se añade la barra para seguir con el año.
    const pideBarra = !borrando && recortadas.length === 2 && /[/.\-\s]\s*$/.test(texto)
    return pideBarra ? `${recortadas} / ` : recortadas
  }
  return `${recortadas.slice(0, 2)} / ${recortadas.slice(2)}`
}

/** El mes de la caducidad ya ha terminado. */
export function yaCaducado(caducidad: string, hoy: Date): boolean {
  return caducidad < fechaSinHora(hoy)
}
