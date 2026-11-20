// Copia de seguridad diaria del stock (la lanza .github/workflows/copia-diaria.yml a las 7:00 de
// Madrid). Entra con la cuenta de copias, lee de Firestore el stock de los dos laboratorios y guarda
// cada uno en <carpeta>/<laboratorio>.json con el formato de «Copia de seguridad» de la app, así que
// se restaura desde Ajustes → Copia de seguridad → Restaurar. Solo usa lo que trae Node.
//
//   COPIAS_CORREO=… COPIAS_CONTRASENA=… node scripts/copia-diaria.mjs <carpeta>
//
// En los registros de GitHub (públicos) solo se escriben recuentos, nunca datos.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LABORATORIOS } from '../src/datos/laboratorios.ts'
import { CONFIGURACION_FIREBASE } from '../src/datos/sincronizacion/configuracion.ts'

const TABLAS = ['productos', 'movimientos', 'fotos', 'pedidos']
/** Igual que FORMATO_COPIA y VERSION_COPIA de src/datos/copiaSeguridad.ts. */
const FORMATO_COPIA = 'stock-laboratorio'
const VERSION_COPIA = 1

/** Valor tipado de la API REST de Firestore → valor de JavaScript (los bytes, como { bytes: base64 }). */
export function valorFirestore(v) {
  if (v === null || typeof v !== 'object') return null
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('bytesValue' in v) return { bytes: v.bytesValue }
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(valorFirestore)
  if ('mapValue' in v) return camposFirestore(v.mapValue.fields ?? {})
  return null
}

function camposFirestore(campos) {
  return Object.fromEntries(Object.entries(campos).map(([clave, valor]) => [clave, valorFirestore(valor)]))
}

/** Documento de la API REST → fila del stock (null si es una lápida de algo borrado). */
export function documentoAFila(documento) {
  const campos = camposFirestore(documento.fields ?? {})
  if (campos.borrado === true) return null
  delete campos.borrado
  delete campos.modificadoEn
  return { ...campos, id: documento.name.split('/').pop() }
}

/** Filas de las cuatro tablas → texto de la copia (un elemento por línea, para que se lean los cambios). */
export function crearArchivoCopia(nombreLaboratorio, filas, ahora) {
  const ordenadas = (tabla) => [...(filas[tabla] ?? [])].sort((a, b) => a.id.localeCompare(b.id))
  const copia = {
    formato: FORMATO_COPIA,
    version: VERSION_COPIA,
    exportadaEn: ahora.toISOString(),
    // Sin umbral ni temperatura: son de cada móvil y restaurar la copia no debe cambiarlos.
    ajustes: { laboratorio: nombreLaboratorio },
    productos: ordenadas('productos'),
    movimientos: ordenadas('movimientos'),
    pedidos: ordenadas('pedidos'),
    fotos: ordenadas('fotos').map((foto) => ({
      ...foto,
      miniatura: `data:image/jpeg;base64,${foto.miniatura?.bytes ?? ''}`,
    })),
  }
  const lineas = ['{']
  const claves = Object.keys(copia)
  claves.forEach((clave, i) => {
    const coma = i < claves.length - 1 ? ',' : ''
    const valor = copia[clave]
    if (Array.isArray(valor)) {
      lineas.push(`  ${JSON.stringify(clave)}: [`)
      valor.forEach((elemento, j) => lineas.push(`    ${JSON.stringify(elemento)}${j < valor.length - 1 ? ',' : ''}`))
      lineas.push(`  ]${coma}`)
    } else {
      lineas.push(`  ${JSON.stringify(clave)}: ${JSON.stringify(valor)}${coma}`)
    }
  })
  lineas.push('}')
  return `${lineas.join('\n')}\n`
}

async function entrar(correo, contrasena) {
  const respuesta = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIGURACION_FIREBASE.apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: correo, password: contrasena, returnSecureToken: true }),
    },
  )
  const datos = await respuesta.json()
  if (!respuesta.ok) throw new Error(`No se pudo entrar con la cuenta de copias: ${datos?.error?.message ?? respuesta.status}`)
  return datos.idToken
}

async function leerColeccion(token, laboratorio, tabla) {
  const base = `https://firestore.googleapis.com/v1/projects/${CONFIGURACION_FIREBASE.projectId}/databases/(default)/documents/laboratorios/${laboratorio}/${tabla}`
  const filas = []
  let pagina
  do {
    const parametros = new URLSearchParams({ pageSize: tabla === 'fotos' ? '50' : '300' })
    if (pagina) parametros.set('pageToken', pagina)
    const respuesta = await fetch(`${base}?${parametros}`, { headers: { authorization: `Bearer ${token}` } })
    const datos = await respuesta.json()
    if (!respuesta.ok) throw new Error(`No se pudo leer ${laboratorio}/${tabla}: ${datos?.error?.message ?? respuesta.status}`)
    for (const documento of datos.documents ?? []) {
      const fila = documentoAFila(documento)
      if (fila) filas.push(fila)
    }
    pagina = datos.nextPageToken
  } while (pagina)
  return filas
}

const LEEME = `# Copias de seguridad del stock

Las hace cada día a las 7:00 (hora de Madrid) el flujo «Copia de seguridad diaria» del repositorio de
la app. Cada archivo es el stock completo de un laboratorio, con el formato de la copia de seguridad
de la app:

- \`cromatografia.json\`: Lab. Cromatografía
- \`foodcontact.json\`: Lab. Food Contact
- \`ultima-copia.txt\`: cuándo se hizo la última y cuánto lleva

Cada día es un commit: para una copia de otro día, abre el archivo, «History», elige el día y
descárgalo («Raw» → Guardar como).

**Restaurar:** en la app, abre el laboratorio, Ajustes → Copia de seguridad → «Restaurar copia» y
elige el archivo. Sustituye el stock de ese laboratorio en todos los móviles (antes enseña qué trae).
`

async function main() {
  const carpeta = process.argv[2]
  const correo = process.env.COPIAS_CORREO
  const contrasena = process.env.COPIAS_CONTRASENA
  if (!carpeta || !correo || !contrasena) {
    console.error('Uso: COPIAS_CORREO=… COPIAS_CONTRASENA=… node scripts/copia-diaria.mjs <carpeta>')
    process.exit(2)
  }
  mkdirSync(carpeta, { recursive: true })
  const ahora = new Date()
  const token = await entrar(correo, contrasena)
  const resumen = []
  for (const { id, nombre } of LABORATORIOS) {
    const filas = {}
    for (const tabla of TABLAS) filas[tabla] = await leerColeccion(token, id, tabla)
    writeFileSync(join(carpeta, `${id}.json`), crearArchivoCopia(nombre, filas, ahora))
    const cuenta = TABLAS.map((t) => `${filas[t].length} ${t}`).join(', ')
    resumen.push(`${nombre}: ${cuenta}`)
    console.log(`${nombre}: ${cuenta}`)
  }
  const fecha = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(ahora)
  writeFileSync(join(carpeta, 'ultima-copia.txt'), `${fecha} (hora de Madrid)\n${resumen.join('\n')}\n`)
  if (!existsSync(join(carpeta, 'README.md'))) writeFileSync(join(carpeta, 'README.md'), LEEME)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
