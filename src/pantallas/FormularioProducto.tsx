import { useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useConsulta } from '../app/hooks'
import type { DatosProductoNuevo } from '../datos/StockRepository'
import type { Categoria } from '../datos/tipos'
import { ErrorStock, mensajeDeError } from '../dominio/errores'
import {
  ORDEN_CAMPOS,
  validarFormularioProducto,
  type CampoProducto,
  type ErroresProducto,
  type ValoresProducto,
} from '../dominio/formularioProducto'
import { Icono } from '../ui/Icono'
import './FormularioProducto.css'

/** Campos que llevan texto de ayuda debajo (para su aria-describedby). */
const CAMPOS_CON_AYUDA = new Set<CampoProducto>(['codigo', 'stockInicial'])

const UNIDADES_HABITUALES = ['uds', 'bot.', 'bid.', 'racks', 'cajas', 'bolsas', 'paq.', 'L', 'kg', 'g']

interface Props {
  valoresIniciales: ValoresProducto
  esAlta: boolean
  textoGuardar: string
  /** Recibe los datos ya revisados. Si lanza ErrorStock de código repetido, se marca el campo. */
  alGuardar: (datos: DatosProductoNuevo) => Promise<void>
  /** Contenido extra al final del formulario (p. ej. archivar). */
  pie?: ReactNode
}

