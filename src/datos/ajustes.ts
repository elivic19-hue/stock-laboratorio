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
  /** Guardar la foto como referencia al confirmar una retirada con buena confianza. */
  guardarFotoAlConfirmar: boolean
}

export const AJUSTES_INICIALES: AjustesDispositivo = {
  usuario: '',
  laboratorio: '',
  umbral: 0.6,
  temperatura: 0.05,
  modoDiagnostico: false,
  guardarFotoAlConfirmar: true,
}

export interface AlmacenAjustes {
  leer(): Promise<AjustesDispositivo>
  guardar(cambios: Partial<AjustesDispositivo>): Promise<AjustesDispositivo>
  /** Vuelve a los ajustes iniciales (y, por tanto, al primer arranque). */
  borrar(): Promise<void>
  suscribir(alCambiar: () => void): () => void
}

const CLAVE = 'dispositivo'

export class AlmacenAjustesLocal implements AlmacenAjustes {
  readonly #db: BaseDatosStock
  readonly #oyentes = new Set<() => void>()

  constructor(db: BaseDatosStock) {
    this.#db = db
  }

  async leer(): Promise<AjustesDispositivo> {
    const registro = await this.#db.ajustes.get(CLAVE)
    return { ...AJUSTES_INICIALES, ...registro?.valor }
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
      await this.#db.ajustes.put({ clave: CLAVE, valor: siguientes })
      return siguientes
    })
    this.#avisar()
    return nuevos
  }

  async borrar(): Promise<void> {
    await this.#db.ajustes.clear()
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
