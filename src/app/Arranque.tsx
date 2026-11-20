import { useEffect, useState } from 'react'
import { AlmacenAjustesLocal } from '../datos/ajustes'
import { BaseDatosStock } from '../datos/db'
import { nombreBaseDatos, type IdLaboratorio } from '../datos/laboratorios'
import { LocalRepository } from '../datos/LocalRepository'
import { detenerSincronizacion, prepararSincronizacion } from '../datos/sincronizacion/servicio'
import { ElegirLaboratorio } from '../pantallas/ElegirLaboratorio'
import { InicioSesion } from '../pantallas/InicioSesion'
import { App } from './App'
import { AvisoActualizacion } from './AvisoActualizacion'
import { ProveedorServicios } from './ProveedorServicios'
import { AjustesConSesion, salir, useSesion } from './sesion'

/** Inicio de sesión → elegir laboratorio → la app con el stock de ese laboratorio. */
export function Arranque() {
  const sesion = useSesion()
  if (sesion === undefined) return <div className="pantalla" aria-busy="true" />
  if (sesion === null || !sesion.laboratorio) {
    return (
      <>
        {sesion === null ? <InicioSesion /> : <ElegirLaboratorio />}
        <AvisoActualizacion oculto={false} />
      </>
    )
  }
  return <AppLaboratorio key={sesion.laboratorio} laboratorio={sesion.laboratorio} />
}

/**
 * Abre la base de datos del laboratorio en el móvil y la sincroniza con la nube mientras se ve.
 * Las pantallas leen y escriben siempre en el móvil (IndexedDB), así todo funciona sin conexión.
 */
function AppLaboratorio({ laboratorio }: { laboratorio: IdLaboratorio }) {
  // Se crea una vez por laboratorio (al cambiar, `key` monta uno nuevo).
  const [servicios] = useState(() => {
    const db = new BaseDatosStock(nombreBaseDatos(laboratorio))
    const repo = new LocalRepository(db)
    return { db, repo, ajustes: new AjustesConSesion(new AlmacenAjustesLocal(db), laboratorio) }
  })

  useEffect(() => {
    const { db, repo } = servicios
    // Sin sesión guardada en el móvil, se vuelve al inicio de sesión.
    void prepararSincronizacion(db, repo, laboratorio, () => void salir())
    return () => {
      // Se puede volver a abrir sola (en desarrollo, React monta dos veces).
      void detenerSincronizacion().finally(() => db.close({ disableAutoOpen: false }))
    }
  }, [servicios, laboratorio])

  return (
    <ProveedorServicios servicios={servicios}>
      <App />
    </ProveedorServicios>
  )
}