/** Formulario de alta y edición de producto (sin maqueta: mismo lenguaje que «Registrar entrada»). */
export function FormularioProducto({ valoresIniciales, esAlta, textoGuardar, alGuardar, pie }: Props) {
  const [valores, setValores] = useState(valoresIniciales)
  const [errores, setErrores] = useState<ErroresProducto>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const idFormulario = useId()
  const prefijo = useId()
  const campos = useRef(new Map<CampoProducto, HTMLElement>())

  const { datos: sugerencias } = useConsulta(async (repo) => {
    const productos = await repo.listarProductos({ incluirArchivados: true })
    const unicos = (lista: string[]) =>
      [...new Map(lista.filter(Boolean).map((v) => [v.trim().toLocaleLowerCase('es'), v.trim()])).values()].sort(
        (a, b) => a.localeCompare(b, 'es', { numeric: true }),
      )
    return {
      armarios: unicos(productos.map((p) => p.armario)),
      unidades: unicos([...productos.map((p) => p.unidadCorta), ...UNIDADES_HABITUALES]),
    }
  }, [])
  const { datos: codigoAutomatico } = useConsulta(
    (repo) => (esAlta ? repo.siguienteCodigo(valores.categoria) : Promise.resolve(undefined)),
    [esAlta, valores.categoria],
  )

  function cambiar(campo: CampoProducto, valor: string) {
    setValores((previos) => ({ ...previos, [campo]: valor }))
    if (errores[campo]) {
      setErrores((previos) => {
        const siguientes = { ...previos }
        delete siguientes[campo]
        return siguientes
      })
    }
  }

  function enfocarPrimerError(lista: ErroresProducto) {
    const primero = ORDEN_CAMPOS.find((campo) => lista[campo])
    if (primero) campos.current.get(primero)?.focus()
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return
    setErrorGeneral(null)
    const resultado = validarFormularioProducto(valores, { esAlta })
    if (!resultado.valido) {
      setErrores(resultado.errores)
      enfocarPrimerError(resultado.errores)
      return
    }
    setErrores({})
    setGuardando(true)
    try {
      await alGuardar(resultado.datos)
    } catch (error) {
      if (error instanceof ErrorStock && error.codigo === 'codigo-duplicado') {
        const lista = { codigo: error.message }
        setErrores(lista)
        enfocarPrimerError(lista)
      } else {
        setErrorGeneral(mensajeDeError(error))
      }
      setGuardando(false)
    }
  }

  /** Props comunes de cada campo: id, valor y la descripción (ayuda y error). */
  function propsCampo(campo: CampoProducto) {
    const error = errores[campo]
    return {
      id: `${prefijo}-${campo}`,
      ref: (elemento: HTMLInputElement | HTMLTextAreaElement | null) => {
        if (elemento) campos.current.set(campo, elemento)
        else campos.current.delete(campo)
      },
      value: valores[campo],
      onChange: (e: { target: { value: string } }) => cambiar(campo, e.target.value),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': [error && `${prefijo}-${campo}-error`, CAMPOS_CON_AYUDA.has(campo) && `${prefijo}-${campo}-ayuda`]
        .filter(Boolean)
        .join(' ') || undefined,
    }
  }

  /** Campo con su etiqueta, ayuda y error. Es una función (no un componente) para no recrear los campos. */
  function bloqueCampo({
    campo,
    etiqueta,
    ayuda,
    children,
  }: {
    campo: CampoProducto
    etiqueta: string
    ayuda?: string
    children: ReactNode
  }) {
    return (
      <div className="campo">
        <label className="etiqueta" htmlFor={`${prefijo}-${campo}`}>
          {etiqueta}
        </label>
        {children}
        {ayuda && (
          <span id={`${prefijo}-${campo}-ayuda`} className="campo__ayuda">
            {ayuda}
          </span>
        )}
        {errores[campo] && (
          <span id={`${prefijo}-${campo}-error`} className="mensaje-error">
            <Icono nombre="info" tamano={16} />
            {errores[campo]}
          </span>
        )}
      </div>
    )
  }

  const listaArmarios = `${prefijo}-armarios`
  const listaUnidades = `${prefijo}-unidades`
  const ayudaCodigo = useMemo(() => {
    if (!esAlta) return 'Si lo cambias, comprueba que no esté repetido.'
    return codigoAutomatico ? `Si lo dejas vacío será ${codigoAutomatico}.` : undefined
  }, [esAlta, codigoAutomatico])

  return (
    <>
      <form id={idFormulario} className="contenido formulario-producto" onSubmit={guardar} noValidate>
        {bloqueCampo({
          campo: 'nombre',
          etiqueta: 'Nombre',
          children: (
            <input
              {...propsCampo('nombre')}
              className="campo__entrada"
              placeholder="Ej.: Puntas de pipeta 1000 µL"
              autoCapitalize="sentences"
              autoComplete="off"
            />
          ),
        })}

        <fieldset className="campo formulario-producto__grupo">
          <legend className="etiqueta">Categoría</legend>
          <div className="segmentado" role="radiogroup" aria-label="Categoría">
            {(['reactivo', 'fungible'] as Categoria[]).map((categoria) => (
              <label key={categoria} className="segmentado__opcion">
                <input
                  type="radio"
                  className="solo-lector"
                  name={`${prefijo}-categoria`}
                  checked={valores.categoria === categoria}
                  onChange={() => cambiar('categoria', categoria)}
                />
                {categoria === 'reactivo' ? 'Reactivo' : 'Fungible'}
              </label>
            ))}
          </div>
        </fieldset>

        {bloqueCampo({
          campo: 'codigo',
          etiqueta: esAlta ? 'Código (opcional)' : 'Código',
          ayuda: ayudaCodigo,
          children: (
            <input
              {...propsCampo('codigo')}
              className="campo__entrada campo__entrada--mono"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          ),
        })}

        <div className="formulario-producto__pareja">
          {bloqueCampo({
            campo: 'formato',
            etiqueta: 'Formato',
            children: (
              <input {...propsCampo('formato')} className="campo__entrada" placeholder="Botella 1 L" autoComplete="off" />
            ),
          })}
          {bloqueCampo({
            campo: 'unidadCorta',
            etiqueta: 'Unidad',
            children: (
              <input
                {...propsCampo('unidadCorta')}
                className="campo__entrada"
                placeholder="bot."
                list={listaUnidades}
                autoCapitalize="none"
                autoComplete="off"
              />
            ),
          })}
        </div>
        <p className="campo__ayuda formulario-producto__nota">
          El stock se cuenta en esa unidad: si el formato es «Bolsa 100 uds», la unidad puede ser «uds» o «bolsas».
        </p>

        <div className="formulario-producto__pareja">
          {bloqueCampo({
            campo: 'armario',
            etiqueta: 'Armario',
            children: (
              <input
                {...propsCampo('armario')}
                className="campo__entrada"
                placeholder="Armario 2"
                list={listaArmarios}
                autoComplete="off"
              />
            ),
          })}
          {bloqueCampo({
            campo: 'balda',
            etiqueta: 'Balda (opcional)',
            children: (
              <input {...propsCampo('balda')} className="campo__entrada" placeholder="Balda 3" autoComplete="off" />
            ),
          })}
        </div>

        <div className="formulario-producto__pareja">
          {bloqueCampo({
            campo: 'stockMinimo',
            etiqueta: 'Avisar con ≤',
            children: (
              <input
                {...propsCampo('stockMinimo')}
                className="campo__entrada campo__entrada--mono"
                inputMode="decimal"
                placeholder="5"
                autoComplete="off"
              />
            ),
          })}
          {bloqueCampo({
            campo: 'cantidadPedidoSugerida',
            etiqueta: 'Pedir (opcional)',
            children: (
              <input
                {...propsCampo('cantidadPedidoSugerida')}
                className="campo__entrada campo__entrada--mono"
                inputMode="decimal"
                placeholder="10"
                autoComplete="off"
              />
            ),
          })}
        </div>
        <p className="campo__ayuda formulario-producto__nota">
          Con el stock en ese mínimo o por debajo, el producto pasa a «A pedir» con la cantidad sugerida.
        </p>

        {esAlta &&
          bloqueCampo({
            campo: 'stockInicial',
            etiqueta: 'Stock inicial',
            ayuda: 'Lo que hay ahora en el armario. Queda en el historial como ajuste.',
            children: (
              <input
                {...propsCampo('stockInicial')}
                className="campo__entrada campo__entrada--mono formulario-producto__corto"
                inputMode="decimal"
                autoComplete="off"
              />
            ),
          })}

        {bloqueCampo({
          campo: 'notas',
          etiqueta: 'Notas (opcional)',
          children: (
            <textarea
              {...propsCampo('notas')}
              className="campo__entrada campo__entrada--area"
              rows={3}
              placeholder="Proveedor, referencia del catálogo…"
            />
          ),
        })}

        {errorGeneral && (
          <p className="mensaje-error" role="alert">
            <Icono nombre="info" tamano={18} />
            {errorGeneral}
          </p>
        )}

        {pie}

        <datalist id={listaArmarios}>
          {sugerencias?.armarios.map((a) => <option key={a} value={a} />)}
        </datalist>
        <datalist id={listaUnidades}>
          {sugerencias?.unidades.map((u) => <option key={u} value={u} />)}
        </datalist>
      </form>

      <div className="barra-accion">
        <button
          type="submit"
          form={idFormulario}
          className="boton boton--primario boton--grande boton--ancho"
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : textoGuardar}
        </button>
      </div>
    </>
  )
}
