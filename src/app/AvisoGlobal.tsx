import { useEffect, useState } from 'react'
import { mensajeDeError } from '../dominio/errores'
import { Aviso } from '../ui/Aviso'
import { cerrarAviso, mostrarAviso, useAviso } from './avisos'

/** Muestra el aviso activo y lo cierra solo al cabo de unos segundos. */
export function AvisoGlobal() {
  const aviso = useAviso()
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!aviso?.duracion) return
    const id = aviso.id
    const temporizador = setTimeout(() => cerrarAviso(id), aviso.duracion)
    return () => clearTimeout(temporizador)
  }, [aviso])

  if (!aviso) return null

  async function pulsarAccion() {
    if (!aviso?.alPulsarAccion || ocupado) return
    setOcupado(true)
    try {
      await aviso.alPulsarAccion()
      cerrarAviso(aviso.id)
    } catch (error) {
      mostrarAviso({ texto: mensajeDeError(error) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Aviso
      key={aviso.id}
      texto={aviso.texto}
      accion={aviso.accion}
      alPulsarAccion={aviso.alPulsarAccion ? () => void pulsarAccion() : undefined}
      alCerrar={() => cerrarAviso(aviso.id)}
    />
  )
}
