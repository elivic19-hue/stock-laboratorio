import { useSyncExternalStore } from 'react'
import type { BaseDatosStock } from '../db'
import type { LocalRepository } from '../LocalRepository'
import { CONFIGURACION_FIREBASE } from './configuracion'
import {
  LABORATORIO_ANTERIOR,
  LABORATORIO_DESTINO,
  MARCA_MIGRACION,
  planificarMigracion,
  type ResumenMigracion,
} from './migracionPrincipal'
import type { SesionFirebase } from './RemotoFirebase'
import { MARCAS_INICIALES, Sincronizador, type EstadoSincronizador, type MarcasSincronizacion } from './Sincronizador'

/**
 * Cuenta de Firebase y sincronización del laboratorio abierto (fase 2).
 *
 * La sesión de Firebase se guarda en el móvil, así que la app abre sin conexión. Mientras se ve un
 * laboratorio, su stock se sincroniza con la nube; al cambiar de laboratorio se para y se empieza
 * la del otro. Todo pasa por una cola para que nunca haya dos apps de Firebase abiertas a la vez.
 */

export type EstadoSincronizacion =
  | { modo: 'parado' }
  | { modo: 'iniciando' }
  | ({ modo: 'conectado' } & EstadoSincronizador)
  | { modo: 'error'; mensaje: string }

/** Registro en la tabla «ajustes» de la base de datos del laboratorio: hasta dónde ha recibido. */
const CLAVE = 'sincronizacion'

interface RegistroSincronizacion {
  marcas: MarcasSincronizacion
}

let sesion: SesionFirebase | undefined
let sincronizador: Sincronizador | undefined
let estado: EstadoSincronizacion = { modo: 'parado' }
let cola: Promise<unknown> = Promise.resolve()
const oyentes = new Set<() => void>()

function cambiarEstado(nuevo: EstadoSincronizacion): void {
  estado = nuevo
  for (const oyente of oyentes) oyente()
}

export function useEstadoSincronizacion(): EstadoSincronizacion {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    () => estado,
  )
}

function enCola<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = cola.then(tarea)
  cola = resultado.catch(() => {})
  return resultado
}

function cargarFirebase() {
  return import('./RemotoFirebase')
}

/** Entra con la cuenta de la persona (hace falta conexión). Devuelve el correo de la cuenta. */
export function iniciarSesion(correo: string, contrasena: string): Promise<string> {
  return enCola(async () => {
    await parar()
    const { entrarEnFirebase } = await cargarFirebase()
    return entrarEnFirebase(CONFIGURACION_FIREBASE, correo, contrasena)
  })
}

/** Para la sincronización y cierra la sesión de Firebase en este móvil. */
export function cerrarSesion(): Promise<void> {
  return enCola(async () => {
    await parar()
    const { salirDeFirebase } = await cargarFirebase()
    await salirDeFirebase(CONFIGURACION_FIREBASE).catch(() => {})
  })
}

/**
 * Empieza a sincronizar el stock de un laboratorio. Si el móvil ya no tiene la sesión guardada,
 * llama a `alCaducarSesion` (hay que volver a entrar).
 */
export function prepararSincronizacion(
  db: BaseDatosStock,
  repo: LocalRepository,
  laboratorioId: string,
  alCaducarSesion: () => void,
  /** Se ha recuperado el stock de antes de separar los laboratorios (solo en Cromatografía, una vez). */
  alRecuperarStock?: (resumen: ResumenMigracion) => void,
): Promise<void> {
  return enCola(async () => {
    await parar()
    cambiarEstado({ modo: 'iniciando' })
    const modulo = await cargarFirebase()
    try {
      sesion = await modulo.abrirSesionFirebase(CONFIGURACION_FIREBASE, laboratorioId)
    } catch (error) {
      if (error instanceof modulo.ErrorSesionCaducada) {
        cambiarEstado({ modo: 'parado' })
        alCaducarSesion()
      } else {
        cambiarEstado({ modo: 'error', mensaje: mensaje(error) })
      }
      return
    }
    const registro = (await db.ajustes.get(CLAVE))?.valor as RegistroSincronizacion | undefined
    let marcasPendientes: ReturnType<typeof setTimeout> | undefined
    const nuevo = new Sincronizador({
      db,
      remoto: sesion.remoto,
      marcas: { ...MARCAS_INICIALES, ...registro?.marcas },
      alGuardarMarcas: (marcas) => {
        clearTimeout(marcasPendientes)
        const valor: RegistroSincronizacion = { marcas }
        marcasPendientes = setTimeout(() => void db.ajustes.put({ clave: CLAVE, valor }).catch(() => {}), 500)
      },
      alCambiarDatos: () => repo.avisarCambioExterno(),
      alCambiarEstado: (e) => {
        if (sincronizador === nuevo) cambiarEstado({ modo: 'conectado', ...e })
      },
    })
    sincronizador = nuevo
    cambiarEstado({ modo: 'conectado', ...nuevo.estado })
    nuevo.iniciar()
    if (laboratorioId === LABORATORIO_DESTINO) {
      void recuperarStockAnterior(sesion, nuevo, db, repo, alRecuperarStock)
    }
  })
}

