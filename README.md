# Stock del laboratorio

App móvil (PWA instalable) para controlar el stock de reactivos y material fungible del laboratorio.
Restar stock con una foto que se reconoce en el propio móvil, sumar a mano al recibir pedidos y avisos
cuando un producto llega a su mínimo. Funciona sin conexión y no tiene ningún coste.

La especificación completa está en [CLAUDE.md](CLAUDE.md); las maquetas, en [diseno/](diseno/), y las
decisiones tomadas por el camino, en [docs/decisiones.md](docs/decisiones.md).

**Estado:** etapa 5 de 5 en curso: falta la prueba en móviles reales
([docs/prueba-en-movil.md](docs/prueba-en-movil.md)) y calibrar el reconocimiento. Cada persona entra
con su cuenta y elige laboratorio (**Lab. Cromatografía** o **Lab. Food Contact**, cada uno con su
propio stock). Los datos se guardan en el móvil y se comparten con los demás móviles y el ordenador
(fase 2, con Firebase).

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
  **Importante:** en iPhone, la app instalada guarda sus datos y la sesión aparte de Safari.
  Instálala antes de entrar y úsala siempre desde su icono.

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
5. **Si siempre sale el mismo producto** (o reconoce mal), en Ajustes:
   - *Reconocimiento* dice si el móvil ha pasado la **autoprueba**: al cargar el modelo se calculan
     unas imágenes de prueba y se comparan con el resultado correcto. Si la tarjeta gráfica del móvil
     calcula mal, la app pasa sola al procesador (más lento, pero correcto) y lo dice.
   - *Fotos de referencia* → **Revisar fotos**: dice qué productos no tienen fotos (no se pueden
     reconocer), cuáles tienen fotos negras o casi idénticas a las de otro producto y cuáles se
     confunden entre sí. Cada fila lleva a la ficha del producto.
   - **Recalcular vectores**: vuelve a calcular con ese móvil el vector de cada foto a partir de su
     miniatura (las fotos no cambian y el cambio llega a todos los móviles). Sirve cuando la revisión
     encuentra fotos casi idénticas entre productos distintos o las hizo un móvil que calculaba mal.

Con un solo producto con fotos, la app no propone nada como seguro («No estoy seguro»): no tiene con
qué compararlo y cualquier foto se le parecería. Tras cada foto, la hoja dice qué productos no se
pueden reconocer por no tener fotos. Las fotos negras o sin detalle se rechazan al hacerlas.

Las fotos se guardan con la resolución del marco (hasta 640 px) y el modelo usa su versión de
224×224. Las hechas antes del 20/11/2026 se guardaron a 160 o 224 px y se ven borrosas al
ampliarlas: para verlas bien, repítelas. En modo diagnóstico, Retirar enseña la resolución de la
cámara y el tamaño de la foto.

Los pesos del modelo (14 MB) están en `public/models/` y la app los guarda para funcionar sin
conexión desde la primera vez. Para volver a descargarlos: `npm run modelo`. Si cambian el modelo o
las imágenes de prueba (`src/reconocimiento/patrones.ts`), hay que regenerar los vectores correctos de
la autoprueba con `npm run autoprueba` (un test lo comprueba con el modelo de verdad).

## Lotes y caducidades

- Al **dar de alta** un producto se pueden poner el lote y la caducidad (mes/año) de lo que hay en el
  armario. Al **registrar una entrada**, lo mismo para lo que llega.
- **Lotes de la ficha:** cada lote en uso en su línea, en el orden en que toca gastarlos (lo que
  caduca antes, primero), con lo que queda, su caducidad y «Archivar» para cuando se termine. Los
  archivados van juntos en una sola línea que se despliega (con «Desarchivar»).
- **Retirar de un lote:** si el producto tiene lotes en uso, al retirar se elige de cuál sale. La app
  lee el número de lote impreso en la etiqueta de la foto (y el código de barras, si lo lleva) y lo
  marca; si no lo lee o hay dudas entre dos parecidos, propone el que caduca antes. Se cambia con un
  toque o se elige «Sin lote». Cuando una retirada deja un lote a cero, se archiva solo («Deshacer» lo
  vuelve a abrir).
- «Quedan» de cada lote cuenta las retiradas que dicen su lote; las que no lo dicen solo restan del
  stock del producto.
- **Caducidades** (desde el resumen de Stock) reúne los lotes caducados y los que caducan en menos de
  30 días, para desecharlos o marcar que ya no queda.

Para leer el lote, la app usa Tesseract.js en el propio móvil y sin conexión: el lector y su modelo
de texto (unos 6 MB) están en `public/ocr/` (`npm run ocr` los vuelve a preparar). Lee mejor con la
etiqueta de cerca, enfocada y con luz. En modo diagnóstico, Retirar enseña el texto leído.

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

