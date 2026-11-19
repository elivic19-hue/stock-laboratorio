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
import { precargarModelo } from './reconocimiento/modelo'

// Fase 1: todo en IndexedDB, en este móvil. En la fase 2 solo cambiará esta línea del repositorio.
const baseDatos = new BaseDatosStock()
const servicios: Servicios = {
  repo: new LocalRepository(baseDatos),
  ajustes: new AlmacenAjustesLocal(baseDatos),
}

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
