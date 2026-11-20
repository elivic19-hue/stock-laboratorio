import type { FirebaseOptions } from 'firebase/app'

/**
 * Configuración del proyecto de Firebase de los laboratorios (Firebase › Configuración del
 * proyecto › Tus apps › Configuración del SDK). No es secreta: identifica el proyecto, y lo que
 * protege los datos son las reglas de Firestore (firestore.rules) y la contraseña de cada cuenta.
 *
 * Proyecto `stock-laboratorio-5abeb` (base de datos en europe-southwest1, Madrid).
 */
export const CONFIGURACION_FIREBASE: FirebaseOptions = {
  apiKey: 'AIzaSyDx3-tRsqVPoQI6TVj04Pfqt976q2Iyfk0',
  authDomain: 'stock-laboratorio-5abeb.firebaseapp.com',
  projectId: 'stock-laboratorio-5abeb',
  storageBucket: 'stock-laboratorio-5abeb.firebasestorage.app',
  messagingSenderId: '635929826495',
  appId: '1:635929826495:web:9ddab2065963b366d7220a',
}
