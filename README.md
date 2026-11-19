# Stock del laboratorio

App móvil (PWA instalable) para controlar el stock de reactivos y material fungible del laboratorio.
Restar stock con una foto que se reconoce en el propio móvil, sumar a mano al recibir pedidos y avisos
cuando un producto llega a su mínimo. Funciona sin conexión y no tiene ningún coste.

La especificación completa está en [CLAUDE.md](CLAUDE.md); las maquetas, en [diseno/](diseno/), y las
decisiones tomadas por el camino, en [docs/decisiones.md](docs/decisiones.md).

**Estado:** etapa 1 de 5 (esqueleto). Fase 1: todos los datos se guardan solo en el móvil.

## Requisitos

- [Node.js](https://nodejs.org) 22.12 o superior (se usa la 26 LTS) y [Git](https://git-scm.com).
- En el ordenador de desarrollo están instalados solo para el usuario, sin permisos de administrador:
  Node.js en `%LOCALAPPDATA%\Programs\nodejs` y Git en `%LOCALAPPDATA%\Programs\Git`.
- El proyecto está fuera de OneDrive (`%USERPROFILE%\dev\stock-laboratorio`): la sincronización no se
  lleva bien con `node_modules` ni con `.git`.

## Arrancar

```
npm install
npm run dev
```

La app se abre en `https://localhost:5173`. El certificado es autofirmado, así que el navegador avisa:
elige continuar (en Chrome, «Configuración avanzada» → «Acceder a localhost»).

## Probar en el móvil (misma red Wi-Fi)

La cámara solo funciona con HTTPS; por eso el servidor de desarrollo usa un certificado propio.

1. Conecta el móvil a la misma red Wi-Fi que el ordenador.
2. Ejecuta `npm run dev`. En la terminal aparece una línea `Network: https://192.168.x.x:5173/`.
3. Abre esa dirección en el móvil: Chrome en Android, Safari en iPhone.
4. Acepta el aviso del certificado:
   - Android: «Configuración avanzada» → «Acceder a 192.168.x.x (sitio no seguro)».
   - iPhone: «Mostrar detalles» → «visitar este sitio web».
5. La primera vez, Windows puede preguntar si Node.js puede usar la red: permítelo en redes privadas.

Limitaciones de esta forma de probar:

- Con el certificado autofirmado la cámara funciona, pero el navegador no activa el modo sin conexión
  ni deja instalar la app de verdad. Para eso, usa la versión publicada (ver más abajo).
- Si el móvil no llega a conectar, puede que la red de la empresa aísle los dispositivos entre sí.
  En ese caso, usa también la versión publicada.

## Instalar la app

Desde la versión publicada en GitHub Pages (tiene un certificado válido):

- **Android (Chrome):** menú ⋮ → «Instalar aplicación» (o «Añadir a pantalla de inicio»).
- **iPhone (Safari):** botón Compartir → «Añadir a pantalla de inicio».
  **Importante:** en iPhone, la app instalada guarda sus datos aparte de Safari. Instálala antes de
  empezar a meter datos y úsala siempre desde su icono.

En el ordenador también se puede probar la instalación y el modo sin conexión:

```
npm run build
npm run preview:local
```

Abre `http://localhost:4173` en Chrome o Edge y pulsa el icono de instalar de la barra de direcciones.

Cuando se publica una versión nueva, la app muestra «Hay una versión nueva de la app» con el botón
«Actualizar». No se actualiza sola, para no recargar la pantalla mientras alguien registra algo.

## Publicar gratis en GitHub Pages

1. Crea una cuenta en [GitHub](https://github.com) y un repositorio **público** vacío llamado
   `stock-laboratorio` (sin README ni licencia). GitHub Pages solo es gratis con repositorios públicos.
2. En la carpeta del proyecto:
   ```
   git remote add origin https://github.com/TU-USUARIO/stock-laboratorio.git
   git push -u origin main
   ```
   La primera vez se abre el navegador para iniciar sesión en GitHub.
3. En el repositorio de GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   Si la primera publicación falló porque este paso aún no estaba hecho, vuelve a lanzarla desde
   **Actions → Desplegar en GitHub Pages → Re-run jobs**.
4. La app queda en `https://TU-USUARIO.github.io/stock-laboratorio/`. Cada `git push` a `main` pasa los
   tests y vuelve a publicarla.

## Copias de seguridad

En la fase 1 los datos **solo están en el móvil**. Se pierden si se pierde el móvil, si se borran los
datos del navegador o si se desinstala la app.

- La exportación e importación de una copia en JSON (con fotos de referencia incluidas) llega en la
  etapa 4: Ajustes → Copia de seguridad.
- La app pide al navegador almacenamiento persistente, para que no borre los datos si falta espacio.
  En Ajustes se ve si lo ha concedido; instalar la app ayuda.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HTTPS, accesible desde la red local |
| `npm test` | Tests (Vitest) |
| `npm run lint` | Revisión del código (Oxlint) |
| `npm run build` | Compila la versión de producción en `dist/` |
| `npm run preview` | Sirve `dist/` con HTTPS en la red local |
| `npm run preview:local` | Sirve `dist/` por HTTP solo en este ordenador (instalación y modo sin conexión) |
| `npm run iconos` | Regenera los iconos PNG a partir del dibujo SVG (usa Edge o Chrome) |

## Estructura

```
src/
  datos/      modelo de datos, StockRepository y LocalRepository (Dexie), ajustes del móvil, datos de ejemplo
  dominio/    reglas de stock, códigos, formatos de España, ubicaciones y resumen (funciones puras, con tests)
  app/        arranque, navegación por #/rutas, hooks y aviso de versión nueva
  ui/         tokens de diseño, estilos base, iconos y componentes comunes
  pantallas/  una por pantalla
public/       icono de la app (y en la etapa 3, el modelo de reconocimiento en public/models/)
scripts/      generador de iconos
diseno/       maquetas de referencia
docs/         decisiones tomadas durante el desarrollo
```

Las pantallas solo usan la interfaz `StockRepository`. En la fase 2 (base de datos compartida) se
añadirá otra implementación sin tocarlas.

## Etapas

1. Esqueleto: Vite, PWA, fuentes, tokens, navegación y repositorio local con datos de ejemplo. **Hecha.**
2. Pantallas Stock, Ficha, Catálogo/alta y Entrada, con la lógica de stock y sus tests.
3. Cámara y reconocimiento: fotos de referencia, retirada con foto y modo diagnóstico.
4. A pedir, avisos, compartir lista y copia de seguridad.
5. Pulido visual, accesibilidad y prueba en móvil real.
