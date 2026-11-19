import type { InputHTMLAttributes } from 'react'
import { Icono } from './Icono'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
}

/** Campo de búsqueda con lupa (maqueta Main). La etiqueta es real, aunque solo la oigan los lectores de pantalla. */
export function Buscador({ etiqueta, valor, alCambiar, className, ...resto }: Props) {
  return (
    <label className={className ? `buscador ${className}` : 'buscador'}>
      <Icono nombre="buscar" tamano={18} />
      <span className="solo-lector">{etiqueta}</span>
      <input
        type="search"
        className="buscador__entrada"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        {...resto}
      />
      {valor && (
        <button type="button" className="buscador__borrar" aria-label="Borrar búsqueda" onClick={() => alCambiar('')}>
          <Icono nombre="cerrar" tamano={16} />
        </button>
      )}
    </label>
  )
}
