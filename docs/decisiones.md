# Decisiones tomadas

Registro de lo acordado durante el desarrollo que no está en [CLAUDE.md](../CLAUDE.md).
Si algo de aquí contradice CLAUDE.md, manda CLAUDE.md y hay que preguntar.

## Etapa 1 (19/11/2026)

### Entorno

- Node.js 26.13.1 LTS instalado desde el ZIP oficial de nodejs.org (con su firma SHA-256 comprobada),
  solo para el usuario, en `%LOCALAPPDATA%\Programs\nodejs`. El instalador normal pide permisos de
  administrador y el equipo no los concede. Git 2.56 también se instaló solo para el usuario (winget).
- El proyecto está en `%USERPROFILE%\dev\stock-laboratorio`, fuera de OneDrive.

### Dependencias aprobadas que no están en §3

- `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` y `@types/node`: vienen en la plantilla
  oficial de Vite.
- Oxlint: el linter que trae ahora la plantilla oficial. Se aprobó «el linter de la plantilla», que se
  esperaba que fuera ESLint; Oxlint cumple la misma función con una sola dependencia de desarrollo.
- `fake-indexeddb`: solo para los tests del repositorio.
- No se usan librerías de navegación, iconos, fechas ni UUID: router propio por `#/rutas`, iconos SVG
  de las maquetas, `Intl` en español y `crypto` para los UUID.

### Móviles y despliegue

- La mayoría de móviles son Android y hay un iPhone: todo tiene que funcionar en los dos. En iPhone, el
  primer arranque avisa de que hay que instalar la app antes de meter datos (sus datos van aparte de
  Safari).
- Despliegue en GitHub Pages con repositorio público (de momento). Flujo en
  `.github/workflows/desplegar.yml`.

### Cómo se interpretan las maquetas

- Barra inferior solo en Stock, A pedir y Catálogo. Retirar, Entrada, Ficha, Alta y Ajustes van a
  pantalla completa, con Volver o Cerrar.
- Cabecera de Stock en la fase 1: «GUARDADO EN ESTE MÓVIL» en lugar de «SINCRONIZADO 08:12».
- Fechas: formatos cortos de las maquetas en las listas («hoy 08:12», «12 nov», «pedido 14 nov»);
  dd/mm/aaaa en formularios, ficha y exportaciones.
- Línea secundaria de la lista de Stock: «últ. mov.» si el último movimiento es de hoy; si no, la
  caducidad si está cerca; si no, la balda (así sale en la maqueta).
- Título de cada grupo de la lista: solo el armario («ARMARIO 2»); el modelo no tiene descripción de
  armario.
- Marco del visor cuadrado, como pide §5 (en la maqueta es rectangular).
- Ficha: se añaden el código y el usuario de cada movimiento. La frase «Las fotos que haga cualquier
  compañero sirven para todos» se deja para la fase 2.
- Datos de ejemplo: los 9 productos que salen en las maquetas, con un historial coherente con ellas.
- Nombres del código y comentarios en español, como el modelo de §4.
- Las pantallas sin maqueta siguen el mismo lenguaje visual y se enseñan en su etapa.
- Los campos de texto usan 16 px (la maqueta usa 15 px) para que el iPhone no haga zoom al escribir.
- Los errores de formulario se marcan con borde oscuro y texto, nunca en naranja (reservado a
  «bajo mínimo»).

### Pendientes de decidir en su etapa

| Duda | Qué hay ahora |
| --- | --- |
| ¿El móvil de prueba lo usará una persona o varias? | Sin respuesta: un usuario por móvil, que se cambia en Ajustes. |

## Etapa 2 (19/11/2026)

- Etapa 1 aprobada sin cambios.
- **Duda 7 (resuelta): la caducidad se apunta como mes/año** («03 / 2029»), como viene en las
  etiquetas. Se guarda como el último día de ese mes (2029-03-31): el producto vale hasta final de
  mes y el campo sigue siendo una fecha normal para «Caducan <30 d» y para la fase 2. Se aceptan
  «3/29», «03-2029» o «032029», y avisa (sin bloquear) si la fecha ya ha pasado.
- Datos de ejemplo: la caducidad del isooctano pasa a ser fin del mes en curso, para que siga
  contando en «Caducan <30 d» con fechas por mes.

### Stock y Catálogo