## Cuentas y laboratorios

La app abre pidiendo el **correo y la contraseña** de la persona. Después pregunta qué laboratorio
quiere ver: **Lab. Cromatografía** o **Lab. Food Contact**. Cada laboratorio tiene su propio stock
(productos, códigos R-001/F-001, movimientos, pedidos y fotos), totalmente separado del otro. Cada
cuenta recuerda su laboratorio en cada móvil; se cambia en Ajustes → Cuenta y laboratorio →
**Cambiar de laboratorio**. Los movimientos se firman con lo que va antes de la @ del correo; se puede
cambiar en Ajustes → Perfil.

Todos los móviles (y el navegador del ordenador) ven el mismo stock de cada laboratorio. Se usa
[Firebase](https://firebase.google.com) de Google, en su plan gratuito (Spark): no pide tarjeta y da
de sobra para un laboratorio (50.000 lecturas y 20.000 escrituras al día, 1 GB).

Cómo funciona:

- Solo hace falta conexión para entrar la primera vez. Después, cada móvil guarda todo en él y la app
  funciona igual **sin conexión**: los cambios hechos sin red se mandan solos al volver, y los de los
  demás llegan al momento.
- El stock de cada producto es la suma de sus movimientos. Si dos personas retiran a la vez desde
  dos móviles (incluso sin conexión), al sincronizar se restan las dos.
- La cabecera de Stock dice «Sincronizado 10:42», «Sin conexión · 3 por enviar»… y Ajustes da más
  detalle.
- Restaurar una copia de seguridad sustituye el stock de ese laboratorio en **todos** los móviles.
  «Borrar los datos de este móvil» solo borra la copia del móvil (de los dos laboratorios) y cierra la
  sesión; la nube no se toca.
- **Dar acceso a alguien:** crear su usuario en Firebase → Authentication → Usuarios → Agregar
  usuario (el correo no tiene que existir de verdad). **Quitárselo:** deshabilitar o borrar su usuario.
  Cualquier cuenta puede ver los dos laboratorios; cada persona elige cuál.

El proyecto del laboratorio ya está creado (`stock-laboratorio-5abeb`, con la base de datos en Madrid)
y su configuración está en `src/datos/sincronizacion/configuracion.ts`. Las reglas están en
`firestore.rules`; para volver a publicarlas: `npx firebase-tools deploy --only firestore:rules`.
Los pasos siguientes son para montar otro proyecto desde cero.

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
       match /laboratorios/{laboratorio}/{documento=**} {
         allow read, write: if request.auth != null
           && request.auth.token.firebase.sign_in_provider == 'password';
       }
     }
   }
   ```
4. **Authentication** → **Comenzar** → **Correo electrónico/contraseña** → habilítalo (solo la primera
   opción) → **Guardar**.
5. En Authentication → **Usuarios** → **Agregar usuario**: una cuenta (correo y contraseña) por cada
   persona del laboratorio. El correo no tiene que existir de verdad.
6. **Imprescindible:** en Authentication → **Configuración** → **Acciones del usuario**, desmarca
   **Habilitar la creación (registro)**. Todas las cuentas del proyecto entran al laboratorio, así
   que solo deben existir las que se crean aquí.
7. **Configuración del proyecto** (la rueda) → **Tus apps** → icono web `</>` → un nombre (sin
   Hosting) → copia el bloque `const firebaseConfig = { … }` en
   `src/datos/sincronizacion/configuracion.ts` y publica la app. No es secreto: lo que protege los
   datos son las reglas y la contraseña.

## Copias de seguridad

El stock de cada laboratorio está en la nube y en cada móvil, pero una copia de vez en cuando protege
de un borrado por error. Cada copia es de un laboratorio (el que se está viendo).

- **Guardar una copia:** Ajustes → Copia de seguridad → «Descargar copia» (va a Descargas) o «Enviar
  copia» (correo, Drive, WhatsApp…). Es un archivo `stock-laboratorio-AAAA-MM-DD.json` con todo:
  productos, movimientos, pedidos y fotos de referencia (con sus datos de reconocimiento). Ajustes
  enseña la fecha de la última copia. Conviene hacer una cada semana y guardarla fuera del móvil.
- **Restaurar:** «Restaurar una copia…» y elegir el archivo. La app enseña qué contiene y, al
  confirmar, **sustituye** el stock de ese laboratorio en todos los móviles. Si la copia es del otro
  laboratorio, lo avisa. También recupera el umbral y la temperatura; el usuario y el laboratorio no
  cambian.
- La app pide al navegador almacenamiento persistente, para que no borre los datos si falta espacio.
  En Ajustes se ve si lo ha concedido; instalar la app ayuda.
- Además, GitHub guarda **cada día a las 7:00** una copia de los dos laboratorios (abajo).

**Las actualizaciones no borran el stock.** Lo que pasó el 20/11/2026 fue que la versión que separó
Cromatografía y Food Contact dejó de leer el stock de antes (seguía en la nube como «laboratorio
principal»). Ese stock se recupera solo en Cromatografía la primera vez que un móvil la abre con
conexión: se añaden los productos que no estaban, con su historial y fotos; a los que ya estaban con
el mismo nombre solo se les añaden sus fotos (para no sumar el stock dos veces). Sale un aviso con lo
recuperado y no se repite.

### Copia de seguridad diaria en GitHub

El flujo «Copia de seguridad diaria» (`.github/workflows/copia-diaria.yml`) entra cada día a las 7:00
(hora de Madrid) con una cuenta propia, lee el stock de los dos laboratorios y guarda
`cromatografia.json` y `foodcontact.json` en un **repositorio privado**. Cada día queda como un commit,
así que hay copia de cada día. Los archivos tienen el formato de la copia de la app: se restauran con
«Restaurar una copia…». Mientras no se prepare, el flujo no hace nada.

Prepararla (una vez, unos 10 minutos):

1. **Cuenta de copias en Firebase:** Authentication → Usuarios → Añadir usuario, p. ej.
   `copias@stock-laboratorio.app` con una contraseña larga. Solo la usa GitHub.
2. **Repositorio privado:** en GitHub, *New repository* → nombre `stock-laboratorio-copias`,
   **Private**, marcando «Add a README file».
3. **Permiso para escribir en él:** tu foto → Settings → Developer settings → Personal access tokens →
   *Fine-grained tokens* → Generate new token: *Repository access* → solo `stock-laboratorio-copias`;
   *Permissions* → *Contents: Read and write*. La caducidad, la más larga posible (cuando caduque, la
   copia fallará y GitHub avisará por correo: se genera otro y se cambia el secreto).
4. **Secretos:** en el repositorio de la app (`stock-laboratorio`) → Settings → Secrets and variables
   → Actions → *New repository secret*, tres: `COPIAS_CORREO` y `COPIAS_CONTRASENA` (la cuenta del
   paso 1) y `COPIAS_TOKEN` (el del paso 3). Si el repositorio privado se llama distinto, crea además
   la *variable* `COPIAS_REPO` con `usuario/nombre`.
5. **Probarla:** Actions → «Copia de seguridad diaria» → *Run workflow*. Al terminar, el repositorio
   privado tiene los dos archivos y `ultima-copia.txt` con lo que lleva cada uno.

Los registros de GitHub son públicos, así que solo escriben cuántos productos, movimientos… hay, nunca
los datos. GitHub apaga las tareas programadas tras 60 días sin cambios en el repositorio: el propio
flujo lo evita cada día. Si un día falla (p. ej. al caducar el token), GitHub manda un correo.

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
| `npm run autoprueba` | Recalcula con el procesador los vectores correctos de la autoprueba del modelo |
| `npm run ocr` | Prepara en `public/ocr/` el lector de texto de los lotes (Tesseract.js y su modelo) |

## Estructura

```
src/
  datos/      modelo de datos, StockRepository y LocalRepository (Dexie), ajustes del móvil, datos de ejemplo,
              copia de seguridad y sincronizacion/ (Firebase: motor, conexión y configuración)
  dominio/    reglas de stock, códigos, formatos de España, caducidad, búsqueda, listas y formularios
              (funciones puras, con tests)
  app/        arranque, navegación por #/rutas, hooks, avisos («Deshacer», notificaciones, icono) y compartir
  ui/         tokens de diseño, estilos base, iconos y componentes comunes
  reconocimiento/  modelo (con su autoprueba), cámara, recorte del marco, comparación de fotos, revisión
                   de las fotos de referencia y lectura del lote en la etiqueta (con tests)
  pantallas/  una por pantalla
public/       icono de la app, el modelo de reconocimiento (public/models/), el lector de lotes (public/ocr/) y sw-avisos.js
              (avisos del service worker: aviso diario de caducados, número en el icono)
scripts/      generador de iconos, descarga del modelo, vectores de la autoprueba, lector de lotes y copia
              diaria de GitHub (con sus tests)
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
5. Pulido visual, accesibilidad y prueba en móvil real. **En curso:** repaso frente a las maquetas y
   auditoría de accesibilidad hechos; falta la prueba en móviles reales (lista en
   [docs/prueba-en-movil.md](docs/prueba-en-movil.md)).
