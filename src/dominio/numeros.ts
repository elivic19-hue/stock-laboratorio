/**
 * Lee un número escrito en un campo: «2,5», «2.5», «12» o «1.250,5».
 * Devuelve null si está vacío o no es un número.
 *
 * Con una sola clase de separador, se toma como decimal (el teclado del móvil puede sacar
 * coma o punto según el idioma). Con los dos, el punto agrupa miles y la coma es decimal.
 */
export function leerNumero(texto: string): number | null {
  let limpio = texto.trim().replace(/\s/g, '').replace('−', '-')
  if (!limpio) return null
  if (limpio.includes('.') && limpio.includes(',')) limpio = limpio.replace(/\./g, '').replace(',', '.')
  else limpio = limpio.replace(',', '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(limpio)) return null
  const valor = Number(limpio)
  return Number.isFinite(valor) ? valor : null
}

/** Número para escribirlo en un campo (coma decimal, sin separador de miles). */
export function numeroParaCampo(valor: number | undefined): string {
  if (valor === undefined) return ''
  return String(Math.round(valor * 1e6) / 1e6).replace('.', ',')
}

/** Redondea a 6 decimales para evitar los errores de coma flotante (0,3 − 0,1). */
export function redondear(valor: number): number {
  return Math.round(valor * 1e6) / 1e6
}
