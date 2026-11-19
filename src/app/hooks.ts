import { useEffect, useState, type DependencyList } from 'react'
import type { AjustesDispositivo } from '../datos/ajustes'
import type { StockRepository } from '../datos/StockRepository'
import { calcularResumen, type ResumenStock } from '../dominio/resumen'
import { useAlmacenAjustes, useRepositorio } from './contexto'

export interface EstadoConsulta<T> {
  datos: T | undefined
  error: unknown
  cargando: boolean
}

/**
 * Ejecuta una consulta al repositorio y la repite cada vez que cambian los datos
 * (o las dependencias indicadas). Mientras se repite, se siguen mostrando los datos anteriores.
 */
export function useConsulta<T>(
  consulta: (repo: StockRepository) => Promise<T>,
  dependencias: DependencyList,
): EstadoConsulta<T> {
  const repo = useRepositorio()
  const [estado, setEstado] = useState<EstadoConsulta<T>>({ datos: undefined, error: undefined, cargando: true })

  useEffect(() => {
    let vigente = true
    let ultima = 0
    const ejecutar = () => {
      const esta = ++ultima
      consulta(repo).then(
        (datos) => {
          if (vigente && esta === ultima) setEstado({ datos, error: undefined, cargando: false })
        },
        (error: unknown) => {
          if (vigente && esta === ultima) setEstado((previo) => ({ datos: previo.datos, error, cargando: false }))
        },
      )
    }
    ejecutar()
    const dejarDeEscuchar = repo.suscribir(ejecutar)
    return () => {
      vigente = false
      dejarDeEscuchar()
    }
    // La función de consulta se crea en cada render: solo se repite al cambiar las dependencias indicadas.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [repo, ...dependencias])

  return estado
}

/** Ajustes de este móvil; undefined mientras se leen. */
export function useAjustes(): AjustesDispositivo | undefined {
  const almacen = useAlmacenAjustes()
  const [ajustes, setAjustes] = useState<AjustesDispositivo>()

  useEffect(() => {
    let vigente = true
    const leer = () => {
      almacen.leer().then(
        (valor) => {
          if (vigente) setAjustes(valor)
        },
        (error: unknown) => console.error('No se pudieron leer los ajustes', error),
      )
    }
    leer()
    const dejarDeEscuchar = almacen.suscribir(leer)
    return () => {
      vigente = false
      dejarDeEscuchar()
    }
  }, [almacen])

  return ajustes
}

/** Números del bloque resumen de Stock y del contador de «A pedir». */
export function useResumenStock(): ResumenStock | undefined {
  return useConsulta(async (repo) => {
    const [productos, pedidos, entradas] = await Promise.all([
      repo.listarProductos(),
      repo.listarPedidos('pedido'),
      repo.listarMovimientos({ tipo: 'entrada' }),
    ])
    return calcularResumen(productos, pedidos, entradas, new Date())
  }, []).datos
}

/** Color de la barra de estado del sistema (Android) a juego con la cabecera de cada pantalla. */
export function useColorBarraEstado(color: string): void {
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [color])
}

function leerRecordado<T>(clave: string, inicial: T): T {
  try {
    const guardado = sessionStorage.getItem(`stock-lab:${clave}`)
    return guardado === null ? inicial : { ...inicial, ...(JSON.parse(guardado) as T) }
  } catch {
    return inicial
  }
}

/**
 * Estado que se recuerda mientras la app sigue abierta (búsqueda, filtros…), para encontrarlo
 * igual al volver de la ficha de un producto. Si el navegador no deja guardarlo, se usa el inicial.
 */
export function useEstadoRecordado<T extends object>(clave: string, inicial: T): [T, (cambios: Partial<T>) => void] {
  const [valor, setValor] = useState<T>(() => leerRecordado(clave, inicial))

  function cambiar(cambios: Partial<T>) {
    setValor((previo) => {
      const siguiente = { ...previo, ...cambios }
      try {
        sessionStorage.setItem(`stock-lab:${clave}`, JSON.stringify(siguiente))
      } catch {
        // Sin almacenamiento de sesión: se recuerda solo mientras la pantalla está abierta.
      }
      return siguiente
    })
  }

  return [valor, cambiar]
}
