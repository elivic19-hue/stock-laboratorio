/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const paquete = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const enPruebas = mode === 'test'
  // La cámara exige HTTPS. Con el certificado autofirmado se puede abrir la app desde el
  // móvil en la misma red. En modo «http» (npm run preview:local) se sirve por HTTP en
  // localhost, que el navegador sí trata como seguro para instalar la app y usarla offline.
  const conHttps = !enPruebas && mode !== 'http'

  return {
    // Rutas relativas: la misma compilación vale para GitHub Pages (/stock-laboratorio/) y Netlify (/).
    base: './',
    define: {
      __VERSION_APP__: JSON.stringify(paquete.version),
      __FECHA_COMPILACION__: JSON.stringify(new Date().toISOString()),
    },
    plugins: [
      react(),
      conHttps && basicSsl(),
      !enPruebas &&
        VitePWA({
          registerType: 'prompt',
          injectRegister: false,
          includeAssets: ['icono.svg', 'iconos/apple-touch-icon.png'],
          manifest: {
            name: 'Stock del laboratorio',
            short_name: 'Stock lab',
            description: 'Control de stock de reactivos y material fungible del laboratorio.',
            lang: 'es-ES',
            dir: 'ltr',
            start_url: './',
            scope: './',
            display: 'standalone',
            orientation: 'portrait',
            background_color: '#F3F4F1',
            theme_color: '#FFFFFF',
            icons: [
              { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              {
                src: 'iconos/icono-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            // Se precarga todo para que la app funcione sin conexión desde la primera instalación.
            // json y bin quedan preparados para los pesos del modelo (etapa 3, public/models/).
            globPatterns: ['**/*.{html,js,css,woff2,svg,png,webmanifest,json,bin}'],
            maximumFileSizeToCacheInBytes: 32 * 1024 * 1024,
            cleanupOutdatedCaches: true,
            // Avisos del móvil: aviso diario de caducados, número en el icono y clic en las
            // notificaciones (etapa 4).
            importScripts: ['sw-avisos.js'],
          },
        }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['src/pruebas/preparar.ts'],
    },
  }
})
