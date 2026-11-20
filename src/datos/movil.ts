import Dexie, { type EntityTable } from 'dexie'
import { esIdLaboratorio, type IdLaboratorio } from './laboratorios'

/**
 * Datos del propio móvil que no son de ningún laboratorio: quién ha entrado y qué laboratorio ve
 * cada cuenta. El stock de cada laboratorio va en su propia base de datos (BaseDatosStock).
 * También la lee public/sw-avisos.js para saber qué laboratorio revisar.
 */
export const NOMBRE_BASE_MOVIL = 'stock-laboratorio-movil'

/** Clave del registro con la sesión (también la usa public/sw-avisos.js). */
export const CLAVE_SESION = 'sesion'

export interface CuentaEnMovil {
  /** Nombre con el que se firman los movimientos. */
  usuario: string
  /** Laboratorio que ve esta cuenta; vacío = aún no ha elegido. */
  laboratorio: IdLaboratorio | ''
}

export interface RegistroSesion {
  /** Correo de la cuenta que ha entrado; vacío = nadie (pantalla de inicio de sesión). */
  actual: string
  /** Lo que se recuerda de cada cuenta que ha entrado en este móvil. */
  cuentas: Record<string, CuentaEnMovil>
}

export const SESION_VACIA: RegistroSesion = { actual: '', cuentas: {} }

class BaseDatosMovil extends Dexie {
  declare ajustes: EntityTable<{ clave: string; valor: RegistroSesion }, 'clave'>

  constructor() {
    super(NOMBRE_BASE_MOVIL)
    this.version(1).stores({ ajustes: 'clave' })
  }
}

let db: BaseDatosMovil | undefined

function abrir(): BaseDatosMovil {
  db ??= new BaseDatosMovil()
  return db
}

export async function leerRegistroSesion(): Promise<RegistroSesion> {
  const valor = (await abrir().ajustes.get(CLAVE_SESION))?.valor
  if (!valor || typeof valor.actual !== 'string' || typeof valor.cuentas !== 'object') return SESION_VACIA
  const cuentas: Record<string, CuentaEnMovil> = {}
  for (const [correo, cuenta] of Object.entries(valor.cuentas)) {
    cuentas[correo] = {
      usuario: typeof cuenta.usuario === 'string' ? cuenta.usuario : '',
      laboratorio: esIdLaboratorio(cuenta.laboratorio) ? cuenta.laboratorio : '',
    }
  }
  return { actual: valor.actual, cuentas }
}

export async function guardarRegistroSesion(registro: RegistroSesion): Promise<void> {
  await abrir().ajustes.put({ clave: CLAVE_SESION, valor: registro })
}
