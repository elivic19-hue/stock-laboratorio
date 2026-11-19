import type { ReactNode } from 'react'
import { ContextoServicios, type Servicios } from './contexto'

export function ProveedorServicios({ servicios, children }: { servicios: Servicios; children: ReactNode }) {
  return <ContextoServicios value={servicios}>{children}</ContextoServicios>
}
