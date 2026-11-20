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
import { Arranque } from './app/Arranque'
import { escucharServiceWorker } from './app/avisosMovil'
import { cargarSesion } from './app/sesion'
import { precargarModelo } from './reconocimiento/modelo'

// Quién ha entrado en este móvil y qué laboratorio ve (Arranque decide qué pantalla toca).
void cargarSesion()

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el elemento #root en index.html')

createRoot(raiz).render(
  <StrictMode>
    <Arranque />
  </StrictMode>,
)

// El modelo de reconocimiento se carga al arrancar, con calentamiento, para que la cámara
// responda enseguida (CLAUDE.md §5, paso 8).
precargarModelo()

// Al tocar una notificación con la app abierta, se va a su pantalla (A pedir, Caducidades).
escucharServiceWorker()
