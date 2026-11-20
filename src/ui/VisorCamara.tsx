import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  abrirCamara,
  capturarArchivo,
  capturarMarco,
  FalloCamara,
  MENSAJES_CAMARA,
  type Camara,
  type FotoCapturada,
} from '../reconocimiento/camara'
import { Icono } from './Icono'
import './VisorCamara.css'

interface Props {
  titulo: string
  alCerrar: () => void
  /** Recibe lo que había dentro del marco (hasta 640 px; el modelo lo reduce a 224). */
  alCapturar: (captura: FotoCapturada) => void
  /** Mientras es true no se puede hacer otra foto (p. ej. analizando). */
  ocupado?: boolean
  textoDisparador?: string
  /** Imagen que se muestra fija dentro del marco (la foto ya hecha). */
  congelada?: string
  /** Pastilla de estado encima del disparador. */
  estado?: ReactNode
  izquierda?: ReactNode
  derecha?: ReactNode
  /** Sin disparador ni controles de abajo (cuando la hoja de resultado tapa esa zona). */
  compacto?: boolean
}

type EstadoCamara = { fase: 'abriendo' } | { fase: 'activa' } | { fase: 'error'; mensaje: string }

/** Visor oscuro con marco cuadrado (maqueta Retirar), cerrar, linterna y disparador. */
export function VisorCamara({
  titulo,
  alCerrar,
  alCapturar,
  ocupado = false,
  textoDisparador = 'Hacer foto',
  congelada,
  estado,
  izquierda,
  derecha,
  compacto = false,
}: Props) {
  const refVideo = useRef<HTMLVideoElement>(null)
  const refMarco = useRef<HTMLDivElement>(null)
  const refArchivo = useRef<HTMLInputElement>(null)
  const [camara, setCamara] = useState<Camara | null>(null)
  const [estadoCamara, setEstadoCamara] = useState<EstadoCamara>({ fase: 'abriendo' })
  const [linterna, setLinterna] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    let abierta: Camara | null = null
    abrirCamara().then(
      (c) => {
        if (!vigente) return c.cerrar()
        abierta = c
        setCamara(c)
        setEstadoCamara({ fase: 'activa' })
      },
      (error: unknown) => {
        if (!vigente) return
        const motivo = error instanceof FalloCamara ? error.motivo : 'desconocido'
        setEstadoCamara({ fase: 'error', mensaje: MENSAJES_CAMARA[motivo] })
      },
    )
    return () => {
      vigente = false
      abierta?.cerrar()
      setCamara(null)
    }
  }, [intento])

  // El vídeo se engancha al stream cuando ya existe el elemento.
  useEffect(() => {
    const video = refVideo.current
    if (!video || !camara) return
    video.srcObject = camara.stream
    void video.play().catch(() => undefined)
  }, [camara])

  const disparar = useCallback(() => {
    const video = refVideo.current
    const marco = refMarco.current
    // Hasta tener un fotograma (HAVE_CURRENT_DATA), la foto saldría negra.
    if (ocupado || !video || !marco || video.videoWidth === 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return
    }
    alCapturar(capturarMarco(video, marco))
  }, [alCapturar, ocupado])

  async function elegirArchivo(archivo: File | undefined) {
    if (!archivo) return
    try {
      alCapturar(await capturarArchivo(archivo))
    } catch {
      setEstadoCamara({ fase: 'error', mensaje: 'No se pudo leer esa imagen.' })
    }
  }

  async function cambiarLinterna() {
    if (!camara) return
    try {
      await camara.linterna(!linterna)
      setLinterna(!linterna)
    } catch {
      // Algunos móviles anuncian linterna y luego no dejan encenderla: no se hace nada.
    }
  }

  return (
    <div className={compacto ? 'visor visor--compacto' : 'visor'}>
      <video ref={refVideo} className="visor__video" playsInline muted autoPlay aria-hidden="true" />
      <div className="visor__barra">
        <button type="button" className="visor__boton" aria-label="Cerrar" onClick={alCerrar}>
          <Icono nombre="cerrar" />
        </button>
        <h1 className="visor__titulo">{titulo}</h1>
        {camara?.tieneLinterna ? (
          <button
            type="button"
            className="visor__boton"
            aria-label="Linterna"
            aria-pressed={linterna}
            onClick={() => void cambiarLinterna()}
          >
            <Icono nombre="linterna" />
          </button>
        ) : (
          <span className="visor__hueco" aria-hidden="true" />
        )}
      </div>

      <div className="visor__zona">
        <div ref={refMarco} className="visor__marco">
          {congelada && <img className="visor__congelada" src={congelada} alt="Foto hecha" />}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M1.5 12V1.5H12M98.5 12V1.5H88M1.5 88v10.5H12M98.5 88v10.5H88"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {estadoCamara.fase === 'abriendo' && <span className="visor__aviso">Abriendo la cámara…</span>}
        </div>
        {estadoCamara.fase === 'error' && (
          <div className="visor__error" role="alert">
            <p>{estadoCamara.mensaje}</p>
            <div className="visor__error-acciones">
              <button
                type="button"
                className="boton boton--compacto"
                onClick={() => {
                  setEstadoCamara({ fase: 'abriendo' })
                  setIntento((n) => n + 1)
                }}
              >
                Reintentar
              </button>
              <button type="button" className="boton boton--compacto" onClick={() => refArchivo.current?.click()}>
                Elegir una foto
              </button>
            </div>
          </div>
        )}
        {estado}
      </div>

      {!compacto && (
        <div className="visor__controles">
          <div className="visor__lado">{izquierda}</div>
          <button
            type="button"
            className="visor__disparador"
            aria-label={textoDisparador}
            onClick={estadoCamara.fase === 'error' ? () => refArchivo.current?.click() : disparar}
            disabled={ocupado || estadoCamara.fase === 'abriendo'}
          >
            <span className="visor__disparador-centro" />
          </button>
          <div className="visor__lado visor__lado--derecha">{derecha}</div>
        </div>
      )}

      <input
        ref={refArchivo}
        type="file"
        accept="image/*"
        className="solo-lector"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void elegirArchivo(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
