import { useCallback, useState } from 'react'
import { mostrarAviso } from '../app/avisos'
import { useServicios } from '../app/contexto'
import { useConsulta } from '../app/hooks'
import { volver } from '../app/navegacion'
import { MAX_FOTOS_POR_PRODUCTO } from '../datos/StockRepository'
import { mensajeDeError } from '../dominio/errores'
import { crearMiniatura } from '../reconocimiento/camara'
import { FOTOS_MINIMAS, FOTOS_RECOMENDADAS, objetivoFotos } from '../reconocimiento/fotos'
import { cargarModelo, useEstadoModelo } from '../reconocimiento/modelo'
import { PantallaCompleta } from '../ui/Pantalla'
import { VisorCamara } from '../ui/VisorCamara'
import './FotosReferencia.css'

/** Alta de fotos de referencia (sin maqueta: el visor de Retirar con un contador «6 / 10»). */
export function FotosReferencia({ id }: { id: string }) {
  const { repo } = useServicios()
  const modelo = useEstadoModelo()
  const [ocupado, setOcupado] = useState(false)
  const [ultima, setUltima] = useState<string>()
  const [anuncio, setAnuncio] = useState('')

  const { datos } = useConsulta(async (r) => {
    const [producto, fotos] = await Promise.all([r.obtenerProducto(id), r.listarFotos(id)])
    return { producto, total: fotos.length, hechasAProposito: fotos.filter((f) => f.origen === 'alta').length }
  }, [id])
  const total = datos?.total ?? 0
  // Las fotos guardadas al retirar dejan sitio a las nuevas; las hechas a propósito, no (§5).
  const lleno = (datos?.hechasAProposito ?? 0) >= MAX_FOTOS_POR_PRODUCTO
  const objetivo = objetivoFotos(total)

  const alCapturar = useCallback(
    async (imagen: HTMLCanvasElement) => {
      setOcupado(true)
      try {
        const extractor = await cargarModelo()
        const [{ vector }, miniatura] = await Promise.all([extractor.embedding(imagen), crearMiniatura(imagen)])
        await repo.guardarFoto({ productoId: id, embedding: vector, miniatura, origen: 'alta' })
        setUltima(imagen.toDataURL('image/jpeg', 0.8))
        setAnuncio(`Foto ${total + 1} guardada.`)
      } catch (error) {
        mostrarAviso({ texto: mensajeDeError(error) })
      } finally {
        setOcupado(false)
      }
    },
    [id, repo, total],
  )

  const terminar = () => volver({ pantalla: 'producto', id })
  const pista =
    modelo.estado === 'error'
      ? modelo.mensaje
      : modelo.estado !== 'listo'
        ? 'Preparando el reconocimiento…'
        : ocupado
          ? 'Guardando…'
          : total < FOTOS_MINIMAS
            ? 'Cambia de ángulo y de luz en cada foto'
            : total < FOTOS_RECOMENDADAS
              ? 'Bien. Unas pocas más con otra luz o desde otro lado'
              : 'Suficientes. Puedes terminar'

  return (
    <PantallaCompleta className="pantalla--visor" colorBarraEstado="#0E1114">
      <VisorCamara
        titulo={datos?.producto?.nombre ?? 'Fotos de referencia'}
        alCerrar={terminar}
        alCapturar={(imagen) => void alCapturar(imagen)}
        ocupado={ocupado || modelo.estado === 'error' || lleno}
        textoDisparador="Hacer foto de referencia"
        estado={
          <span className="visor__pastilla" role="status">
            <span className="visor__punto" aria-hidden="true" />
            {lleno ? `Máximo de ${MAX_FOTOS_POR_PRODUCTO} fotos` : pista}
          </span>
        }
        izquierda={
          <div className="fotos-ref__contador">
            {ultima && <img className="fotos-ref__ultima" src={ultima} alt="Última foto hecha" />}
            <span className="fotos-ref__numero" aria-label={`${total} fotos de ${objetivo}`}>
              {total} / {objetivo}
            </span>
          </div>
        }
        derecha={
          <button type="button" className="visor__texto-boton" onClick={terminar}>
            Listo
          </button>
        }
      />
      <span className="solo-lector" aria-live="polite">
        {anuncio}
      </span>
    </PantallaCompleta>
  )
}
