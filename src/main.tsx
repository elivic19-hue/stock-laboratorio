// Fuentes autoalojadas (CLAUDE.md §3): solo los pesos que usa el diseño y el alfabeto latino.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './ui/tokens.css'
import './ui/base.css'
import './ui/componentes.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import type { Servicios } from './app/contexto'
import { ProveedorServicios } from './app/ProveedorServicios'
import { AlmacenAjustesLocal } from './datos/ajustes'
import { BaseDatosStock } from './datos/db'
import { LocalRepository } from './datos/LocalRepository'
import { prepararSincronizacion } from './datos/sincronizacion/servicio'
import { precargarModelo } from './reconocimiento/modelo'
import { escucharServiceWorker } from './app/avisosMovil'

// Los datos se leen y escriben siempre en este móvil (IndexedDB), así todo funciona sin conexión.
// Si el móvil está conectado al laboratorio (fase 2), la sincronización los comparte con los demás.
const baseDatos = new BaseDatosStock()
const repo = new LocalRepository(baseDatos)
const servicios: Servicios = {
  repo,
  ajustes: new AlmacenAjustesLocal(baseDatos),
}
void prepararSincronizacion(baseDatos, repo)

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el elemento #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <ProveedorServicios servicios={servicios}>
      <App />
    </ProveedorServicios>
  </StrictMode>,
)

// El modelo de reconocimiento se carga al arrancar, con calentamiento, para que la cámara
// responda enseguida (CLAUDE.md §5, paso 8).
precargarModelo()

// Al tocar una notificación con la app abierta, se va a su pantalla (A pedir, Caducidades).
escucharServiceWorker()
