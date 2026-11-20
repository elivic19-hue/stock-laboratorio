import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth'
import {
  Bytes,
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  initializeFirestore,
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
import type { VolcadoDatos } from '../StockRepository'
import { TABLAS, type AlmacenRemoto, type CambioRemoto, type DatosRemotos, type Tabla } from './remoto'
import { deRemoto } from './Sincronizador'

/**
 * La nube de los laboratorios en Firebase (fase 2): Firestore para los datos y una cuenta de correo
 * y contraseña por persona. Cualquier cuenta del proyecto puede entrar en los dos laboratorios
 * (`laboratorios/{id}`); solo existen las que se crean en la consola de Firebase, porque la
 * creación de cuentas desde la app está desactivada (README, «Cuentas y laboratorios»).
 *
 * Este módulo se carga aparte (import dinámico) para que la primera pantalla no espere a Firebase.
 */

export interface SesionFirebase {
  remoto: AlmacenRemoto
  correo: string
  /** Lee del servidor, una vez, todo el stock de un laboratorio (sin lo borrado). Falla sin conexión. */
  leerLaboratorio(id: string): Promise<VolcadoDatos>
  /** Marca de una migración ya hecha (`laboratorios/{lab}/migraciones/{nombre}`), o null. */
  leerMarca(laboratorio: string, nombre: string): Promise<Record<string, unknown> | null>
  guardarMarca(laboratorio: string, nombre: string, datos: Record<string, unknown>): Promise<void>
  cerrar(opciones?: { cerrarSesion?: boolean }): Promise<void>
}

/**
 * Nombre de la app de Firebase. La sesión que Firebase guarda en el móvil va ligada a él: no
 * cambiarlo, o todos tendrían que volver a entrar.
 */
const NOMBRE_APP = 'stock-laboratorio'

/** Entra con la cuenta de la persona; la sesión queda guardada en el móvil. Devuelve el correo. */
export async function entrarEnFirebase(configuracion: FirebaseOptions, correo: string, contrasena: string): Promise<string> {
  const app = initializeApp(configuracion, NOMBRE_APP)
  try {
    const auth = getAuth(app)
    await auth.authStateReady()
    if (auth.currentUser) await signOut(auth)
    const { user } = await signInWithEmailAndPassword(auth, correo.trim(), contrasena)
    return user.email ?? correo.trim()
  } catch (error) {
    throw traducirError(error)
  } finally {
    await deleteApp(app).catch(() => {})
  }
}

/** Cierra la sesión guardada en el móvil. */
export async function salirDeFirebase(configuracion: FirebaseOptions): Promise<void> {
  const app = initializeApp(configuracion, NOMBRE_APP)
  try {
    const auth = getAuth(app)
    await auth.authStateReady()
    await signOut(auth)
  } finally {
    await deleteApp(app).catch(() => {})
  }
}

/** Recupera la sesión guardada y abre el stock de un laboratorio (funciona también sin conexión). */
export async function abrirSesionFirebase(configuracion: FirebaseOptions, laboratorioId: string): Promise<SesionFirebase> {
  const app = initializeApp(configuracion, NOMBRE_APP)
  try {
    const auth = getAuth(app)
    await auth.authStateReady()
    const usuario = auth.currentUser
    if (!usuario) throw new ErrorSesionCaducada()
    const db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      // Caché en el móvil: los cambios hechos sin conexión se guardan y se mandan al volver.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
    const marca = (laboratorio: string, nombre: string) => doc(db, 'laboratorios', laboratorio, 'migraciones', nombre)
    return {
      remoto: new RemotoFirestore(db, laboratorioId),
      correo: usuario.email ?? '',
      leerLaboratorio: (id) => leerLaboratorio(db, id),
      leerMarca: async (laboratorio, nombre) => {
        const documento = await getDocFromServer(marca(laboratorio, nombre))
        return documento.exists() ? documento.data() : null
      },
      guardarMarca: (laboratorio, nombre, datos) =>
        setDoc(marca(laboratorio, nombre), { ...datos, fecha: serverTimestamp() }),
      cerrar: (opciones) => cerrar(app, auth, opciones?.cerrarSesion ?? false),
    }
  } catch (error) {
    await deleteApp(app).catch(() => {})
    throw traducirError(error)
  }
}

async function leerLaboratorio(db: Firestore, id: string): Promise<VolcadoDatos> {
  const volcado: VolcadoDatos = { productos: [], movimientos: [], fotos: [], pedidos: [] }
  for (const tabla of TABLAS) {
    const instantanea = await getDocsFromServer(collection(db, 'laboratorios', id, tabla))
    const filas = instantanea.docs
      .filter((d) => d.data().borrado !== true)
      .map((d) => deRemoto(tabla, d.id, deFirestore(d.data())))
    ;(volcado[tabla] as unknown[]).push(...filas)
  }
  return volcado
}

async function cerrar(app: FirebaseApp, auth: Auth, cerrarSesion: boolean): Promise<void> {
  if (cerrarSesion) await signOut(auth).catch(() => {})
  await deleteApp(app)
}

export class ErrorSesion extends Error {}

/** No hay sesión guardada en el móvil (o ya no vale): hay que volver a entrar. */
export class ErrorSesionCaducada extends ErrorSesion {
  constructor() {
    super('La sesión ha caducado: vuelve a entrar con tu cuenta.')
  }
}

function traducirError(error: unknown): Error {
  if (error instanceof ErrorSesion) return error
  const codigo = (error as { code?: unknown } | null)?.code
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return new ErrorSesion('El correo o la contraseña no son correctos.')
    case 'auth/network-request-failed':
      return new ErrorSesion('No hay conexión. Para entrar la primera vez hace falta internet.')
    case 'auth/too-many-requests':
      return new ErrorSesion('Demasiados intentos. Espera unos minutos y vuelve a probar.')
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return new ErrorSesion('La configuración de Firebase no es válida (apiKey).')
    case 'auth/missing-password':
      return new ErrorSesion('Escribe la contraseña.')
    case 'auth/operation-not-allowed':
      return new ErrorSesion('En Firebase falta activar el inicio de sesión con correo y contraseña.')
    case 'auth/user-disabled':
      return new ErrorSesion('Esta cuenta está deshabilitada en Firebase. Pide que la vuelvan a habilitar.')
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
