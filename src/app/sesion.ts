import Dexie from 'dexie'
import { useSyncExternalStore } from 'react'
import type { AjustesDispositivo, AlmacenAjustes } from '../datos/ajustes'
import { LABORATORIOS, nombreBaseDatos, nombreLaboratorio, type IdLaboratorio } from '../datos/laboratorios'
import { guardarRegistroSesion, leerRegistroSesion, SESION_VACIA, type RegistroSesion } from '../datos/movil'
import { cerrarSesion, iniciarSesion } from '../datos/sincronizacion/servicio'

/**
 * Quién usa la app en este móvil (docs/decisiones.md, «Dos laboratorios e inicio de sesión»):
 * la app abre con el inicio de sesión, después se elige laboratorio y se entra en su stock.
 * Cada cuenta recuerda su laboratorio y su nombre en este móvil.
 */

export interface Sesion {
  correo: string
  /** Nombre con el que se firman los movimientos (por defecto, lo que va antes de la @). */
  usuario: string
  laboratorio: IdLaboratorio | ''
}

/** undefined mientras se lee; null si nadie ha entrado. */
let sesion: Sesion | null | undefined
let registro: RegistroSesion = SESION_VACIA
const oyentes = new Set<() => void>()

function publicar(nuevo: RegistroSesion): void {
  registro = nuevo
  const cuenta = nuevo.actual ? nuevo.cuentas[nuevo.actual] : undefined
  sesion = cuenta ? { correo: nuevo.actual, ...cuenta } : null
  for (const oyente of oyentes) oyente()
}

async function cambiar(nuevo: RegistroSesion): Promise<void> {
  await guardarRegistroSesion(nuevo)
  publicar(nuevo)
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Lee la sesión guardada en el móvil (al arrancar). */
export async function cargarSesion(): Promise<void> {
  try {
    publicar(await leerRegistroSesion())
  } catch (error) {
    console.error('No se pudo leer la sesión del móvil', error)
    publicar(SESION_VACIA)
  }
}

export function useSesion(): Sesion | null | undefined {
  return useSyncExternalStore(suscribir, () => sesion)
}

export function nombreDesdeCorreo(correo: string): string {
  return correo.split('@')[0]?.trim() || correo
}

/** Inicio de sesión (hace falta conexión). */
export async function entrar(correo: string, contrasena: string): Promise<void> {
  const cuenta = (await iniciarSesion(correo, contrasena)).trim().toLowerCase()
  const anterior = registro.cuentas[cuenta]
  await cambiar({
    actual: cuenta,
    cuentas: { ...registro.cuentas, [cuenta]: anterior ?? { usuario: nombreDesdeCorreo(cuenta), laboratorio: '' } },
  })
}

function cambiarCuentaActual(cambios: Partial<Sesion>): Promise<void> {
  const actual = registro.actual
  const cuenta = registro.cuentas[actual]
  if (!actual || !cuenta) return Promise.resolve()
  return cambiar({ ...registro, cuentas: { ...registro.cuentas, [actual]: { ...cuenta, ...cambios } } })
}

export function elegirLaboratorio(laboratorio: IdLaboratorio | ''): Promise<void> {
  return cambiarCuentaActual({ laboratorio })
}

export function cambiarUsuario(usuario: string): Promise<void> {
  return cambiarCuentaActual({ usuario: usuario.trim() || nombreDesdeCorreo(registro.actual) })
}

/**
 * Cierra la sesión y vuelve al inicio de sesión. Con `borrarDatos`, borra además de este móvil el
 * stock de los dos laboratorios y lo recordado de cada cuenta (la nube no se toca).
 */
export async function salir({ borrarDatos = false }: { borrarDatos?: boolean } = {}): Promise<void> {
  const nuevo = borrarDatos ? SESION_VACIA : { ...registro, actual: '' }
  // Primero se cierra la pantalla del laboratorio (deja de sincronizar y cierra su base de datos).
  await cambiar(nuevo)
  await cerrarSesion()
  if (borrarDatos) {
    for (const { id } of LABORATORIOS) await Dexie.delete(nombreBaseDatos(id))
  }
}

/**
 * Ajustes del laboratorio abierto, con el nombre del usuario (de la sesión) y el del laboratorio
 * (fijo). Las pantallas siguen usando `ajustes.usuario` y `ajustes.laboratorio` como antes.
 */
export class AjustesConSesion implements AlmacenAjustes {
  readonly #local: AlmacenAjustes
  readonly #laboratorio: IdLaboratorio

  constructor(local: AlmacenAjustes, laboratorio: IdLaboratorio) {
    this.#local = local
    this.#laboratorio = laboratorio
  }

  async leer(): Promise<AjustesDispositivo> {
    const ajustes = await this.#local.leer()
    return {
      ...ajustes,
      usuario: sesion?.usuario || nombreDesdeCorreo(sesion?.correo ?? ''),
      laboratorio: nombreLaboratorio(this.#laboratorio),
    }
  }

  async guardar(cambios: Partial<AjustesDispositivo>): Promise<AjustesDispositivo> {
    // El laboratorio no se cambia desde los ajustes (p. ej. al restaurar una copia).
    const { usuario, laboratorio: _laboratorio, ...resto } = cambios
    if (usuario !== undefined) await cambiarUsuario(usuario)
    await this.#local.guardar(resto)
    return this.leer()
  }

  borrar(): Promise<void> {
    return this.#local.borrar()
  }

  suscribir(alCambiar: () => void): () => void {
    const dejarLocal = this.#local.suscribir(alCambiar)
    const dejarSesion = suscribir(alCambiar)
    return () => {
      dejarLocal()
      dejarSesion()
    }
  }
}
