import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth'
import {
  Bytes,
  collection,
  doc,
  getDocsFromServer,
  initializeFirestore,
  limit,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import type { AlmacenRemoto, CambioRemoto, DatosRemotos, Tabla } from './remoto'

/**
 * La nube del laboratorio en Firebase (fase 2): Firestore para los datos y una cuenta de correo y
 * contraseña por laboratorio. Cada laboratorio tiene sus datos en `laboratorios/{uid de su cuenta}`
 * y las reglas solo dejan entrar a esa cuenta (README, «Compartir el stock»).
 *
 * Este módulo se carga solo cuando el móvil está conectado: sin él, la app no descarga Firebase.
 */

export interface SesionFirebase {
  remoto: AlmacenRemoto
  /** uid de la cuenta del laboratorio = identificador del laboratorio. */
  laboratorioId: string
  correo: string
  cerrar(opciones?: { cerrarSesion?: boolean }): Promise<void>
}

const NOMBRE_APP = 'stock-laboratorio'

/** Inicia Firebase y entra con la cuenta del laboratorio (o recupera la sesión guardada). */
export async function abrirSesionFirebase(
  configuracion: FirebaseOptions,
  credenciales?: { correo: string; contrasena: string },
): Promise<SesionFirebase> {
  const app = initializeApp(configuracion, NOMBRE_APP)
  try {
    const auth = getAuth(app)
    await auth.authStateReady()
    if (credenciales) {
      if (auth.currentUser) await signOut(auth)
      await signInWithEmailAndPassword(auth, credenciales.correo.trim(), credenciales.contrasena)
    }
    const usuario = auth.currentUser
    if (!usuario) throw new ErrorSesion('La sesión del laboratorio ha caducado: vuelve a conectar este móvil.')
    const db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      // Caché en el móvil: los cambios hechos sin conexión se guardan y se mandan al volver.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    return {
      remoto: new RemotoFirestore(db, usuario.uid),
      laboratorioId: usuario.uid,
      correo: usuario.email ?? credenciales?.correo ?? '',
      cerrar: (opciones) => cerrar(app, auth, opciones?.cerrarSesion ?? false),
    }
  } catch (error) {
    await deleteApp(app).catch(() => {})
    throw traducirError(error)
  }
}

async function cerrar(app: FirebaseApp, auth: Auth, cerrarSesion: boolean): Promise<void> {
  if (cerrarSesion) await signOut(auth).catch(() => {})
  await deleteApp(app)
}

export class ErrorSesion extends Error {}

function traducirError(error: unknown): Error {
  if (error instanceof ErrorSesion) return error
  const codigo = (error as { code?: unknown } | null)?.code
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return new ErrorSesion('El correo o la contraseña del laboratorio no son correctos.')
    case 'auth/network-request-failed':
      return new ErrorSesion('No hay conexión. Para conectar este móvil hace falta internet.')
    case 'auth/too-many-requests':
      return new ErrorSesion('Demasiados intentos. Espera unos minutos y vuelve a probar.')
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return new ErrorSesion('La configuración de Firebase no es válida (apiKey).')
    case 'auth/operation-not-allowed':
      return new ErrorSesion('En Firebase falta activar el inicio de sesión con correo y contraseña.')
    default:
      return error instanceof Error ? error : new Error(String(error))
  }
}

class RemotoFirestore implements AlmacenRemoto {
  readonly #db: Firestore
  readonly #laboratorio: string

  constructor(db: Firestore, laboratorio: string) {
    this.#db = db
    this.#laboratorio = laboratorio
  }

  #coleccion(tabla: Tabla) {
    return collection(this.#db, 'laboratorios', this.#laboratorio, tabla)
  }

  escribir(tabla: Tabla, id: string, datos: DatosRemotos | null): Promise<void> {
    const ref = doc(this.#coleccion(tabla), id)
    const documento = datos
      ? { ...aFirestore(datos), borrado: false, modificadoEn: serverTimestamp() }
      : { borrado: true, modificadoEn: serverTimestamp() }
    return setDoc(ref, documento)
  }

  escuchar(
    tabla: Tabla,
    desde: number,
    alCambiar: (cambios: CambioRemoto[], desdeServidor: boolean) => void,
    alError: (error: unknown) => void,
  ): () => void {
    const consulta = query(this.#coleccion(tabla), where('modificadoEn', '>=', Timestamp.fromMillis(desde)))
    return onSnapshot(
      consulta,
      { includeMetadataChanges: true },
      (instantanea) => {
        const cambios: CambioRemoto[] = []
        for (const cambio of instantanea.docChanges({ includeMetadataChanges: true })) {
          // Lo pendiente de confirmar es nuestro propio cambio: ya está en el móvil.
          if (cambio.type === 'removed' || cambio.doc.metadata.hasPendingWrites) continue
          const datos = cambio.doc.data()
          const marca = datos.modificadoEn instanceof Timestamp ? datos.modificadoEn.toMillis() : desde
          cambios.push({ id: cambio.doc.id, datos: datos.borrado === true ? null : deFirestore(datos), marca })
        }
        alCambiar(cambios, !instantanea.metadata.fromCache)
      },
      alError,
    )
  }

  async hayDatos(): Promise<boolean> {
    const consulta = query(this.#coleccion('productos'), where('borrado', '==', false), limit(1))
    try {
      return !(await getDocsFromServer(consulta)).empty
    } catch (error) {
      if ((error as { code?: unknown }).code === 'unavailable') {
        throw new ErrorSesion('No hay conexión. Para conectar este móvil hace falta internet.')
      }
      throw traducirError(error)
    }
  }
}

function aFirestore(datos: DatosRemotos): DocumentData {
  const salida: DocumentData = {}
  for (const [clave, valor] of Object.entries(datos)) {
    salida[clave] = valor instanceof Uint8Array ? Bytes.fromUint8Array(valor) : valor
  }
  return salida
}

function deFirestore(datos: DocumentData): DatosRemotos {
  const salida: DatosRemotos = {}
  for (const [clave, valor] of Object.entries(datos)) {
    if (clave === 'borrado' || clave === 'modificadoEn') continue
    salida[clave] = valor instanceof Bytes ? valor.toUint8Array() : valor
  }
  return salida
}
