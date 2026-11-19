import { ultimoDiaDelMes } from '../dominio/caducidad'
import { fechaSinHora } from '../dominio/formato'
import type { VolcadoDatos } from './StockRepository'
import type { Categoria, Movimiento, Pedido, Producto, TipoMovimiento } from './tipos'
import { sinIndefinidos } from './utilidades'
import { nuevoId } from './uuid'

/**
 * Datos de ejemplo: los productos que aparecen en las maquetas de diseno/, con un historial
 * coherente con lo que se ve en ellas (4 a pedir, 2 pedidos en curso, 1 caducidad en menos de
 * 30 días, 1 lote ya caducado, «últ. mov. hoy 08:12»…). Las fechas son relativas al momento de cargarlos.
 * No llevan fotos de referencia: el reconocimiento se prueba con vuestros productos reales.
 */

interface MovimientoDeEjemplo {
  /** Días antes de hoy. */
  hace: number
  /** hh:mm */
  hora: string
  tipo: TipoMovimiento
  cantidad: number
  usuario: string
  lote?: string
  /**
   * Caducidad por mes/año, guardada como el último día del mes: fecha fija (AAAA-MM-DD),
   * «fin de este mes» (siempre a menos de 30 días: cuenta en «Caducan <30 d») o «fin del mes
   * pasado» (un lote ya caducado, para la pantalla Caducidades).
   */
  caducidad?: string | 'fin-de-este-mes' | 'fin-del-mes-pasado'
  nota?: string
  confianza?: number
}

interface PedidoDeEjemplo {
  hace: number
  hora: string
  cantidad?: number
  /** Posición del movimiento de entrada con que se recibió. Sin él, el pedido sigue en curso. */
  recibidoCon?: number
}

interface ProductoDeEjemplo {
  codigo: string
  nombre: string
  categoria: Categoria
  formato: string
  unidadCorta: string
  armario: string
  balda?: string
  stockMinimo: number
  cantidadPedidoSugerida?: number
  /** En orden cronológico; el stock final sale de ellos. */
  movimientos: MovimientoDeEjemplo[]
  pedidos?: PedidoDeEjemplo[]
}

