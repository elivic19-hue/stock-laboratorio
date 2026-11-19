import { useEffect, useState } from 'react'
import {
  enviarNotificacion,
  permisoAvisos,
  pedirPermisoAvisos,
  prepararAvisoDiario,
  type EstadoAvisoDiario,
  type PermisoAvisos,
} from '../app/avisosMovil'
import { mostrarAviso } from '../app/avisos'
import { esIos, estaInstalada } from '../app/plataforma'
import type { AjustesDispositivo } from '../datos/ajustes'

/** Ajustes → Avisos: notificaciones del móvil (CLAUDE.md §7, «Avisos»). */
export function SeccionAvisos({
  ajustes,
  alGuardar,
}: {
  ajustes: AjustesDispositivo
  alGuardar: (cambios: Partial<AjustesDispositivo>) => Promise<unknown>
}) {
  const [permiso, setPermiso] = useState<PermisoAvisos>(permisoAvisos)
  const [diario, setDiario] = useState<EstadoAvisoDiario>()
  const [ocupado, setOcupado] = useState(false)
  const activos = ajustes.avisosEnElMovil && permiso === 'granted'

  // Al entrar se vuelve a registrar el aviso diario (por si se instaló la app después de activarlo).
  useEffect(() => {
    if (!activos) return
    let vigente = true
    void prepararAvisoDiario(true).then((estado) => {
      if (vigente) setDiario(estado)
    })
    return () => {
      vigente = false
    }
  }, [activos])

  async function cambiar(activar: boolean) {
    setOcupado(true)
    try {
      if (!activar) {
        await alGuardar({ avisosEnElMovil: false })
        await prepararAvisoDiario(false)
        return
      }
      const nuevo = await pedirPermisoAvisos()
      setPermiso(nuevo)
      if (nuevo === 'granted') await alGuardar({ avisosEnElMovil: true })
    } finally {
      setOcupado(false)
    }
  }

  async function probar() {
    const enviado = await enviarNotificacion('Aviso de prueba', {
      cuerpo: 'Así llegarán los avisos de bajo mínimo y de lotes caducados.',
      etiqueta: 'prueba',
      ruta: '#/ajustes',
    })
    if (!enviado) mostrarAviso({ texto: 'No se pudo mostrar el aviso. Revisa los permisos del navegador.' })
  }

  return (
    <section className="seccion" aria-labelledby="ajustes-avisos">
      <h2 id="ajustes-avisos" className="seccion__titulo">
        Avisos
      </h2>
      <label className="opcion">
        <input
          type="checkbox"
          checked={activos}
          disabled={ocupado || permiso === 'no-disponible' || permiso === 'denied'}
          onChange={(e) => void cambiar(e.target.checked)}
        />
        <span className="opcion__texto">
          <span className="opcion__titulo">Avisos en el móvil</span>
          <span className="opcion__detalle">
            Una notificación cuando una retirada deja un producto en su mínimo y, como mucho una vez al día, si hay
            lotes caducados.
          </span>
        </span>
      </label>
      <p className="texto-secundario" role="status">
        {describirEstado(permiso, activos, diario)}
      </p>
      {activos && (
        <button type="button" className="boton ajustes__boton-suelto" onClick={() => void probar()}>
          Enviar un aviso de prueba
        </button>
      )}
      <p className="texto-secundario">
        Con la app instalada, el número de productos a pedir aparece también en su icono (si el móvil lo permite).
      </p>
    </section>
  )
}

function describirEstado(permiso: PermisoAvisos, activos: boolean, diario: EstadoAvisoDiario | undefined): string {
  if (permiso === 'no-disponible') {
    return esIos() && !estaInstalada()
      ? 'En iPhone, los avisos solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o posterior).'
      : 'Este navegador no permite notificaciones.'
  }
  if (permiso === 'denied') {
    return 'Las notificaciones de esta app están bloqueadas. Permítelas en los ajustes del navegador (permisos del sitio) y vuelve aquí.'
  }
  if (!activos) return ''
  switch (diario) {
    case 'activo':
      return 'Activados. El aviso de caducados llega aunque la app esté cerrada; el móvil elige la hora.'
    case 'instalar':
      return 'Activados. Para recibir el aviso de caducados con la app cerrada, instala la app.'
    case 'no-disponible':
      return 'Activados. Este móvil no deja revisar los caducados con la app cerrada: los verás al abrirla.'
    default:
      return 'Activados.'
  }
}
