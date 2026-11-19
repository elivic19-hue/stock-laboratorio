import type { BaseDatosStock } from './db'

/**
 * Ajustes de este móvil. Van aparte de StockRepository porque son del dispositivo, no del
 * laboratorio: en la fase 2 seguirán guardándose en local.
 */
export interface AjustesDispositivo {
  /** Nombre o iniciales de quien usa el móvil. Vacío = primer arranque sin hacer. */
  usuario: string
  laboratorio: string
  /** Puntuación mínima (similitud coseno) para proponer un producto como seguro. Se calibra en la etapa 3. */
  umbral: number
  /** Temperatura del softmax que da el % de confianza. Se calibra en la etapa 3. */
  temperatura: number
  modoDiagnostico: boolean
  /**
   * Proponer guardar la foto de una retirada como referencia del producto (CLAUDE.md §5.6). Desactivado
   * por defecto a petición del usuario (docs/decisiones.md, «Cambios tras la etapa 4»). Sustituye a
   * «guardarFotoAlConfirmar», que estaba activado y se ignora.
   */
  aprenderDeRetiradas: boolean
  /** Notificaciones del móvil (bajo mínimo al retirar y aviso diario de lotes caducados). */
  avisosEnElMovil: boolean
  /** ISO de la última copia de seguridad guardada desde este móvil; vacío si nunca. */
  ultimaCopia: string
  /**
   * AAAA-MM-DD del último aviso diario de lotes caducados. Lo escribe también el service worker
   * (public/sw-avisos.js), que lee y guarda este mismo registro.
   */
  ultimoAvisoCaducados: string
}

export const AJUSTES_INICIALES: AjustesDispositivo = {
  usuario: '',
  laboratorio: '',
  umbral: 0.6,
  temperatura: 0.05,
  modoDiagnostico: false,
  aprenderDeRetiradas: false,
  avisosEnElMovil: false,
  ultimaCopia: '',
  ultimoAvisoCaducados: '',
}

export interface AlmacenAjustes {
  leer(): Promise<AjustesDispositivo>
  guardar(cambios: Partial<AjustesDispositivo>): Promise<AjustesDispositivo>
  /** Vuelve a los ajustes iniciales (y, por tanto, al primer arranque). */
  borrar(): Promise<void>
  suscribir(alCambiar: () => void): () => void
}

/** Clave del registro en la tabla «ajustes» (también la usa public/sw-avisos.js). */
export const CLAVE_AJUSTES = 'dispositivo'

export class AlmacenAjustesLocal implements AlmacenAjustes {
  readonly #db: BaseDatosStock
  readonly #oyentes = new Set<() => void>()

  constructor(db: BaseDatosStock) {
    this.#db = db
  }

  async leer(): Promise<AjustesDispositivo> {
    const registro = await this.#db.ajustes.get(CLAVE_AJUSTES)
    return { ...AJUSTES_INICIALES, ...(registro?.valor as Partial<AjustesDispositivo> | undefined) }
  }

  async guardar(cambios: Partial<AjustesDispositivo>): Promise<AjustesDispositivo> {
    const limpios = Object.fromEntries(
      Object.entries(cambios)
        .filter(([, valor]) => valor !== undefined)
        .map(([clave, valor]) => [clave, typeof valor === 'string' ? valor.trim() : valor]),
    ) as Partial<AjustesDispositivo>

    const nuevos = await this.#db.transaction('rw', this.#db.ajustes, async () => {
      const actuales = await this.leer()
      const siguientes = { ...actuales, ...limpios }
      await this.#db.ajustes.put({ clave: CLAVE_AJUSTES, valor: siguientes })
      return siguientes
    })
    this.#avisar()
    return nuevos
  }

  async borrar(): Promise<void> {
    await this.#db.ajustes.delete(CLAVE_AJUSTES)
    this.#avisar()
  }

  suscribir(alCambiar: () => void): () => void {
    this.#oyentes.add(alCambiar)
    return () => {
      this.#oyentes.delete(alCambiar)
    }
  }

  #avisar(): void {
    for (const oyente of this.#oyentes) oyente()
  }
}
