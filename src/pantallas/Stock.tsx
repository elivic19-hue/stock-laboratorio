import { useId, useMemo, useState } from 'react'
import { Enlace } from '../app/Enlace'
import { useAjustes, useConsulta, useEstadoRecordado, useResumenStock } from '../app/hooks'
import { formatearNumero } from '../dominio/formato'
import {
  OPCIONES_LISTA_INICIALES,
  agruparPorArmario,
  contarPorCategoria,
  filtrarSinCategoria,
  hayFiltrosActivos,
  infoPorProducto,
  lineaSecundaria,
  type FiltroCategoria,
  type OpcionesLista,
  type OrdenLista,
} from '../dominio/listaStock'
import type { ResumenStock } from '../dominio/resumen'
import { Buscador } from '../ui/Buscador'
import { ControlSegmentado } from '../ui/ControlSegmentado'
import { Dialogo } from '../ui/Dialogo'
import { CantidadYEstado, FilaProducto } from '../ui/FilaProducto'
import { Icono } from '../ui/Icono'
import { PantallaConBarra } from '../ui/Pantalla'
import './Stock.css'

const TEXTO_ORDEN: Record<OrdenLista, string> = {
  nombre: 'Por nombre',
  codigo: 'Por código',
  urgencia: 'Más urgentes primero',
}