- Buscador por nombre, código, formato o ubicación, sin distinguir tildes ni mayúsculas; vale con
  formas abreviadas («arm. 2», «b3»). Todas las palabras tienen que aparecer.
- Botón de filtros: «solo bajo mínimo», «solo caducan <30 d» y orden dentro de cada armario (nombre,
  código o más urgentes primero). Cuando hay filtros, se dice con texto encima de la lista.
- Los contadores del control segmentado cuentan lo que queda tras buscar y filtrar.
- Armarios en orden alfabético natural (1, 2, 10…); se juntan los escritos con distinta mayúscula.
- Búsqueda, filtros y pestaña se recuerdan mientras la app está abierta, y al volver de una ficha
  se recupera la posición de la lista.
- La insignia «BAJO MÍN.» sale aunque el producto ya esté pedido (es el estado del stock); la celda
  «Bajo mínimo» y el contador siguen contando solo lo pendiente de pedir (duda 6).
- Catálogo: por código, con stock y número de fotos de referencia («0 FOTOS» subrayado, nunca en
  naranja). Los archivados van aparte («En uso / Archivados»).

### Ficha, alta y edición

- Rejilla de la maqueta (Stock, Avisar con, Unidad = formato, Ubicación) más una fila «Pedir /
  Pedido en curso» si el producto tiene cantidad sugerida o pedido.
- Botones «Registrar entrada» (con el producto ya elegido) y «Ajustar stock»: se escribe el stock
  real y un motivo obligatorio, que queda como nota del movimiento `ajuste`.
- Historial: cantidad, tipo, quién (y confianza, lote, caducidad o nota), cuándo y cuánto quedó.
  Se ven 15 y un botón para ver todos. «Entrada · pedido» si esa entrada cerró un pedido.
- Archivar pide confirmación y se puede deshacer; un producto archivado se recupera desde su ficha.
- Formulario de alta y edición sin maqueta, en el lenguaje de «Registrar entrada». El código se
  deja vacío para que se asigne solo (se dice cuál será). Armario y unidad sugieren los ya usados.
- Hasta la etapa 3, el alta termina en la ficha (con aviso de que faltan las fotos); en la etapa 3
  pasará directamente a hacerlas.
- En la galería, el botón de añadir fotos está desactivado hasta la etapa 3.

### Entrada

- Cantidad por defecto: la del pedido en curso si lo hay; si no, 1. El número se puede escribir
  (admite decimales con coma) además de usar −/+.
- La nota azul explica qué pasará al guardar: el pedido pasa a recibido, el producto sale de «A
  pedir» o sigue bajo mínimo.
- Tras guardar se vuelve a la pantalla anterior con un aviso «Entrada guardada… Deshacer» durante
  6 s. Lo mismo al ajustar stock y al archivar.

### Lotes caducados (duda 7b, resuelta)

- **No se estima qué lotes quedan.** Como las retiradas no dicen de qué lote salen, todo lote
  caducado de un producto con stock cuenta como caducado hasta que alguien lo marque:
  - «Desechar»: se indican las unidades y se restan con un ajuste «Caducado · lote …», en la misma
    transacción.
  - «Ya no queda»: solo se marca, sin tocar el stock.
  Las dos cosas se pueden deshacer. «Ya no queda» también vale para los lotes que caducan en menos
  de 30 días. Un lote marcado deja de contar en las dos listas.
- Un lote caduca al terminar su mes: el día 30/11 aún vale; el 01/12, ya no.
- Modelo: las entradas guardan el cierre en un campo opcional `loteCerrado` (cómo, quién, cuándo y
  el ajuste que restó lo desechado). Es un añadido a §4 compatible con la fase 2.
- **Pantalla «Caducidades»** (sin maqueta), fuera de la barra inferior: secciones «Caducados» y
  «Caducan en menos de 30 días», con lote, caducidad, fecha de entrada y stock del producto.
- **Alarmas**, en tinta (el naranja sigue siendo solo para «bajo mínimo») y siempre con texto:
  - Celda del resumen: si hay caducados pasa a «CADUCADOS n» en negro; si no, «CADUCAN <30 D n».
    Las dos llevan a Caducidades.
  - Banda negra en Stock mientras haya algo caducado: «n lotes caducados con stock en el armario ·
    Ver».
  - Insignia «CADUCADO» en la fila de Stock y en la ficha, más una banda en la ficha con los lotes.
  - El historial de la ficha dice si un lote se desechó o se agotó, y quién lo hizo.
  - **Pendiente para la etapa 4:** notificación del móvil una vez al día si hay lotes caducados,
    junto con el resto de avisos.
