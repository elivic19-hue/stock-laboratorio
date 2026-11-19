import type { FirebaseOptions } from 'firebase/app'
import { ErrorStock } from '../../dominio/errores'

/**
 * Configuración del proyecto de Firebase del laboratorio (Firebase › Configuración del proyecto ›
 * Tus apps › Configuración del SDK). No es secreta: identifica el proyecto, y lo que protege los
 * datos son las reglas de Firestore y la contraseña de la cuenta del laboratorio.
 *
 * Mientras esté vacía, Ajustes pide pegarla en cada móvil. Cuando se rellene aquí, todos los móviles
 * solo tendrán que poner el correo y la contraseña del laboratorio.
 */
export const CONFIGURACION_FIREBASE: FirebaseOptions | null = null

const CAMPOS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'] as const

/**
 * Lee la configuración tal como la copia Firebase (`const firebaseConfig = { apiKey: "…", … };`)
 * o en JSON.
 */
export function leerConfiguracionPegada(texto: string): FirebaseOptions {
  const configuracion: Record<string, string> = {}
  for (const campo of CAMPOS) {
    const valor = new RegExp(`["']?${campo}["']?\\s*:\\s*["']([^"']+)["']`).exec(texto)?.[1]?.trim()
    if (valor) configuracion[campo] = valor
  }
  if (!configuracion.apiKey || !configuracion.projectId || !configuracion.appId) {
    throw new ErrorStock(
      'datos-no-validos',
      'No es la configuración de Firebase: tiene que tener al menos apiKey, projectId y appId.',
    )
  }
  configuracion.authDomain ??= `${configuracion.projectId}.firebaseapp.com`
  return configuracion
}
