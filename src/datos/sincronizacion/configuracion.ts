import type { FirebaseOptions } from 'firebase/app'
import { ErrorStock } from '../../dominio/errores'

/**
 * Configuración del proyecto de Firebase del laboratorio (Firebase › Configuración del proyecto ›
 * Tus apps › Configuración del SDK). No es secreta: identifica el proyecto, y lo que protege los
 * datos son las reglas de Firestore y la contraseña de la cuenta del laboratorio.
 *
 * Proyecto `stock-laboratorio-5abeb` (base de datos en europe-southwest1, Madrid; reglas en
 * firestore.rules). Con ella aquí, en cada móvil solo hay que poner el correo y la contraseña de
 * la persona. Si se deja en null, Ajustes pide pegar la configuración en cada móvil.
 */
export const CONFIGURACION_FIREBASE: FirebaseOptions | null = {
  apiKey: 'AIzaSyDx3-tRsqVPoQI6TVj04Pfqt976q2Iyfk0',
  authDomain: 'stock-laboratorio-5abeb.firebaseapp.com',
  projectId: 'stock-laboratorio-5abeb',
  storageBucket: 'stock-laboratorio-5abeb.firebasestorage.app',
  messagingSenderId: '635929826495',
  appId: '1:635929826495:web:9ddab2065963b366d7220a',
}

/**
 * Laboratorio que comparten todas las cuentas del proyecto (una por persona). Si algún día un mismo
 * proyecto sirviera a varios laboratorios, cada uno tendría el suyo.
 */
export const LABORATORIO_ID = 'principal'

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
