import { useEffect, useState } from 'react'
import { AlmacenAjustesLocal } from '../datos/ajustes'
import { BaseDatosStock } from '../datos/db'
import { nombreBaseDatos, type IdLaboratorio } from '../datos/laboratorios'
import { LocalRepository } from '../datos/LocalRepository'
import { detenerSincronizacion, prepararSincronizacion } from '../datos/sincronizacion/servicio'
import { ElegirLaboratorio } from '../pantallas/ElegirLaboratorio'
import { InicioSesion } from '../pantallas/InicioSesion'
import { App } from './App'
import { mostrarAviso } from './avisos'
import { AvisoActualizacion } from './AvisoActualizacion'
import { pedirAlmacenamientoPersistente } from './plataforma'
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
    // Que el navegador no borre los datos del móvil aunque le falte espacio (se pide cada vez: no molesta).
    void pedirAlmacenamientoPersistente()
    // Sin sesión guardada en el móvil, se vuelve al inicio de sesión. En Cromatografía, la primera
    // vez se recupera el stock que quedó en el laboratorio de antes de separarlos.
    void prepararSincronizacion(db, repo, laboratorio, () => void salir(), (r) =>
      mostrarAviso({
        texto:
          `Recuperado el stock de antes de separar los laboratorios: ${r.productosNuevos} productos con su historial` +
          (r.productosQueYaEstaban > 0 ? `, y fotos para ${r.productosQueYaEstaban} que ya estaban` : '') +
          '.' +
          (r.codigosCambiados.length > 0
            ? ` Códigos cambiados por estar repetidos: ${r.codigosCambiados.map((c) => `${c.antes} → ${c.despues}`).join(', ')}.`
            : ''),
        duracion: 20000,
      }),
    )
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