/** Pantalla de inicio (maqueta Main). */
export function Stock() {
  const ajustes = useAjustes()
  const resumen = useResumenStock()
  const [opciones, cambiarOpciones] = useEstadoRecordado<OpcionesLista>('lista-stock', OPCIONES_LISTA_INICIALES)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const idLista = useId()

  const { datos } = useConsulta(async (repo) => {
    const [productos, movimientos] = await Promise.all([repo.listarProductos(), repo.listarMovimientos()])
    return { productos, movimientos, ahora: new Date() }
  }, [])

  const info = useMemo(
    () => (datos ? infoPorProducto(datos.productos, datos.movimientos, datos.ahora) : new Map()),
    [datos],
  )
  const filtrados = useMemo(
    () => (datos ? filtrarSinCategoria(datos.productos, info, opciones) : []),
    [datos, info, opciones],
  )
  const contadores = contarPorCategoria(filtrados)
  const grupos = useMemo(
    () =>
      agruparPorArmario(
        opciones.categoria === 'todos' ? filtrados : filtrados.filter((p) => p.categoria === opciones.categoria),
        opciones.orden,
      ),
    [filtrados, opciones.categoria, opciones.orden],
  )
  const filtrosActivos = hayFiltrosActivos(opciones)
  const buscando = opciones.texto.trim() !== '' || filtrosActivos || opciones.categoria !== 'todos'

  return (
    <PantallaConBarra activa="stock" colorBarraEstado="#FFFFFF">
      <header className="stock-cabecera">
        <div className="stock-cabecera__fila">
          <div className="stock-cabecera__titulos">
            <span className="stock-cabecera__laboratorio">{ajustes?.laboratorio}</span>
            <div className="stock-cabecera__linea">
              <h1 className="stock-cabecera__titulo">Stock</h1>
              {/* Fase 1: los datos solo están en este móvil. En la fase 2, la hora de sincronización. */}
              <span className="estado-guardado">
                <span className="estado-guardado__punto" aria-hidden="true" />
                Guardado en este móvil
              </span>
            </div>
          </div>
          <Enlace ruta={{ pantalla: 'ajustes' }} className="boton-perfil" aria-label="Perfil y ajustes">
            <Icono nombre="perfil" />
          </Enlace>
        </div>
        <BloqueResumen resumen={resumen} />
        <div className="stock-busqueda">
          <Buscador
            etiqueta="Buscar producto"
            placeholder="Nombre, código o ubicación"
            valor={opciones.texto}
            alCambiar={(texto) => cambiarOpciones({ texto })}
          />
          <button
            type="button"
            className="boton-icono boton-filtros"
            aria-label={filtrosActivos ? 'Filtros y orden (hay filtros activos)' : 'Filtros y orden'}
            aria-haspopup="dialog"
            onClick={() => setFiltrosAbiertos(true)}
          >
            <Icono nombre="filtros" />
            {filtrosActivos && <span className="boton-filtros__marca" aria-hidden="true" />}
          </button>
        </div>
        <ControlSegmentado<FiltroCategoria>
          etiqueta="Tipo de producto"
          idPanel={idLista}
          valor={opciones.categoria}
          alCambiar={(categoria) => cambiarOpciones({ categoria })}
          opciones={[
            { valor: 'todos', texto: 'Todos', contador: contadores.todos },
            { valor: 'reactivo', texto: 'Reactivos', contador: contadores.reactivo },
            { valor: 'fungible', texto: 'Fungible', contador: contadores.fungible },
          ]}
        />
      </header>

      <main id={idLista} role="tabpanel" aria-label="Productos" className="stock-contenido">
        {(resumen?.caducados ?? 0) > 0 && (
          <Enlace ruta={{ pantalla: 'caducidades' }} className="banda-caducados">
            <Icono nombre="alerta" />
            <span className="banda-caducados__texto">
              <strong>
                {resumen?.caducados === 1 ? '1 lote caducado' : `${resumen?.caducados} lotes caducados`}
              </strong>{' '}
              con stock en el armario
            </span>
            <span className="banda-caducados__ver">
              Ver
              <Icono nombre="siguiente" tamano={14} />
            </span>
          </Enlace>
        )}
        {filtrosActivos && (
          <div className="filtros-activos">
            <span className="etiqueta etiqueta--pequena">{describirFiltros(opciones)}</span>
            <button
              type="button"
              className="enlace-boton"
              onClick={() =>
                cambiarOpciones({ soloBajoMinimo: false, soloCaducanPronto: false, orden: OPCIONES_LISTA_INICIALES.orden })
              }
            >
              Quitar
            </button>
          </div>
        )}

        {datos && datos.productos.length === 0 && (
          <div className="lista-vacia">
            <p className="lista-vacia__titulo">Todavía no hay productos</p>
            <p className="texto-secundario">Da de alta los productos del laboratorio desde el catálogo.</p>
            <Enlace ruta={{ pantalla: 'producto-nuevo' }} className="boton boton--compacto">
              <Icono nombre="mas" tamano={16} />
              Nuevo producto
            </Enlace>
          </div>
        )}
        {datos && datos.productos.length > 0 && grupos.length === 0 && (
          <div className="lista-vacia" role="status">
            <p className="lista-vacia__titulo">Ningún producto coincide</p>
            <p className="texto-secundario">
              {buscando ? 'Prueba con otra búsqueda o quita los filtros.' : 'No hay productos que mostrar.'}
            </p>
          </div>
        )}

        {datos &&
          grupos.map((grupo) => (
            <section key={grupo.armario} className="grupo-lista" aria-label={grupo.armario}>
              <div className="grupo-lista__cabecera">
                <h2 className="grupo-lista__titulo">{grupo.armario}</h2>
                <span className="grupo-lista__contador">
                  {grupo.productos.length === 1 ? '1 producto' : `${grupo.productos.length} productos`}
                </span>
              </div>
              <ul className="lista-tarjeta">
                {grupo.productos.map((p) => (
                  <li key={p.id}>
                    <FilaProducto
                      producto={p}
                      linea={
                        <>
                          {info.get(p.id)?.caducidadVencida && <span className="insignia-caducado">Caducado</span>}
                          {lineaSecundaria(p, info.get(p.id), datos.ahora)}
                        </>
                      }
                    >
                      <CantidadYEstado producto={p} />
                    </FilaProducto>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </main>

      <DialogoFiltros
        abierto={filtrosAbiertos}
        opciones={opciones}
        alCambiar={cambiarOpciones}
        alCerrar={() => setFiltrosAbiertos(false)}
      />
    </PantallaConBarra>
  )
}

function describirFiltros(opciones: OpcionesLista): string {
  const partes: string[] = []
  if (opciones.soloBajoMinimo) partes.push('solo bajo mínimo')
  if (opciones.soloCaducanPronto) partes.push('caducados o <30 d')
  if (opciones.orden !== 'nombre') partes.push(TEXTO_ORDEN[opciones.orden].toLowerCase())
  return partes.join(' · ')
}

function BloqueResumen({ resumen }: { resumen: ResumenStock | undefined }) {
  const valor = (n: number | undefined) => (n === undefined ? '–' : formatearNumero(n))
  const hayQuePedir = (resumen?.aPedir ?? 0) > 0
  const hayCaducados = (resumen?.caducados ?? 0) > 0

  return (
    <div className="resumen" role="group" aria-label="Resumen del stock">
      <div className="resumen__celda">
        <span className="resumen__etiqueta">Productos</span>
        <span className="resumen__valor">{valor(resumen?.productos)}</span>
      </div>
      <Enlace
        ruta={{ pantalla: 'pedir' }}
        className={hayQuePedir ? 'resumen__celda resumen__celda--alerta' : 'resumen__celda'}
      >
        <span className="resumen__etiqueta">Bajo mínimo</span>
        <span className="resumen__valor">
          {valor(resumen?.aPedir)}
          <Icono nombre="siguiente" tamano={14} />
        </span>
      </Enlace>
      {/* Si hay lotes caducados, la celda los cuenta a ellos; si no, los que caducan en menos de 30 días. */}
      <Enlace
        ruta={{ pantalla: 'caducidades' }}
        className={hayCaducados ? 'resumen__celda resumen__celda--caducados' : 'resumen__celda'}
      >
        <span className="resumen__etiqueta">{hayCaducados ? 'Caducados' : 'Caducan <30 d'}</span>
        <span className="resumen__valor">
          {hayCaducados ? valor(resumen?.caducados) : valor(resumen?.caducanPronto)}
          <Icono nombre="siguiente" tamano={14} />
        </span>
      </Enlace>
    </div>
  )
}

function DialogoFiltros({
  abierto,
  opciones,
  alCambiar,
  alCerrar,
}: {
  abierto: boolean
  opciones: OpcionesLista
  alCambiar: (cambios: Partial<OpcionesLista>) => void
  alCerrar: () => void
}) {
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Filtros y orden">
      <fieldset className="opciones">
        <legend className="etiqueta opciones__leyenda">Mostrar solo</legend>
        <label className="opcion">
          <input
            type="checkbox"
            checked={opciones.soloBajoMinimo}
            onChange={(e) => alCambiar({ soloBajoMinimo: e.target.checked })}
          />
          <span className="opcion__texto">
            <span className="opcion__titulo">Bajo mínimo</span>
            <span className="opcion__detalle">En su mínimo o por debajo, aunque ya estén pedidos.</span>
          </span>
        </label>
        <label className="opcion">
          <input
            type="checkbox"
            checked={opciones.soloCaducanPronto}
            onChange={(e) => alCambiar({ soloCaducanPronto: e.target.checked })}
          />
          <span className="opcion__texto">
            <span className="opcion__titulo">Caducados o caducan en menos de 30 días</span>
            <span className="opcion__detalle">Con algún lote así y stock.</span>
          </span>
        </label>
      </fieldset>
      <fieldset className="opciones">
        <legend className="etiqueta opciones__leyenda">Orden dentro de cada armario</legend>
        {(Object.keys(TEXTO_ORDEN) as OrdenLista[]).map((criterio) => (
          <label key={criterio} className="opcion">
            <input
              type="radio"
              name="orden-stock"
              checked={opciones.orden === criterio}
              onChange={() => alCambiar({ orden: criterio })}
            />
            <span className="opcion__texto">
              <span className="opcion__titulo">{TEXTO_ORDEN[criterio]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button type="button" className="boton boton--primario boton--ancho" onClick={alCerrar}>
        Ver productos
      </button>
    </Dialogo>
  )
}
