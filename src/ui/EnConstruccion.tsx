import type { ReactNode } from 'react'

/** Marca el sitio de algo que llega en una etapa posterior (CLAUDE.md §8). */
export function EnConstruccion({ etapa, children }: { etapa: number; children: ReactNode }) {
  return (
    <div className="en-construccion" role="note">
      <span className="etiqueta">En construcción · etapa {etapa}</span>
      <p>{children}</p>
    </div>
  )
}
