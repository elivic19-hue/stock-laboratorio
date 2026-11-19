// Genera los iconos PNG de la app (public/iconos/) a partir del dibujo en SVG, usando Edge o
// Chrome en modo sin ventana. Así no hace falta ninguna dependencia para dibujar imágenes.
//
// Uso: npm run iconos   (o NAVEGADOR="ruta\a\chrome.exe" npm run iconos)

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AZUL_ACCION = '#2340B8'

// radio 0 = cuadrado lleno: el sistema recorta la forma (iOS y los iconos «maskable» de Android).
const ICONOS = [
  { archivo: 'icono-192.png', tamano: 192, radio: 42, escala: 5.6, grosor: 1.5 },
  { archivo: 'icono-512.png', tamano: 512, radio: 112, escala: 15, grosor: 1.5 },
  // Zona segura de Android: el dibujo cabe de sobra en el círculo central del 80 %.
  { archivo: 'icono-maskable-512.png', tamano: 512, radio: 0, escala: 12, grosor: 1.6 },
  { archivo: 'apple-touch-icon.png', tamano: 180, radio: 0, escala: 5.6, grosor: 1.5 },
]

/** El cubo de la pestaña «Stock» (rejilla de 24 px) centrado sobre el azul de acción. */
function dibujo({ tamano, radio, escala, grosor }) {
  const desplazamiento = tamano / 2 - 12 * escala
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 ${tamano} ${tamano}">
  <rect width="${tamano}" height="${tamano}" rx="${radio}" fill="${AZUL_ACCION}"/>
  <g transform="translate(${desplazamiento} ${desplazamiento}) scale(${escala})" fill="none" stroke="#FFFFFF"
     stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 8l8-4 8 4v8l-8 4-8-4z"/>
    <path d="M4 8l8 4 8-4M12 12v8"/>
  </g>
</svg>`
}

function medidasPng(ruta) {
  const datos = readFileSync(ruta)
  return [datos.readUInt32BE(16), datos.readUInt32BE(20)]
}

const NAVEGADORES = [
  process.env.NAVEGADOR,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const navegador = NAVEGADORES.find((ruta) => existsSync(ruta))
if (!navegador) {
  console.error('No encuentro Edge ni Chrome. Indica su ruta con la variable de entorno NAVEGADOR.')
  process.exit(1)
}

const destino = fileURLToPath(new URL('../public/iconos/', import.meta.url))
mkdirSync(destino, { recursive: true })
const temporal = mkdtempSync(join(tmpdir(), 'iconos-stock-'))

try {
  for (const icono of ICONOS) {
    const pagina = join(temporal, `${icono.archivo}.html`)
    writeFileSync(
      pagina,
      `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${dibujo(icono)}</body></html>`,
    )
    const salida = join(destino, icono.archivo)
    rmSync(salida, { force: true })
    const resultado = spawnSync(
      navegador,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--window-size=${icono.tamano},${icono.tamano}`,
        '--default-background-color=00000000',
        `--user-data-dir=${join(temporal, 'perfil')}`,
        `--screenshot=${salida}`,
        pathToFileURL(pagina).href,
      ],
      { stdio: 'pipe', timeout: 60_000 },
    )
    if (!existsSync(salida)) {
      console.error(`No se pudo generar ${icono.archivo}:`, resultado.stderr?.toString() ?? resultado.error)
      process.exit(1)
    }
    const [ancho, alto] = medidasPng(salida)
    if (ancho !== icono.tamano || alto !== icono.tamano) {
      console.error(`${icono.archivo} ha salido de ${ancho}x${alto}; se esperaba ${icono.tamano}x${icono.tamano}.`)
      process.exit(1)
    }
    console.log(`OK public/iconos/${icono.archivo} (${ancho}x${alto})`)
  }
} finally {
  rmSync(temporal, { recursive: true, force: true })
}
