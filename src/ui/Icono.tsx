/**
 * Iconos de trazo fino sacados de las maquetas (diseno/). Todos en una rejilla de 24 px,
 * con trazo redondeado y el color del texto (currentColor).
 */
const TRAZOS = {
  perfil: { grosor: 1.6, contenido: <><circle cx="12" cy="9" r="3.5" /><path d="M5.5 19c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" /></> },
  buscar: { grosor: 1.8, contenido: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></> },
  filtros: { grosor: 1.6, contenido: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></> },
  stock: { grosor: 1.7, contenido: <><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></> },
  pedir: { grosor: 1.7, contenido: <><path d="M6 4h12v16H6z" /><path d="M9 9h6M9 13h6M9 17h3" /></> },
  camara: { grosor: 1.8, contenido: <><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></> },
  mas: { grosor: 1.7, contenido: <path d="M12 5v14M5 12h14" /> },
  catalogo: { grosor: 1.7, contenido: <path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" /> },
  cerrar: { grosor: 1.8, contenido: <path d="M6 6l12 12M18 6L6 18" /> },
  linterna: { grosor: 1.7, contenido: <path d="M13 3L5 14h6l-1 7 8-11h-6z" /> },
  compartir: { grosor: 1.8, contenido: <path d="M12 4v11M7 9l5-5 5 5M5 15v5h14v-5" /> },
  volver: { grosor: 1.8, contenido: <path d="M15 5l-7 7 7 7" /> },
  siguiente: { grosor: 2, contenido: <path d="M9 6l6 6-6 6" /> },
  desplegar: { grosor: 1.8, contenido: <path d="M6 9l6 6 6-6" /> },
  info: { grosor: 1.8, contenido: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></> },
} as const

export type NombreIcono = keyof typeof TRAZOS

interface Props {
  nombre: NombreIcono
  tamano?: number
  grosor?: number
  className?: string
}

export function Icono({ nombre, tamano = 20, grosor, className }: Props) {
  const { grosor: grosorPorDefecto, contenido } = TRAZOS[nombre]
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor ?? grosorPorDefecto}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {contenido}
    </svg>
  )
}