const CATALOGO: ProductoDeEjemplo[] = [
  {
    codigo: 'R-014',
    nombre: 'Etanol absoluto',
    categoria: 'reactivo',
    formato: 'Botella 1 L',
    unidadCorta: 'bot.',
    armario: 'Armario inflamables',
    balda: 'Balda 2',
    stockMinimo: 3,
    cantidadPedidoSugerida: 6,
    movimientos: [
      { hace: 40, hora: '10:20', tipo: 'entrada', cantidad: 6, usuario: 'LP', lote: 'K4920113', caducidad: '2028-05-31', nota: 'Albarán 25-1187' },
      { hace: 20, hora: '12:05', tipo: 'retirada_foto', cantidad: -2, usuario: 'MG', confianza: 0.91 },
      { hace: 9, hora: '09:40', tipo: 'retirada_manual', cantidad: -2, usuario: 'AR' },
      { hace: 0, hora: '08:12', tipo: 'retirada_foto', cantidad: -1, usuario: 'MG', confianza: 0.94 },
    ],
  },
  {
    codigo: 'R-022',
    nombre: 'Isooctano',
    categoria: 'reactivo',
    formato: 'Botella 2,5 L',
    unidadCorta: 'bot.',
    armario: 'Armario inflamables',
    balda: 'Balda 1',
    stockMinimo: 2,
    cantidadPedidoSugerida: 4,
    movimientos: [
      { hace: 60, hora: '11:30', tipo: 'entrada', cantidad: 4, usuario: 'LP', lote: 'S1158730', caducidad: 'fin-de-este-mes' },
      { hace: 15, hora: '16:10', tipo: 'retirada_manual', cantidad: -1, usuario: 'AR' },
    ],
  },
  {
    codigo: 'R-031',
    nombre: 'Ácido acético 3 %',
    categoria: 'reactivo',
    formato: 'Bidón 5 L',
    unidadCorta: 'bid.',
    armario: 'Armario ácidos',
    balda: 'Balda 1',
    stockMinimo: 2,
    cantidadPedidoSugerida: 4,
    movimientos: [
      { hace: 35, hora: '10:00', tipo: 'entrada', cantidad: 4, usuario: 'LP', lote: 'A0907-23', caducidad: 'fin-del-mes-pasado' },
      { hace: 12, hora: '13:15', tipo: 'retirada_foto', cantidad: -1, usuario: 'MG', confianza: 0.88 },
      { hace: 3, hora: '09:05', tipo: 'retirada_foto', cantidad: -1, usuario: 'AR', confianza: 0.9 },
    ],
  },
  {
    codigo: 'F-031',
    nombre: 'Puntas de pipeta 1000 µL',
    categoria: 'fungible',
    formato: 'Rack 96 uds',
    unidadCorta: 'racks',
    armario: 'Armario 2',
    balda: 'Balda 3',
    stockMinimo: 5,
    cantidadPedidoSugerida: 10,
    movimientos: [
      { hace: 30, hora: '09:30', tipo: 'entrada', cantidad: 6, usuario: 'LP' },
      { hace: 12, hora: '11:20', tipo: 'retirada_foto', cantidad: -1, usuario: 'MG', confianza: 0.93 },
      { hace: 8, hora: '15:45', tipo: 'retirada_manual', cantidad: -2, usuario: 'AR' },
      { hace: 7, hora: '10:05', tipo: 'entrada', cantidad: 10, usuario: 'LP' },
      { hace: 1, hora: '16:40', tipo: 'retirada_foto', cantidad: -1, usuario: 'MG', confianza: 0.95 },
    ],
    pedidos: [{ hace: 10, hora: '09:15', cantidad: 10, recibidoCon: 3 }],
  },
  {
    codigo: 'F-030',
    nombre: 'Puntas de pipeta 200 µL',
    categoria: 'fungible',
    formato: 'Rack 96 uds',
    unidadCorta: 'racks',
    armario: 'Armario 2',
    balda: 'Balda 3',
    stockMinimo: 5,
    cantidadPedidoSugerida: 10,
    movimientos: [
      { hace: 30, hora: '09:31', tipo: 'entrada', cantidad: 10, usuario: 'LP' },
      { hace: 16, hora: '12:40', tipo: 'retirada_foto', cantidad: -2, usuario: 'MG', confianza: 0.89 },
      { hace: 10, hora: '17:05', tipo: 'retirada_foto', cantidad: -2, usuario: 'AR', confianza: 0.86 },
      { hace: 2, hora: '10:50', tipo: 'retirada_foto', cantidad: -2, usuario: 'MG', confianza: 0.9 },
    ],
  },
  {
    codigo: 'F-012',
    nombre: 'Tapones rosca 9 mm PTFE',
    categoria: 'fungible',
    formato: 'Bolsa 100 uds',
    unidadCorta: 'uds',
    armario: 'Armario 2',
    balda: 'Balda 1',
    stockMinimo: 200,
    cantidadPedidoSugerida: 500,
    movimientos: [
      { hace: 50, hora: '10:10', tipo: 'entrada', cantidad: 500, usuario: 'LP' },
      { hace: 30, hora: '12:00', tipo: 'retirada_manual', cantidad: -100, usuario: 'AR' },
      { hace: 18, hora: '09:25', tipo: 'retirada_manual', cantidad: -150, usuario: 'MG' },
      { hace: 5, hora: '15:30', tipo: 'retirada_manual', cantidad: -100, usuario: 'AR' },
    ],
  },
  {
    codigo: 'F-029',
    nombre: 'Puntas de pipeta 10 µL',
    categoria: 'fungible',
    formato: 'Rack 96 uds',
    unidadCorta: 'racks',
    armario: 'Armario 2',
    balda: 'Balda 3',
    stockMinimo: 3,
    cantidadPedidoSugerida: 6,
    movimientos: [
      { hace: 25, hora: '09:00', tipo: 'entrada', cantidad: 8, usuario: 'LP' },
      { hace: 6, hora: '11:35', tipo: 'retirada_foto', cantidad: -2, usuario: 'MG', confianza: 0.87 },
    ],
  },
  {
    codigo: 'F-007',
    nombre: 'Guantes nitrilo talla M',
    categoria: 'fungible',
    formato: 'Caja 100 uds',
    unidadCorta: 'cajas',
    armario: 'Armario 1',
    balda: 'Balda 2',
    stockMinimo: 2,
    cantidadPedidoSugerida: 10,
    movimientos: [
      { hace: 40, hora: '10:30', tipo: 'entrada', cantidad: 10, usuario: 'LP' },
      { hace: 20, hora: '08:50', tipo: 'retirada_manual', cantidad: -3, usuario: 'AR' },
      { hace: 12, hora: '09:10', tipo: 'retirada_manual', cantidad: -4, usuario: 'MG' },
      { hace: 6, hora: '08:45', tipo: 'retirada_manual', cantidad: -2, usuario: 'AR' },
    ],
    pedidos: [{ hace: 5, hora: '10:00' }],
  },
  {
    codigo: 'F-024',
    nombre: 'Filtros jeringa PTFE 0,45 µm',
    categoria: 'fungible',
    formato: 'Caja 100 uds',
    unidadCorta: 'cajas',
    armario: 'Armario 2',
    balda: 'Balda 2',
    stockMinimo: 1,
    cantidadPedidoSugerida: 2,
    movimientos: [
      { hace: 45, hora: '11:00', tipo: 'entrada', cantidad: 2, usuario: 'LP', lote: 'F22-0931', caducidad: '2027-08-31' },
      { hace: 8, hora: '14:20', tipo: 'retirada_manual', cantidad: -1, usuario: 'MG' },
      { hace: 3, hora: '12:30', tipo: 'retirada_manual', cantidad: -1, usuario: 'AR' },
    ],
    pedidos: [{ hace: 2, hora: '09:45' }],
  },
]

