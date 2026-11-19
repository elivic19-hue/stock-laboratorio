/**
 * Lo que la sincronización necesita de la nube (fase 2). Lo implementa RemotoFirebase y, en los
 * tests, un remoto en memoria. Así el motor (Sincronizador) no depende de Firebase.
 */

export const TABLAS = ['productos', 'movimientos', 'fotos', 'pedidos'] as const
export type Tabla = (typeof TABLAS)[number]

/** Datos tal como viajan: sin Blob (las miniaturas van como bytes). */
export type DatosRemotos = Record<string, unknown>

export interface CambioRemoto {
  id: string
  /** null: el documento se ha borrado (lápida). */
  datos: DatosRemotos | null
  /** Momento del servidor en que se modificó (ms). Solo crece. */
  marca: number
}

export interface AlmacenRemoto {
  /**
   * Guarda (o borra, con null) un documento. Sin conexión queda en cola y la promesa se resuelve
   * cuando el servidor lo confirma.
   */
  escribir(tabla: Tabla, id: string, datos: DatosRemotos | null): Promise<void>
  /**
   * Escucha los documentos modificados desde `desde` (incluido) y los que se modifiquen después.
   * `desdeServidor` es false mientras solo hay datos de la caché local (sin conexión).
   */
  escuchar(
    tabla: Tabla,
    desde: number,
    alCambiar: (cambios: CambioRemoto[], desdeServidor: boolean) => void,
    alError: (error: unknown) => void,
  ): () => void
  /** Si el laboratorio ya tiene productos en la nube (hace falta conexión). */
  hayDatos(): Promise<boolean>
}
