import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Aviso } from '../ui/Aviso'

const UNA_HORA = 60 * 60 * 1000

/**
 * Registra el service worker (la app funciona sin conexión) y avisa cuando hay una versión nueva.
 * No se actualiza sola para no recargar la página mientras alguien está registrando algo.
 */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    offlineReady: [listaSinConexion, setListaSinConexion],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Comprueba si hay versión nueva cada hora mientras la app está abierta.
      if (registro) setInterval(() => void registro.update(), UNA_HORA)
    },
    onRegisterError(error: unknown) {
      console.warn('No se pudo registrar el service worker', error)
    },
  })

  useEffect(() => {
    if (!listaSinConexion) return
    const temporizador = setTimeout(() => setListaSinConexion(false), 5000)
    return () => clearTimeout(temporizador)
  }, [listaSinConexion, setListaSinConexion])

  if (hayVersionNueva) {
    return (
      <Aviso
        texto="Hay una versión nueva de la app."
        accion="Actualizar"
        alPulsarAccion={() => void updateServiceWorker(true)}
        alCerrar={() => setHayVersionNueva(false)}
      />
    )
  }
  if (listaSinConexion) {
    return <Aviso texto="Lista para usar sin conexión." alCerrar={() => setListaSinConexion(false)} />
  }
  return null
}
