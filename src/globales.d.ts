export {}

declare global {
  /** Versión de package.json, inyectada al compilar (vite.config.ts). */
  const __VERSION_APP__: string
  /** Momento de la compilación (ISO), inyectado al compilar. */
  const __FECHA_COMPILACION__: string
}