/**
 * Trae a Cromatografía el stock que quedó en el laboratorio «principal» al separar los
 * laboratorios (migracionPrincipal.ts). Se hace una sola vez para todos: lo hace el primer móvil
 * que abre Cromatografía con conexión, y una marca en la nube evita que se repita. Si algo falla
 * (p. ej. sin conexión), no se deja marca y se vuelve a intentar la próxima vez.
 */
async function recuperarStockAnterior(
  conexion: SesionFirebase,
  sinc: Sincronizador,
  db: BaseDatosStock,
  repo: LocalRepository,
  alRecuperar: ((resumen: ResumenMigracion) => void) | undefined,
): Promise<void> {
  try {
    if (await conexion.leerMarca(LABORATORIO_DESTINO, MARCA_MIGRACION)) return
    // Hay que tener ya en el móvil lo que hay en la nube, para saber qué productos están.
    if (!(await esperarServidor(sinc))) return
    if (await conexion.leerMarca(LABORATORIO_DESTINO, MARCA_MIGRACION)) return // otro móvil se ha adelantado
    const origen = await conexion.leerLaboratorio(LABORATORIO_ANTERIOR)
    if (sincronizador !== sinc) return // se ha cambiado de laboratorio mientras tanto
    const plan = planificarMigracion(origen, await repo.volcar())
    if (plan.productos.length + plan.movimientos.length + plan.fotos.length + plan.pedidos.length > 0) {
      // Escritura normal del móvil (no «remota»): la sincronización la sube a la nube del laboratorio.
      await db.transaction('rw', db.productos, db.movimientos, db.fotos, db.pedidos, async () => {
        await db.productos.bulkAdd(plan.productos)
        await db.movimientos.bulkAdd(plan.movimientos)
        await db.fotos.bulkAdd(plan.fotos)
        await db.pedidos.bulkAdd(plan.pedidos)
      })
      repo.avisarCambioExterno()
    }
    await conexion.guardarMarca(LABORATORIO_DESTINO, MARCA_MIGRACION, {
      por: conexion.correo,
      productosAntes: origen.productos.length,
      ...plan.resumen,
    })
    if (plan.resumen.productosNuevos > 0 || plan.resumen.fotos > 0) alRecuperar?.(plan.resumen)
  } catch (error) {
    console.warn('No se pudo recuperar el stock anterior; se volverá a intentar', error)
  }
}

/** Espera (como mucho 30 s) a que el móvil haya recibido lo que hay en la nube. */
async function esperarServidor(sinc: Sincronizador): Promise<boolean> {
  for (let i = 0; i < 60 && !sinc.estado.conServidor; i++) await new Promise((r) => setTimeout(r, 500))
  if (!sinc.estado.conServidor) return false
  await sinc.esperar({ confirmados: false })
  return true
}

/** Deja de sincronizar (al salir del laboratorio). Los datos se quedan en el móvil. */
export function detenerSincronizacion(): Promise<void> {
  return enCola(parar)
}

async function parar(): Promise<void> {
  const anterior = sincronizador
  sincronizador = undefined
  if (anterior) {
    // Lo que estaba por mandar pasa a la caché de Firebase, que lo manda al volver a abrir.
    await anterior.esperar({ confirmados: false }).catch(() => {})
    anterior.detener()
  }
  await sesion?.cerrar().catch(() => {})
  sesion = undefined
  cambiarEstado({ modo: 'parado' })
}

/**
 * Para cambios que sustituyen todo (restaurar una copia): se manda también lo que se ha borrado,
 * así que el cambio llega a todos los móviles del laboratorio.
 */
export async function conTodoSincronizado(cambiar: () => Promise<void>): Promise<void> {
  if (sincronizador) await sincronizador.conTodoMarcado(cambiar)
  else await cambiar()
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo conectar con el laboratorio.'
}
