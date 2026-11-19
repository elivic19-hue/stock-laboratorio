import { useEffect } from 'react'
import type { AjustesDispositivo } from '../datos/ajustes'
import type { Producto } from '../datos/tipos'
import { formatearNumero } from '../dominio/formato'
import { useResumenStock } from './hooks'
import { navegar } from './navegacion'
import { leerRuta } from './rutas'

/**
 * Avisos fuera de la app (CLAUDE.md §7, «Avisos»): notificaciones locales del móvil y el número
 * de productos a pedir en el icono. Todo sin servidor: el aviso diario de lotes caducados lo da el
 * service worker con Periodic Background Sync (public/sw-avisos.js), que solo existe en Chrome
 * para Android con la app instalada.
 */

export type PermisoAvisos = NotificationPermission | 'no-disponible'

/** Etiqueta del aviso diario (la misma que usa public/sw-avisos.js). */
const ETIQUETA_AVISO_DIARIO = 'avisos-diarios'
const DOCE_HORAS = 12 * 60 * 60 * 1000
const ICONO = 'iconos/icono-192.png'

export function permisoAvisos(): PermisoAvisos {
  return typeof Notification === 'undefined' ? 'no-disponible' : Notification.permission
}

export async function pedirPermisoAvisos(): Promise<PermisoAvisos> {
  if (typeof Notification === 'undefined') return 'no-disponible'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** El service worker si ya está registrado (en desarrollo no lo hay). */
async function registroServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    return await navigator.serviceWorker?.getRegistration()
  } catch {
    return undefined
  }
}

interface DatosNotificacion {
  cuerpo: string
  /** Una notificación con la misma etiqueta sustituye a la anterior en vez de acumularse. */
  etiqueta: string
  /** Pantalla que se abre al tocarla («#/pedir»). */
  ruta: string
}

/** Muestra una notificación del móvil. Devuelve false si no se ha podido (sin permiso, etc.). */
export async function enviarNotificacion(titulo: string, datos: DatosNotificacion): Promise<boolean> {
  if (permisoAvisos() !== 'granted') return false
  const opciones: NotificationOptions = {
    body: datos.cuerpo,
    tag: datos.etiqueta,
    icon: ICONO,
    lang: 'es-ES',
    data: { ruta: datos.ruta },
  }
  try {
    const registro = await registroServiceWorker()
    if (registro) {
      // En Android solo funcionan las notificaciones del service worker.
      await registro.showNotification(titulo, opciones)
    } else {
      const notificacion = new Notification(titulo, opciones)
      notificacion.onclick = () => {
        window.focus()
        navegar(leerRuta(datos.ruta))
      }
    }
    return true
  } catch (error) {
    console.warn('No se pudo mostrar la notificación', error)
    return false
  }
}

/** Tras una retirada que deja el producto en su mínimo o por debajo (y sin pedido en curso). */
export function notificarBajoMinimo(producto: Producto, ajustes: AjustesDispositivo): void {
  if (!ajustes.avisosEnElMovil) return
  void enviarNotificacion(`Hay que pedir: ${producto.nombre}`, {
    cuerpo:
      `Quedan ${formatearNumero(producto.stockActual)} ${producto.unidadCorta} ` +
      `(mínimo ${formatearNumero(producto.stockMinimo)}). Ya está en «A pedir».`,
    etiqueta: `bajo-minimo-${producto.id}`,
    ruta: '#/pedir',
  })
}

// ─── Aviso diario (Periodic Background Sync) ────────────────────────────────

interface RegistroConSync extends ServiceWorkerRegistration {
  periodicSync?: {
    register(etiqueta: string, opciones?: { minInterval: number }): Promise<void>
    unregister(etiqueta: string): Promise<void>
    getTags(): Promise<string[]>
  }
}

/**
 * - activo: el móvil revisará los lotes caducados aunque la app esté cerrada (una vez al día como
 *   mucho; el sistema decide la hora).
 * - instalar: el navegador lo permite, pero solo con la app instalada.
 * - no-disponible: este navegador no lo permite (iPhone, Firefox…).
 */
export type EstadoAvisoDiario = 'activo' | 'inactivo' | 'instalar' | 'no-disponible'

/** Activa o desactiva la revisión diaria en segundo plano y dice cómo ha quedado. */
export async function prepararAvisoDiario(activar: boolean): Promise<EstadoAvisoDiario> {
  const registro = (await registroServiceWorker()) as RegistroConSync | undefined
  const sync = registro?.periodicSync
  if (!sync) return 'no-disponible'
  try {
    if (!activar) {
      await sync.unregister(ETIQUETA_AVISO_DIARIO)
      return 'inactivo'
    }
    const permiso = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName })
    if (permiso.state !== 'granted') return 'instalar'
    await sync.register(ETIQUETA_AVISO_DIARIO, { minInterval: DOCE_HORAS })
    return 'activo'
  } catch (error) {
    console.warn('No se pudo preparar el aviso diario', error)
    return 'no-disponible'
  }
}

// ─── Número en el icono ─────────────────────────────────────────────────────

type NavegadorConInsignia = Navigator & {
  setAppBadge?: (numero?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Pone en el icono de la app el número de productos a pedir (si el navegador lo permite). */
export function useInsigniaIcono(): void {
  const aPedir = useResumenStock()?.aPedir
  useEffect(() => {
    if (aPedir === undefined) return
    const nav = navigator as NavegadorConInsignia
    const peticion = aPedir > 0 ? nav.setAppBadge?.(aPedir) : nav.clearAppBadge?.()
    peticion?.catch(() => {
      // Sin permiso o sin soporte: el número sigue en la barra de la app.
    })
  }, [aPedir])
}

/** Al tocar una notificación con la app abierta, el service worker pide ir a su pantalla. */
export function escucharServiceWorker(): void {
  navigator.serviceWorker?.addEventListener('message', (evento: MessageEvent<unknown>) => {
    const datos = evento.data as { tipo?: unknown; ruta?: unknown } | null
    if (datos?.tipo === 'navegar' && typeof datos.ruta === 'string') navegar(leerRuta(datos.ruta))
  })
}
