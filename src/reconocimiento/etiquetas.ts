import { normalizarLote, type LoteProducto } from '../dominio/lotes'
import { fechaSinHora } from '../dominio/formato'
import { ultimoDiaDelMes } from '../dominio/caducidad'

/**
 * Lote leído en la etiqueta (docs/decisiones.md, «Lotes: archivar y restar de un lote»). Los
 * frascos de reactivo suelen llevar un DataMatrix GS1 con el GTIN (01), la caducidad (17) y el lote
 * (10). El móvil lo lee con el lector de códigos del navegador (BarcodeDetector: Chrome en Android;
 * en iPhone no existe y el lote se elige a mano). Leer el texto impreso necesitaría un OCR
 * (dependencia nueva), así que no se hace.
 */

export interface DatosEtiqueta {
  /** (01) Código del artículo. */
  gtin?: string
  /** (10) Lote. */
  lote?: string
  /** (17) Caducidad, AAAA-MM-DD (día 00 = último día del mes). */
  caducidad?: string
}

const GS = '\u001d'

/** AI de longitud fija (número de caracteres del valor). */
const FIJOS: Record<string, number> = {
  '00': 18,
  '01': 14,
  '02': 14,
  '11': 6,
  '12': 6,
  '13': 6,
  '15': 6,
  '16': 6,
  '17': 6,
  '20': 2,
}

/** AI de longitud variable (terminan en GS o al final). */
const VARIABLES = new Set(['10', '21', '22', '30', '37', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '240', '241', '250', '251', '400', '401', '402', '403'])

/** Lee los datos GS1 de un código: «(01)…(17)…(10)…» o seguidos con separadores GS. null si no es GS1. */
export function leerGs1(texto: string): DatosEtiqueta | null {
  // Sin el prefijo de simbología («]d2», «]C1»…) ni el separador GS del principio.
  let limpio = texto.replace(/^\][A-Za-z]\d/, '').trim()
  while (limpio.startsWith(GS)) limpio = limpio.slice(1)
  const valores = new Map<string, string>()

  if (limpio.startsWith('(')) {
    for (const [, ai, valor] of limpio.matchAll(/\((\d{2,4})\)([^(]*)/g)) {
      if (ai && valor !== undefined) valores.set(ai, valor.replace(new RegExp(GS, 'g'), '').trim())
    }
  } else if (/^\d{2}/.test(limpio)) {
    let i = 0
    while (i < limpio.length) {
      if (limpio[i] === GS) {
        i++
        continue
      }
      const dos = limpio.slice(i, i + 2)
      const tres = limpio.slice(i, i + 3)
      const cuatro = limpio.slice(i, i + 4)
      if (FIJOS[dos] !== undefined) {
        const largo = FIJOS[dos]
        valores.set(dos, limpio.slice(i + 2, i + 2 + largo))
        i += 2 + largo
      } else if (/^3[1-6]\d\d$/.test(cuatro)) {
        // Medidas (310n…369n): 6 cifras.
        i += 10
      } else if (VARIABLES.has(dos) || VARIABLES.has(tres)) {
        const ai = VARIABLES.has(tres) ? tres : dos
        const fin = limpio.indexOf(GS, i + ai.length)
        valores.set(ai, limpio.slice(i + ai.length, fin === -1 ? undefined : fin))
        i = fin === -1 ? limpio.length : fin + 1
      } else {
        break // AI desconocido: no se sigue para no inventar datos.
      }
    }
  }

  const gtin = valores.get('01')
  const lote = valores.get('10')?.trim()
  const caducidad = fechaGs1(valores.get('17'))
  if (!gtin && !lote && !caducidad) return null
  return { ...(gtin ? { gtin } : {}), ...(lote ? { lote } : {}), ...(caducidad ? { caducidad } : {}) }
}

/** AAMMDD → AAAA-MM-DD; el día 00 es el último día del mes. */
function fechaGs1(valor: string | undefined): string | undefined {
  if (!valor || !/^\d{6}$/.test(valor)) return undefined
  const anio = 2000 + Number(valor.slice(0, 2))
  const mes = Number(valor.slice(2, 4))
  const dia = Number(valor.slice(4, 6))
  if (mes < 1 || mes > 12) return undefined
  const fecha = dia === 0 ? ultimoDiaDelMes(anio, mes) : new Date(anio, mes - 1, dia)
  return fechaSinHora(fecha)
}

