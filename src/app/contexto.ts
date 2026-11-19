import { createContext, useContext } from 'react'
import type { AlmacenAjustes } from '../datos/ajustes'
import type { StockRepository } from '../datos/StockRepository'

/** Lo que las pantallas pueden usar. Solo interfaces: nunca Dexie directamente. */
export interface Servicios {
  repo: StockRepository
  ajustes: AlmacenAjustes
}

export const ContextoServicios = createContext<Servicios | null>(null)

export function useServicios(): Servicios {
  const servicios = useContext(ContextoServicios)
  if (!servicios) throw new Error('Falta <ProveedorServicios> alrededor de la app.')
  return servicios
}

export function useRepositorio(): StockRepository {
  return useServicios().repo
}

export function useAlmacenAjustes(): AlmacenAjustes {
  return useServicios().ajustes
}
