/** Copia del objeto sin las propiedades que valen undefined (así no se guardan campos vacíos). */
export function sinIndefinidos<T extends object>(objeto: T): T {
  return Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined)) as T
}

/** Texto recortado, o undefined si queda vacío. */
export function textoOpcional(texto: string | undefined): string | undefined {
  const limpio = texto?.trim()
  return limpio ? limpio : undefined
}