/** Lote que dice la etiqueta (GS1 o un texto «LOT …»), esté o no registrado. */
export function loteDeEtiqueta(codigos: readonly string[]): string | undefined {
  for (const texto of codigos) {
    const lote = leerGs1(texto)?.lote
    if (lote) return lote
  }
  for (const texto of codigos) {
    const lote = /\b(?:LOT|LOTE|BATCH|CH\.?-?B\.?)\s*[:#.]?\s*([A-Z0-9][A-Z0-9-]{2,})/i.exec(texto)?.[1]
    if (lote) return lote
  }
  return undefined
}

// ─── Texto impreso (OCR) ────────────────────────────────────────────────────

/** Letras que el OCR confunde con cifras: se cambian al comparar con lotes que son solo números. */
const COMO_CIFRA: Record<string, string> = { O: '0', D: '0', Q: '0', U: '0', I: '1', L: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' }

function soloAlfanumerico(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Distancia de edición (cambios, altas y bajas de un carácter). */
export function distanciaEdicion(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0] ?? 0
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j] ?? 0
      fila[j] = Math.min(arriba + 1, (fila[j - 1] ?? 0) + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = arriba
    }
  }
  return fila[b.length] ?? 0
}

/** Menor distancia entre `codigo` y cualquier trozo de `texto` de su largo (±1). */
function mejorDistancia(texto: string, codigo: string): number {
  if (texto.includes(codigo)) return 0
  let mejor = Infinity
  for (let largo = codigo.length - 1; largo <= codigo.length + 1; largo++) {
    if (largo < 1 || largo > texto.length) continue
    for (let i = 0; i + largo <= texto.length; i++) {
      mejor = Math.min(mejor, distanciaEdicion(texto.slice(i, i + largo), codigo))
      if (mejor === 0) return 0
    }
  }
  return mejor
}

/**
 * Lote abierto cuyo código aparece en el texto leído de la etiqueta (OCR). Tolera fallos del lector
 * (1 carácter en códigos de 5 a 7, 2 desde 8; los de menos de 4 no se buscan) y, en los lotes que
 * son solo números, las letras que parecen cifras. Si dos lotes encajan igual de bien, no se elige
 * ninguno (pasa con lotes seguidos como 4920113 y 4920114 si el lector duda en la última cifra).
 */
export function loteEnTexto(texto: string, lotes: readonly LoteProducto[]): string | undefined {
  // Cada línea del OCR por separado y también todo junto (a veces parte el número con un espacio).
  const lineas = texto.split(/\n+/).map(soloAlfanumerico).filter((l) => l.length >= 3)
  if (lineas.length === 0) return undefined
  let mejor: { clave: string; distancia: number } | undefined
  let empate = false
  for (const lote of lotes) {
    if (!lote.lote) continue
    const codigo = soloAlfanumerico(lote.lote)
    if (codigo.length < 4) continue
    const numerico = /^\d+$/.test(codigo)
    const tolerancia = codigo.length >= 8 ? 2 : codigo.length >= 5 ? 1 : 0
    let distancia = Infinity
    for (const linea of lineas) {
      const comparable = numerico ? linea.replace(/[A-Z]/g, (l) => COMO_CIFRA[l] ?? l) : linea
      distancia = Math.min(distancia, mejorDistancia(comparable, codigo))
    }
    if (distancia > tolerancia) continue
    if (!mejor || distancia < mejor.distancia) {
      mejor = { clave: lote.clave, distancia }
      empate = false
    } else if (distancia === mejor.distancia) {
      empate = true
    }
  }
  return mejor && !empate ? mejor.clave : undefined
}

/** Lote que dice el texto impreso («LOT 4920113», «Lote: …», «Ch.-B. …», «Batch …»), esté o no registrado. */
export function loteImpreso(texto: string): string | undefined {
  const encontrado =
    /\b(?:LOTE?\b|LOT\.|BATCH\b|CH\.?\s*-?\s*B\.?)\s*(?:N[O°º]?\s*\.?\s*)?[:#.]?\s*([A-Z0-9][A-Z0-9-]{3,})/i.exec(texto)
  return encontrado?.[1]?.toUpperCase()
}

/**
 * Clave del lote abierto que aparece en los códigos leídos: primero por el lote GS1 o «LOT …»;
 * si no, porque el texto contiene el código de un lote (de 4 caracteres o más, para no confundir
 * códigos cortos con trozos de otro número).
 */
export function loteEnCodigos(codigos: readonly string[], lotes: readonly LoteProducto[]): string | undefined {
  const conCodigo = lotes.filter((l) => l.lote)
  const dicho = loteDeEtiqueta(codigos)
  if (dicho) {
    const lote = conCodigo.find((l) => l.clave === normalizarLote(dicho))
    if (lote) return lote.clave
  }
  const textos = codigos.map(normalizarLote)
  const candidatos = conCodigo.filter((l) => l.clave.length >= 4).sort((a, b) => b.clave.length - a.clave.length)
  return candidatos.find((l) => textos.some((t) => t.includes(l.clave)))?.clave
}
