import type { FirebaseOptions } from 'firebase/app'
import { useSyncExternalStore } from 'react'
import type { BaseDatosStock } from '../db'
import type { LocalRepository } from '../LocalRepository'
import type { SesionFirebase } from './RemotoFirebase'
import { MARCAS_INICIALES, Sincronizador, type EstadoSincronizador, type MarcasSincronizacion } from './Sincronizador'

/**
 * Conexión de este móvil con el laboratorio en la nube (fase 2). Guarda en el móvil con qué cuenta
 * está conectado y hasta dónde ha recibido, y al abrir la app reanuda la sincronización.
 */

export type EstadoSincronizacion =
  | { modo: 'local' }
  | { modo: 'iniciando'; correo: string }
  | ({ modo: 'conectado'; correo: string } & EstadoSincronizador)
  | { modo: 'error'; correo: string; mensaje: string }

interface ConexionGuardada {
  configuracion: FirebaseOptions
  correo: string
  laboratorioId: string
  marcas: MarcasSincronizacion
}

/** Registro en la tabla «ajustes» (es del móvil, no del laboratorio). */
const CLAVE = 'sincronizacion'

let contexto: { db: BaseDatosStock; repo: LocalRepository } | undefined
let sesion: SesionFirebase | undefined
let sincronizador: Sincronizador | undefined
let estado: EstadoSincronizacion = { modo: 'local' }
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

export function estaConectado(): boolean {
  return sincronizador !== undefined
}

function exigirContexto() {
  if (!contexto) throw new Error('Falta llamar a prepararSincronizacion')
  return contexto
}

async function leerGuardada(): Promise<ConexionGuardada | undefined> {
  const registro = await exigirContexto().db.ajustes.get(CLAVE)
  return registro?.valor as ConexionGuardada | undefined
}

async function guardar(conexion: ConexionGuardada | undefined): Promise<void> {
  const { db } = exigirContexto()
  if (conexion) await db.ajustes.put({ clave: CLAVE, valor: conexion })
  else await db.ajustes.delete(CLAVE)
}

async function cargarFirebase() {
  return import('./RemotoFirebase')
}

/** Al abrir la app: si el móvil estaba conectado, reanuda la sincronización (también sin conexión). */
export async function prepararSincronizacion(db: BaseDatosStock, repo: LocalRepository): Promise<void> {
  contexto = { db, repo }
  const guardada = await leerGuardada()
  if (!guardada) return
  cambiarEstado({ modo: 'iniciando', correo: guardada.correo })
  try {
    const { abrirSesionFirebase } = await cargarFirebase()
    sesion = await abrirSesionFirebase(guardada.configuracion)
    if (sesion.laboratorioId !== guardada.laboratorioId) {
      throw new Error('La sesión guardada es de otra cuenta: vuelve a conectar este móvil.')
    }
    empezar(guardada)
  } catch (error) {
    cambiarEstado({ modo: 'error', correo: guardada.correo, mensaje: mensaje(error) })
  }
}

function empezar(conexion: ConexionGuardada): void {
  const { db, repo } = exigirContexto()
  if (!sesion) throw new Error('Sin sesión')
  let marcasPendientes: ReturnType<typeof setTimeout> | undefined
  let actual = conexion
  sincronizador = new Sincronizador({
    db,
    remoto: sesion.remoto,
    marcas: conexion.marcas,
    alGuardarMarcas: (marcas) => {
      actual = { ...actual, marcas }
      clearTimeout(marcasPendientes)
      marcasPendientes = setTimeout(() => void guardar(actual), 500)
    },
    alCambiarDatos: () => repo.avisarCambioExterno(),
    alCambiarEstado: (e) => cambiarEstado({ modo: 'conectado', correo: conexion.correo, ...e }),
  })
  cambiarEstado({ modo: 'conectado', correo: conexion.correo, ...sincronizador.estado })
  sincronizador.iniciar()
}

export interface SituacionAlConectar {
  /** Productos que hay ahora en este móvil. */
  productosEnElMovil: number
}

/**
 * Conecta este móvil a la cuenta del laboratorio.
 * - Si la nube está vacía, sube lo que hay en el móvil (es el primer móvil).
 * - Si la nube tiene datos, el móvil se queda con los del laboratorio. Si el móvil también tenía
 *   datos, antes se pregunta con `confirmarSustituir` (si dice que no, no se conecta).
 */
export async function conectar(
  configuracion: FirebaseOptions,
  correo: string,
  contrasena: string,
  confirmarSustituir: (situacion: SituacionAlConectar) => Promise<boolean>,
): Promise<'subidos' | 'bajados' | 'cancelado'> {
  const { repo } = exigirContexto()
  await desconectar({ olvidar: false })
  const { abrirSesionFirebase } = await cargarFirebase()
  const nueva = await abrirSesionFirebase(configuracion, { correo, contrasena })
  try {
    const laboratorioTieneDatos = await nueva.remoto.hayDatos()
    const recuento = await repo.contar()
    const movilTieneDatos = recuento.productos + recuento.movimientos + recuento.fotos + recuento.pedidos > 0
    if (laboratorioTieneDatos && movilTieneDatos) {
      if (!(await confirmarSustituir({ productosEnElMovil: recuento.productos }))) {
        await nueva.cerrar({ cerrarSesion: true })
        return 'cancelado'
      }
    }
    const conexion: ConexionGuardada = {
      configuracion,
      correo: nueva.correo,
      laboratorioId: nueva.laboratorioId,
      marcas: MARCAS_INICIALES,
    }
    await guardar(conexion)
    sesion = nueva
    empezar(conexion)
    if (laboratorioTieneDatos) {
      sincronizador?.detener()
      await sincronizador?.vaciarLocal()
      sincronizador?.iniciar()
      return 'bajados'
    }
    await sincronizador?.marcarTodo()
    return 'subidos'
  } catch (error) {
    await nueva.cerrar({ cerrarSesion: true }).catch(() => {})
    throw error
  }
}

/**
 * Deja de sincronizar. Los datos se quedan en el móvil como copia local. Con `olvidar` (lo normal)
 * también cierra la sesión y olvida la cuenta.
 */
export async function desconectar({ olvidar = true }: { olvidar?: boolean } = {}): Promise<void> {
  sincronizador?.detener()
  sincronizador = undefined
  await sesion?.cerrar({ cerrarSesion: olvidar }).catch(() => {})
  sesion = undefined
  if (olvidar) await guardar(undefined)
  cambiarEstado({ modo: 'local' })
}

/**
 * Para cambios que sustituyen todo (restaurar una copia): con el móvil conectado, se manda también
 * lo que se ha borrado, así que el cambio llega a todo el laboratorio.
 */
export async function conTodoSincronizado(cambiar: () => Promise<void>): Promise<void> {
  if (sincronizador) await sincronizador.conTodoMarcado(cambiar)
  else await cambiar()
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo conectar con el laboratorio.'
}
