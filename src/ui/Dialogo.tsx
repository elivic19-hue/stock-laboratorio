import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  abierto: boolean
  alCerrar: () => void
  titulo: string
  children: ReactNode
}

/** Diálogo modal como hoja inferior (<dialog> nativo: atrapa el foco y se cierra con Esc). */
export function Dialogo({ abierto, alCerrar, titulo, children }: Props) {
  const referencia = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()

  useEffect(() => {
    const dialogo = referencia.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={referencia}
      className="hoja"
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(evento) => {
        // Pulsar fuera de la hoja (en el velo) la cierra.
        if (evento.target === referencia.current) alCerrar()
      }}
    >
      <div className="hoja__contenido">
        <h2 id={idTitulo} className="hoja__titulo">
          {titulo}
        </h2>
        {children}
      </div>
    </dialog>
  )
}
