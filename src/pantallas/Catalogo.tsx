import { useId, useMemo } from 'react'
import { Enlace } from '../app/Enlace'
import { useConsulta, useEstadoRecordado } from '../app/hooks'
import { coincideBusqueda } from '../dominio/busqueda'
import { formatearNumero } from '../dominio/formato'
import { ordenarPorCodigo } from '../dominio/listaStock'
import { ubicacionCorta } from '../dominio/ubicacion'
import { Buscador } from '../ui/Buscador'
import { ControlSegmentado } from '../ui/ControlSegmentado'
import { FilaProducto } from '../ui/FilaProducto'
import { Icono } from '../ui/Icono'
import { PantallaConBarra } from '../ui/Pantalla'
import './Catalogo.css'

type Vista = 'activos' | 'archivados'

/** Catálogo (sin maqueta): todos los productos por código, con sus fotos de referencia, y el alta. */
export function Catalogo() {
  const [estado, cambiar] = useEstadoRecordado<{ texto: string; vista: Vista }>('catalogo', {
    texto: '',
    vista: 'activos',
  })
  const idLista = useId()

  const { datos } = useConsulta(async (repo) => {
    const [productos, fotos] = await Promise.all([repo.listarProductos({ incluirArchivados: true }), repo.listarFotos()])
    const fotosPorProducto = new Map<string, number>()
    for (const f of fotos) fotosPorProducto.set(f.productoId, (fotosPorProducto.get(f.productoId) ?? 0) + 1)
    return { productos: ordenarPorCodigo(productos), fotosPorProducto }
  }, [])

  const activos = useMemo(() => datos?.productos.filter((p) => !p.archivado) ?? [], [datos])
  const archivados = useMemo(() => datos?.productos.filter((p) => p.archivado) ?? [], [datos])
  const vista = estado.vista === 'archivados' && archivados.length === 0 ? 'activos' : estado.vista
  const lista = (vista === 'activos' ? activos : archivados).filter((p) => coincideBusqueda(p, estado.texto))

  return (
    <PantallaConBarra activa="catalogo">
      <header className="cabecera-lista">
        <div className="cabecera-lista__titulos">
          <span className="etiqueta cabecera-lista__contador">
            {datos === undefined ? ' ' : activos.length === 1 ? '1 producto' : `${activos.length} productos`}
          </span>
          <h1 className="cabecera-lista__titulo">Catálogo</h1>
        </div>
        <Enlace ruta={{ pantalla: 'producto-nuevo' }} className="boton boton--compacto">
          <Icono nombre="mas" tamano={16} />
          Nuevo producto
        </Enlace>
      </header>

      <div className="catalogo-herramientas">
        <Buscador
          etiqueta="Buscar en el catálogo"
          placeholder="Nombre, código o ubicación"
          valor={estado.texto}
          alCambiar={(texto) => cambiar({ texto })}
          className="buscador--claro"
        />
        {archivados.length > 0 && (
          <ControlSegmentado<Vista>
            etiqueta="Productos que se muestran"
            idPanel={idLista}
            valor={vista}
            alCambiar={(v) => cambiar({ vista: v })}
            opciones={[
              { valor: 'activos', texto: 'En uso', contador: activos.length },
              { valor: 'archivados', texto: 'Archivados', contador: archivados.length },
            ]}
          />
        )}
      </div>

      <main id={idLista} role={archivados.length > 0 ? 'tabpanel' : undefined} className="catalogo-contenido">
        {datos && datos.productos.length === 0 && (
          <div className="lista-vacia">
            <p className="lista-vacia__titulo">El catálogo está vacío</p>
            <p className="texto-secundario">
              Da de alta cada producto con su formato, ubicación y stock mínimo. Después harás sus fotos de
              referencia para reconocerlo con la cámara.
            </p>
            <Enlace ruta={{ pantalla: 'producto-nuevo' }} className="boton boton--primario">
              <Icono nombre="mas" tamano={18} />
              Dar de alta el primero
            </Enlace>
          </div>
        )}
        {datos && datos.productos.length > 0 && lista.length === 0 && (
          <div className="lista-vacia" role="status">
            <p className="lista-vacia__titulo">Ningún producto coincide</p>
            <p className="texto-secundario">Prueba con otra búsqueda.</p>
          </div>
        )}
        {datos && lista.length > 0 && (
          <ul className="lista-tarjeta">
            {lista.map((p) => {
              const fotos = datos.fotosPorProducto.get(p.id) ?? 0
              return (
                <li key={p.id}>
                  <FilaProducto producto={p} linea={`${p.formato} · ${ubicacionCorta(p)}`}>
                    <span className="cantidad-fila">
                      {formatearNumero(p.stockActual)} <span className="cantidad-fila__unidad">{p.unidadCorta}</span>
                    </span>
                    <span className={fotos === 0 ? 'etiqueta etiqueta--pequena catalogo-sin-fotos' : 'etiqueta etiqueta--pequena'}>
                      {fotos === 1 ? '1 foto' : `${fotos} fotos`}
                    </span>
                  </FilaProducto>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </PantallaConBarra>
  )
}
