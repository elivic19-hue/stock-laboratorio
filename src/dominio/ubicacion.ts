interface ConUbicacion {
  armario: string
  balda?: string
}

/** «Armario 2» → «Arm. 2», «Armario inflamables» → «Arm. inflamables». El resto, igual. */
export function abreviarArmario(armario: string): string {
  return armario.trim().replace(/^armario\b\.?\s*/i, 'Arm. ').trim()
}

/** «Balda 3» → «B3» y «3» → «B3». Si no es una balda numerada, se deja igual. */
export function abreviarBalda(balda: string): string {
  const limpio = balda.trim()
  const numerada = /^(?:balda\s*)?(\d+[a-z]?)$/i.exec(limpio)
  return numerada ? `B${numerada[1] ?? ''}` : limpio
}

function unir(partes: (string | undefined)[]): string {
  return partes.filter((parte) => parte && parte.trim()).join(' · ')
}

/** «Arm. 2 · B3» (tarjetas de A pedir y selector de Entrada; se muestra en mayúsculas). */
export function ubicacionCorta(p: ConUbicacion): string {
  return unir([abreviarArmario(p.armario), p.balda && abreviarBalda(p.balda)])
}

/** «Arm. 2 · Balda 3» (hoja de Retirar; se muestra en mayúsculas). */
export function ubicacionMedia(p: ConUbicacion): string {
  return unir([abreviarArmario(p.armario), p.balda?.trim()])
}

/** «Armario 2 · Balda 3» (ficha del producto). */
export function ubicacionCompleta(p: ConUbicacion): string {
  return unir([p.armario.trim(), p.balda?.trim()])
}
