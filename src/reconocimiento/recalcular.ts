import type { StockRepository } from '../datos/StockRepository'
import { ErrorStock } from '../dominio/errores'
import { lienzoDeMiniatura } from './camara'
import type { Extractor } from './modelo'

/**
 * Recalcula con este móvil el vector de cada foto de referencia del laboratorio a partir de su
 * miniatura (Ajustes → Fotos de referencia). Repara los vectores que calculó mal otro móvil (o este,
 * antes de la autoprueba); las fotos no cambian. Los cambios se sincronizan como cualquier otro.
 */

export interface ResultadoRecalculo {
  total: number
  recalculadas: number
  /** Miniaturas negras o sin detalle: su vector no se toca (hay que borrar esas fotos). */
  descartadas: number
}

const TAMANO_LOTE = 10

export async function recalcularVectores(
  repo: StockRepository,
  extractor: Extractor,
  alAvanzar: (hechas: number, total: number) => void = () => {},
): Promise<ResultadoRecalculo> {
  const fotos = await repo.listarFotos()
  const total = fotos.length
  let recalculadas = 0
  let descartadas = 0
  let lote: { id: string; embedding: number[] }[] = []
  const guardarLote = async () => {
    if (lote.length === 0) return
    recalculadas += await repo.actualizarEmbeddings(lote)
    lote = []
  }

  alAvanzar(0, total)
  for (const [i, foto] of fotos.entries()) {
    try {
      const { vector } = await extractor.embedding(await lienzoDeMiniatura(foto.miniatura))
      lote.push({ id: foto.id, embedding: vector })
    } catch (error) {
      if (!(error instanceof ErrorStock && error.codigo === 'foto-no-valida')) throw error
      descartadas++
    }
    if (lote.length >= TAMANO_LOTE) await guardarLote()
    alAvanzar(i + 1, total)
  }
  await guardarLote()
  return { total, recalculadas, descartadas }
}
