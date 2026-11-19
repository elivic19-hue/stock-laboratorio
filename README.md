# Stock del laboratorio

App móvil (PWA instalable) para controlar el stock de reactivos y material fungible del laboratorio.
Restar stock con una foto que se reconoce en el propio móvil, sumar a mano al recibir pedidos y avisos
cuando un producto llega a su mínimo. Funciona sin conexión y no tiene ningún coste.

La especificación completa está en [CLAUDE.md](CLAUDE.md); las maquetas, en [diseno/](diseno/), y las
decisiones tomadas por el camino, en [docs/decisiones.md](docs/decisiones.md).

**Estado:** etapa 4 de 5 (A pedir, avisos, compartir lista y copia de seguridad). Fase 1: todos los datos se guardan solo en el móvil.

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
2. Antes de subir nada, en el repositorio de GitHub:
   **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. En una ventana de PowerShell, desde la carpeta del proyecto:
   ```
   git remote add origin https://github.com/TU-USUARIO/stock-laboratorio.git
   git push -u origin main
   ```
   La primera vez se abre una ventana para iniciar sesión en GitHub.
4. En la pestaña **Actions** del repositorio aparece «Desplegar en GitHub Pages». Cuando termine en
   verde (un par de minutos), la app queda en `https://TU-USUARIO.github.io/stock-laboratorio/`.
   Si falló porque el paso 2 no estaba hecho, hazlo y pulsa **Re-run jobs**.
5. Cada `git push` a `main` pasa los tests y vuelve a publicarla.

## Reconocimiento por foto

Todo ocurre en el móvil, sin internet ni servicios de pago: MobileNet v2 (TensorFlow.js) convierte la
foto en un vector y se compara con las fotos de referencia de cada producto.

1. **Fotos de referencia.** En la ficha de cada producto, «+» en *Fotos de reconocimiento*. Haz entre
   5 y 10, cambiando el ángulo, la distancia y la luz. Al dar de alta un producto se pasa directamente
   a hacerlas.
2. **Retirar.** Botón azul de la cámara → encuadra el producto en el marco → foto. Si la app está
   segura, propone el producto y basta con «Confirmar retirada». Si no, dice «No estoy seguro» y
   enseña las alternativas; también se puede buscar a mano.
3. **Aprende.** Al confirmar una retirada guarda esa foto como referencia del producto confirmado,
   también cuando se ha corregido con «¿No es este?» o a mano (se puede desmarcar cada vez o
   desactivar en Ajustes). Máximo 20 fotos por producto.
4. **Calibrar.** En Ajustes → Reconocimiento, activa el *modo diagnóstico*: tras cada foto se ven las
   puntuaciones de los 5 mejores productos. Si confunde productos, sube el umbral; si duda con
   productos que acierta, bájalo.

Los pesos del modelo (14 MB) están en `public/models/` y la app los guarda para funcionar sin
conexión desde la primera vez. Para volver a descargarlos: `npm run modelo`.

## Avisos y lista para pedir

- **A pedir** enseña lo que está en su mínimo o por debajo, lo más urgente primero. «Marcar pedido» lo
  pasa a *Pedidos en curso* (con «Deshacer»); al registrar su entrada, el pedido queda recibido.
  Tocando un pedido en curso se puede registrar la entrada o anularlo.
- **Compartir lista** enseña el texto que se va a mandar y lo comparte (WhatsApp, Teams, correo…) o,
  si el navegador no puede, lo copia. «CSV» da la misma lista para Excel.
- **Notificaciones:** se activan en Ajustes → Avisos. Llega una cuando una retirada deja un producto
  en su mínimo (si no está ya pedido) y, como mucho una vez al día, si hay lotes caducados.
  - El aviso diario con la app cerrada solo funciona en **Chrome para Android con la app instalada**
    (el móvil decide la hora). En iPhone las notificaciones necesitan la app instalada (iOS 16.4 o
    posterior) y el aviso diario no está disponible: los caducados se ven al abrir la app.
- **Icono:** con la app instalada, el número de productos a pedir aparece en el icono (si el móvil lo
  permite).

## Copias de seguridad

En la fase 1 los datos **solo están en el móvil**. Se pierden si se pierde el móvil, si se borran los
datos del navegador o si se desinstala la app.

- **Guardar una copia:** Ajustes → Copia de seguridad → «Descargar copia» (va a Descargas) o «Enviar
  copia» (correo, Drive, WhatsApp…). Es un archivo `stock-laboratorio-AAAA-MM-DD.json` con todo:
  productos, movimientos, pedidos y fotos de referencia (con sus datos de reconocimiento). Ajustes
  enseña la fecha de la última copia. Conviene hacer una cada semana y guardarla fuera del móvil.
- **Restaurar:** «Restaurar una copia…» y elegir el archivo. La app enseña qué contiene y, al
  confirmar, **sustituye** todos los datos del móvil (también sirve para pasar los datos a otro móvil).
  También recupera el nombre del laboratorio, el umbral y la temperatura; el usuario no cambia.
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
| `npm run modelo` | Vuelve a descargar los pesos de MobileNet v2 a `public/models/` |

## Estructura

```
src/
  datos/      modelo de datos, StockRepository y LocalRepository (Dexie), ajustes del móvil, datos de ejemplo
  dominio/    reglas de stock, códigos, formatos de España, caducidad, búsqueda, listas y formularios
              (funciones puras, con tests)
  app/        arranque, navegación por #/rutas, hooks, avisos («Deshacer», notificaciones, icono) y compartir
  ui/         tokens de diseño, estilos base, iconos y componentes comunes
  reconocimiento/  modelo, cámara, recorte del marco y comparación de fotos (la comparación, con tests)
  pantallas/  una por pantalla
public/       icono de la app, el modelo de reconocimiento (public/models/) y sw-avisos.js
              (avisos del service worker: aviso diario de caducados, número en el icono)
scripts/      generador de iconos y descarga del modelo
diseno/       maquetas de referencia
docs/         decisiones tomadas durante el desarrollo
```

Las pantallas solo usan la interfaz `StockRepository`. En la fase 2 (base de datos compartida) se
añadirá otra implementación sin tocarlas.

## Etapas

1. Esqueleto: Vite, PWA, fuentes, tokens, navegación y repositorio local con datos de ejemplo. **Hecha.**
2. Pantallas Stock, Ficha, Catálogo/alta y Entrada, con la lógica de stock y sus tests (más Caducidades). **Hecha.**
3. Cámara y reconocimiento: fotos de referencia, retirada con foto y modo diagnóstico. **Hecha.**
4. A pedir, avisos, compartir lista y copia de seguridad. **Hecha.**
5. Pulido visual, accesibilidad y prueba en móvil real.