/** Momento «hace N días a las hh:mm» (hora local) en ISO. Nunca en el futuro. */
function momento(ahora: Date, hace: number, hora: string): string {
  const [horas = 0, minutos = 0] = hora.split(':').map(Number)
  const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - hace, horas, minutos)
  return fecha.getTime() > ahora.getTime() ? new Date(ahora.getTime() - 60_000).toISOString() : fecha.toISOString()
}

function caducidadDe(valor: MovimientoDeEjemplo['caducidad'], ahora: Date): string | undefined {
  if (valor === 'fin-de-este-mes') return fechaSinHora(ultimoDiaDelMes(ahora.getFullYear(), ahora.getMonth() + 1))
  if (valor === 'fin-del-mes-pasado') return fechaSinHora(ultimoDiaDelMes(ahora.getFullYear(), ahora.getMonth()))
  return valor
}

export function crearDatosEjemplo(ahora: Date = new Date()): VolcadoDatos {
  const productos: Producto[] = []
  const movimientos: Movimiento[] = []
  const pedidos: Pedido[] = []
  const creadoEn = momento(ahora, 120, '09:00')

  for (const definicion of CATALOGO) {
    const productoId = nuevoId()
    let stock = 0
    const propios = definicion.movimientos.map((m) => {
      stock += m.cantidad
      if (stock < 0) throw new Error(`Datos de ejemplo incoherentes en ${definicion.codigo}`)
      return sinIndefinidos<Movimiento>({
        id: nuevoId(),
        productoId,
        tipo: m.tipo,
        cantidad: m.cantidad,
        stockResultante: stock,
        lote: m.lote,
        caducidad: caducidadDe(m.caducidad, ahora),
        nota: m.nota,
        confianza: m.confianza,
        usuario: m.usuario,
        fecha: momento(ahora, m.hace, m.hora),
      })
    })
    movimientos.push(...propios)

    for (const p of definicion.pedidos ?? []) {
      const recepcion = p.recibidoCon === undefined ? undefined : propios[p.recibidoCon]
      pedidos.push(
        sinIndefinidos<Pedido>({
          id: nuevoId(),
          productoId,
          cantidad: p.cantidad ?? definicion.cantidadPedidoSugerida,
          estado: recepcion ? 'recibido' : 'pedido',
          fechaPedido: momento(ahora, p.hace, p.hora),
          fechaRecepcion: recepcion?.fecha,
        }),
      )
    }

    productos.push(
      sinIndefinidos<Producto>({
        id: productoId,
        codigo: definicion.codigo,
        nombre: definicion.nombre,
        categoria: definicion.categoria,
        formato: definicion.formato,
        unidadCorta: definicion.unidadCorta,
        armario: definicion.armario,
        balda: definicion.balda,
        stockActual: stock,
        stockMinimo: definicion.stockMinimo,
        cantidadPedidoSugerida: definicion.cantidadPedidoSugerida,
        archivado: false,
        creadoEn,
        actualizadoEn: propios.at(-1)?.fecha ?? creadoEn,
      }),
    )
  }

  return { productos, fotos: [], movimientos, pedidos }
}
