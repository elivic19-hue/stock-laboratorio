# Stock del laboratorio

App móvil (PWA instalable) para controlar el stock de reactivos y material fungible del laboratorio.
Restar stock con una foto que se reconoce en el propio móvil, sumar a mano al recibir pedidos y avisos
cuando un producto llega a su mínimo. Funciona sin conexión y no tiene ningún coste.

La especificación completa está en [CLAUDE.md](CLAUDE.md); las maquetas, en [diseno/](diseno/), y las
decisiones tomadas por el camino, en [docs/decisiones.md](docs/decisiones.md).

**Estado:** etapa 4 de 5 (A pedir, avisos, compartir lista y copia de seguridad). Los datos se guardan en el móvil y, si se conecta al laboratorio
(fase 2, con Firebase), se comparten con los demás móviles y el ordenador.

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
3. **Aprender de las retiradas** (desactivado por defecto, en Ajustes → Reconocimiento). Si se
   activa, al confirmar una retirada se ofrece guardar su foto como referencia del producto. En la
   galería de la ficha esas fotos salen marcadas «Retirada» y se pueden borrar de golpe.
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

## Corregir errores

- **Un movimiento mal apuntado** (una entrada con la cantidad equivocada…): en la ficha del producto,
  «Anular» en el último movimiento. Se borra y el stock vuelve a como estaba. Solo el último, porque
  el stock de los siguientes depende de él; para lo demás, «Ajustar stock».
- **Un producto dado de alta por error:** en su ficha, «Eliminar producto». Se borra con todo lo suyo
  (movimientos, fotos y pedidos) y no se puede deshacer. Si el producto existió y ya no se usa, mejor
  «Archivar producto», que conserva su historial.
- **Una foto de referencia mala:** tócala en la galería de la ficha y «Borrar foto».

## Compartir el stock entre móviles

Sin conectar, cada móvil tiene sus propios datos. Conectando todos los móviles (y el navegador del
ordenador) a la misma **cuenta del laboratorio**, todos ven el mismo stock. Se usa
[Firebase](https://firebase.google.com) de Google, en su plan gratuito (Spark): no pide tarjeta y da
de sobra para un laboratorio (50.000 lecturas y 20.000 escrituras al día, 1 GB).

Cómo funciona:

- Cada móvil sigue guardando todo en él: la app funciona igual **sin conexión**. Los cambios hechos
  sin red se mandan solos al volver, y los de los demás llegan al momento.
- El stock de cada producto es la suma de sus movimientos. Si dos personas retiran a la vez desde
  dos móviles (incluso sin conexión), al sincronizar se restan las dos.
- La cabecera de Stock dice «Sincronizado 10:42», «Sin conexión · 3 por enviar»… y Ajustes da más
  detalle.
- Restaurar una copia de seguridad en un móvil conectado sustituye los datos de **todo** el
  laboratorio. «Borrar todos los datos» desconecta antes el móvil y solo borra lo suyo.

### Preparar el proyecto (una vez, unos 10 minutos)

Hace falta una cuenta de Google (mejor una del laboratorio que una personal).

1. Entra en <https://console.firebase.google.com> → **Crear un proyecto** → nombre, por ejemplo,
   `stock-laboratorio`. Google Analytics no hace falta.
2. **Firestore Database** (en *Compilación*) → **Crear base de datos** → ubicación en Europa
   (`europe-southwest1`, Madrid, o `eur3`) → **modo de producción**.
3. En Firestore, pestaña **Reglas**, sustituye lo que hay por esto y pulsa **Publicar**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Cada laboratorio solo puede leer y escribir lo suyo.
       match /laboratorios/{laboratorio}/{documento=**} {
         allow read, write: if request.auth != null && request.auth.uid == laboratorio;
       }
     }
   }
   ```
4. **Authentication** → **Comenzar** → **Correo electrónico/contraseña** → habilítalo (solo la primera
   opción) → **Guardar**.
5. En Authentication → **Usuarios** → **Agregar usuario**: el correo y la contraseña que usarán todos
   los móviles del laboratorio (el correo no tiene que existir de verdad, p. ej.
   `stock@lab-caracterizacion.es`; la contraseña, larga).
6. En Authentication → **Configuración** → **Acciones del usuario**, desmarca **Habilitar la creación
   de cuentas**, para que nadie más pueda crearse cuentas en el proyecto.
7. **Configuración del proyecto** (la rueda) → **Tus apps** → icono web `</>` → un nombre (sin
   Hosting) → copia el bloque `const firebaseConfig = { … }`. No es secreto: lo que protege los datos
   son las reglas y la contraseña.

### Conectar los móviles

- En cada móvil: Ajustes → **Compartir con el laboratorio** → pega la configuración, escribe el correo
  y la contraseña → **Conectar**.
- El **primer** móvil que se conecta sube sus datos al laboratorio. Los siguientes se quedan con los
  del laboratorio (si tenían datos propios, la app avisa antes de sustituirlos).
- Si se pone la configuración en `src/datos/sincronizacion/configuracion.ts` y se publica la app, los
  móviles solo tienen que escribir el correo y la contraseña.
- Para dejar de compartir en un móvil: Ajustes → **Desconectar este móvil** (sus datos se quedan en él
  como copia).

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
  datos/      modelo de datos, StockRepository y LocalRepository (Dexie), ajustes del móvil, datos de ejemplo,
              copia de seguridad y sincronizacion/ (Firebase: motor, conexión y configuración)
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

Las pantallas solo usan la interfaz `StockRepository`, que siempre lee y escribe en el móvil. La fase 2
(compartir entre móviles) se ha hecho por debajo, sincronizando la base de datos del móvil con
Firestore, sin tocar las pantallas. Para pasar después a la nube de la empresa basta con otra
implementación de `AlmacenRemoto` (`src/datos/sincronizacion/remoto.ts`).

## Etapas

1. Esqueleto: Vite, PWA, fuentes, tokens, navegación y repositorio local con datos de ejemplo. **Hecha.**
2. Pantallas Stock, Ficha, Catálogo/alta y Entrada, con la lógica de stock y sus tests (más Caducidades). **Hecha.**
3. Cámara y reconocimiento: fotos de referencia, retirada con foto y modo diagnóstico. **Hecha.**
4. A pedir, avisos, compartir lista y copia de seguridad. **Hecha.**
5. Pulido visual, accesibilidad y prueba en móvil real.