- El filtro de Stock pasa a ser «Caducados o caducan en menos de 30 días».
- Datos de ejemplo: el ácido acético (R-031) tiene un lote caducado el mes pasado.

## Etapa 3 (19/11/2026)

### Modelo

- `@tensorflow/tfjs` 4.22 y `@tensorflow-models/mobilenet` 2.1.1 (§3). MobileNet v2 1.0 a 224 px de
  TF Hub (`google/imagenet/mobilenet_v2_100_224/classification/2`, Apache 2.0), con los pesos en
  `public/models/` (14 MB, precargados por el service worker). `npm run modelo` los vuelve a bajar.
- TensorFlow.js se importa bajo demanda: no retrasa el arranque de la app. El modelo se empieza a
  cargar al abrir la app, cuando el navegador está libre, y se calienta con una inferencia vacía.
- Embedding: `infer(img, true)` y normalización L2 propia (MobileNet no lo normaliza).

### Reconocimiento

- Puntuación del producto: media de sus 3 mejores similitudes coseno (§5). % de confianza: softmax
  con la temperatura de Ajustes (0,05 por defecto).
- «No estoy seguro» si la mejor puntuación no llega al umbral (0,6 por defecto) **o** si el segundo
  está a menos de 0,03 del primero. Ese margen es fijo; si hace falta, se puede llevar a Ajustes.
- Prueba en el ordenador con una cámara simulada y productos dibujados (6 fotos de referencia de 3
  productos): acierta los dos productos conocidos con fotos nuevas (puntuación 0,95 y 0,91, frente a
  0,38 y 0,65 del segundo) y duda con un objeto desconocido (0,45). Unos 30 ms por foto. Falta
  calibrar con los productos reales en el móvil (etapa 5).

### Pantallas

- Visor: vídeo a pantalla completa con el marco cuadrado; fuera del marco se oscurece. Linterna solo
  si el móvil la ofrece. Si no hay cámara o permiso, se explica por qué y se puede elegir una foto de
  la galería (se usa el cuadrado central).
- Retirar: tras la foto, el visor se encoge con la foto fija en el marco y aparece la hoja de la
  maqueta. «¿No es este?» enseña las 2 alternativas siguientes; al elegir una, la retirada sigue
  siendo «foto» con su %. «Buscar a mano» (también desde el visor, sin foto) registra una
  `retirada_manual`. La cantidad no puede pasar del stock.
- Tras confirmar se vuelve a la pantalla anterior con «Deshacer», que también borra la foto guardada
  como referencia. Si la retirada deja el producto en su mínimo, el aviso lo dice y dura más (la
  notificación del móvil llega en la etapa 4).
- La foto se ofrece como referencia siempre que se haya hecho foto (casilla marcada según Ajustes):
  cuando el reconocimiento acierta y también cuando se corrige (ver duda 11).
- **Duda 10 (resuelta):** el contador cuenta sobre 10 (lo recomendado) hasta llegar a 10 y después
  sobre 20 (el máximo). Al tocar una foto de la galería se ve en grande y se puede borrar.
- Fotos de referencia: visor con el contador «6 / 10», la última foto hecha y «Listo». Indica qué
  hacer en cada momento («cambia de ángulo y de luz…»). Las fotos guardadas al retirar dejan sitio a
  las nuevas; con 20 hechas a propósito, no se pueden hacer más.
- Ajustes → Reconocimiento: estado del modelo (GPU o no, tiempo de carga), umbral, temperatura,
  «Aprender de las retiradas», modo diagnóstico y volver a los valores iniciales.

### Dudas 8, 9 y 11 y el margen (resueltas a criterio de Claude, 19/11/2026)

El usuario lo dejó a mi criterio («haz lo que creas que es mejor»).

- **Duda 8 (% de las alternativas):** se mantiene el softmax de §5 para todos los porcentajes, para
  que el número signifique lo mismo en todas partes. Si dos productos se parecen de verdad, las
  alternativas salen con % apreciables; si no, que salgan bajas es información útil. Por debajo del
  1 % se enseña «<1 %» en vez de «0 %». La puntuación bruta sigue en el modo diagnóstico.
