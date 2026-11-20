import { useState } from 'react'
import { navegar } from '../app/navegacion'
import { elegirLaboratorio, salir, useSesion } from '../app/sesion'
import { esIdLaboratorio, nombreLaboratorio, type IdLaboratorio } from '../datos/laboratorios'
import { useEstadoSincronizacion, type EstadoSincronizacion } from '../datos/sincronizacion/servicio'
import { formatearHora, formatearNumero } from '../dominio/formato'
import { Dialogo } from '../ui/Dialogo'
import { Icono } from '../ui/Icono'
import { OpcionesLaboratorio } from './ElegirLaboratorio'

/** Ajustes → Cuenta y laboratorio: con qué cuenta se ha entrado, qué stock se ve y su sincronización. */
export function SeccionCuenta() {
  const sesion = useSesion()
  const estado = useEstadoSincronizacion()
  const [cambiarAbierto, setCambiarAbierto] = useState(false)
  const [salirAbierto, setSalirAbierto] = useState(false)
  if (!sesion || !esIdLaboratorio(sesion.laboratorio)) return null
  const laboratorio = sesion.laboratorio
  const pendientes = estado.modo === 'conectado' ? estado.enviosPendientes : 0

  return (
    <section className="seccion" aria-labelledby="ajustes-cuenta">
      <h2 id="ajustes-cuenta" className="seccion__titulo">
        Cuenta y laboratorio
      </h2>
      <p className="ajustes__ultima-copia">
        <span className="etiqueta etiqueta--pequena">Laboratorio</span>
        <span>{nombreLaboratorio(laboratorio)}</span>
      </p>
      <p className="ajustes__ultima-copia">
        <span className="etiqueta etiqueta--pequena">Cuenta</span>
        <span className="mono ajustes__correo">{sesion.correo}</span>
      </p>
      <p className="texto-secundario" role="status">
        {describirConexion(estado)}
      </p>
      {(estado.modo === 'error' || (estado.modo === 'conectado' && estado.error)) && (
        <p className="mensaje-error" role="alert">
          <Icono nombre="info" tamano={18} />
          {estado.modo === 'error' ? estado.mensaje : estado.error}
        </p>
      )}
      <div className="ajustes__botones">
        <button type="button" className="boton boton--contorno" onClick={() => setCambiarAbierto(true)}>
          Cambiar de laboratorio
        </button>
        <button type="button" className="boton" onClick={() => setSalirAbierto(true)}>
          Cerrar sesión
        </button>
      </div>

      {cambiarAbierto && (
        <DialogoCambiarLaboratorio actual={laboratorio} alCerrar={() => setCambiarAbierto(false)} />
      )}

      <Dialogo abierto={salirAbierto} alCerrar={() => setSalirAbierto(false)} titulo="Cerrar sesión">
        <p className="texto-secundario">
          La app volverá a pedir el correo y la contraseña. El stock se queda guardado en este móvil y en la nube.
          {pendientes > 0
            ? ` Hay ${textoCambios(pendientes)} sin mandar todavía: se mandarán cuando vuelvas a entrar con esta cuenta y haya conexión.`
            : ''}
        </p>
        <div className="hoja__acciones">
          <button type="button" className="boton" onClick={() => setSalirAbierto(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--oscuro"
            onClick={() => {
              setSalirAbierto(false)
              navegar({ pantalla: 'stock' }, { reemplazar: true })
              void salir()
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </Dialogo>
    </section>
  )
}

function DialogoCambiarLaboratorio({ actual, alCerrar }: { actual: IdLaboratorio; alCerrar: () => void }) {
  const [elegido, setElegido] = useState<IdLaboratorio>(actual)
  return (
    <Dialogo abierto alCerrar={alCerrar} titulo="Cambiar de laboratorio">
      <p className="texto-secundario">
        Verás el stock del laboratorio que elijas, y lo que registres irá a ese laboratorio.
      </p>
      <OpcionesLaboratorio elegido={elegido} actual={actual} alElegir={setElegido} />
      <div className="hoja__acciones">
        <button type="button" className="boton" onClick={alCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton boton--primario"
          disabled={elegido === actual}
          onClick={() => {
            alCerrar()
            navegar({ pantalla: 'stock' }, { reemplazar: true })
            void elegirLaboratorio(elegido)
          }}
        >
          Cambiar
        </button>
      </div>
    </Dialogo>
  )
}

function textoCambios(n: number): string {
  return n === 1 ? '1 cambio' : `${formatearNumero(n)} cambios`
}

function describirConexion(estado: EstadoSincronizacion): string {
  switch (estado.modo) {
    case 'parado':
    case 'iniciando':
      return 'Conectando con la nube…'
    case 'error':
      return 'Los cambios se guardan en este móvil, pero ahora no se comparten.'
    case 'conectado':
      if (!estado.conServidor) {
        return estado.enviosPendientes > 0
          ? `Sin conexión: ${textoCambios(estado.enviosPendientes)} esperando para mandarse. Se mandarán solos al volver la conexión.`
          : 'Sin conexión. Los cambios que hagas se mandarán al volver la conexión.'
      }
      if (estado.enviosPendientes > 0) return `Mandando ${textoCambios(estado.enviosPendientes)}…`
      return estado.ultimaSincronizacion
        ? `Al día con los demás móviles. Última sincronización a las ${formatearHora(estado.ultimaSincronizacion)}.`
        : 'Al día con los demás móviles.'
  }
}
