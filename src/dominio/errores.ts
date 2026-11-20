export type CodigoError =
  | 'producto-no-encontrado'
  | 'movimiento-no-encontrado'
  | 'pedido-no-encontrado'
  | 'stock-insuficiente'
  | 'cantidad-no-valida'
  | 'datos-no-validos'
  | 'codigo-duplicado'
  | 'limite-fotos'
  | 'foto-no-valida'
  | 'no-es-el-ultimo-movimiento'
  | 'copia-no-valida'

/** Error de las reglas del stock, con un mensaje listo para enseñar al usuario. */
export class ErrorStock extends Error {
  readonly codigo: CodigoError

  constructor(codigo: CodigoError, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorStock'
    this.codigo = codigo
  }
}

/** Mensaje para el usuario a partir de cualquier error. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorStock) return error.message
  return 'Ha ocurrido un error inesperado. Vuelve a intentarlo.'
}