- **Duda 9 (cantidad por retirada):** no se añade el campo. La cantidad empieza en 1, como dice §7,
  y se puede teclear. Se recomienda que la unidad corta sea lo que se coge del armario (una bolsa,
  un rack), no lo que hay dentro.
- **Duda 11 (foto al corregir):** sí se ofrece guardarla, también al elegir «¿No es este?», una
  alternativa de «No estoy seguro» o un producto buscado a mano después de la foto. La persona ha
  dicho explícitamente qué producto es, así que la etiqueta es tan fiable como al acertar, y son
  justo los casos que el reconocimiento aún no distingue. Se amplía así §5.6. El límite de 20 y el
  descarte de la más antigua de origen `confirmacion` siguen igual, y «Deshacer» la borra.
- **Margen de duda (0,03):** se queda fijo, sin llevarlo a Ajustes: con umbral y temperatura basta
  para calibrar, y el modo diagnóstico enseña las puntuaciones para revisarlo con productos reales
  en la etapa 5.

## Etapa 4 (19/11/2026)

### A pedir

- **Duda 6 (resuelta):** al «Marcar pedido» el producto sale de la lista y de los contadores (celda
  «Bajo mínimo», barra e icono) y pasa a «Pedidos en curso» hasta que se registra su entrada. En
  Stock sigue saliendo como «BAJO MÍN.», porque lo está.
- Orden: lo más urgente primero (menos stock en proporción a su mínimo). La tarjeta de la maqueta
  lleva además el código delante de la ubicación.
- «Marcar pedido» es un toque, con la cantidad sugerida del producto y «Deshacer». Al tocar un pedido
  en curso se abre una hoja con fecha, cantidad y stock, «Registrar entrada» (con el producto ya
  elegido) y «Anular pedido».
- «Compartir lista» abre una hoja con el texto exacto que se va a mandar (por si se quiere revisar) y
  dos botones: «Compartir» (Web Share, o copiar si no hay) y «CSV» (punto y coma, coma decimal y
  BOM, para que Excel en español lo abra bien). La lista solo lleva lo que hay que pedir, no lo que
  ya está pedido, para no pedirlo dos veces.

### Avisos

- Las notificaciones se activan en Ajustes → Avisos (se pide permiso al activarlas). Además del
  permiso, la app recuerda si se quieren, para poder apagarlas sin ir a los ajustes del navegador.
- Bajo mínimo: tras una retirada que deja el producto en su mínimo o por debajo, si no está ya
  pedido. Una notificación por producto (la siguiente sustituye a la anterior). Al tocarla se abre
  «A pedir». Si ya está pedido, el aviso de la app lo dice («ya está pedido») y no hay notificación.
- **Lotes caducados (duda 7b, la notificación pendiente):** sin servidor no se puede mandar nada a
  una hora fija. Se usa Periodic Background Sync: el service worker (`public/sw-avisos.js`, añadido
  al de vite-plugin-pwa con `importScripts`, sin dependencias nuevas) mira la base de datos como
  mucho dos veces al día, también con la app cerrada, y avisa una vez al día como mucho. Solo
  existe en Chrome para Android con la app instalada; en iPhone no hay aviso diario (se ve la banda
  al abrir la app). Ajustes dice en qué caso está el móvil. El service worker repite en pequeño la
  lógica de `lotesCaducados` y `productosAPedir` (anotado en los dos sitios).
- Número en el icono (`setAppBadge`): productos a pedir. Lo pone la app al cambiar los datos y el
  service worker en su revisión diaria.
- Se puede mandar un aviso de prueba desde Ajustes.

### Copia de seguridad

- JSON con `formato` y `version` (1), fecha, productos, movimientos, pedidos y fotos (embedding y
  miniatura en base64). Lleva también el nombre del laboratorio, el umbral y la temperatura; el
  usuario no, porque es de cada móvil.
- «Descargar copia» y, si el móvil puede compartir archivos, «Enviar copia». Se guarda la fecha de la
  última copia y Ajustes la enseña.
- Restaurar comprueba todo el archivo antes de tocar nada (tipos, que cada movimiento, foto y pedido
  sea de un producto que está, que no haya repetidos) y dice qué falla. Antes de sustituir enseña
  qué trae la copia y qué hay ahora en el móvil.
- Propuesta para la etapa 5: recordar en Stock que hace tiempo que no se guarda una copia.
