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
| 6. ¿Al «Marcar pedido» sale el producto de la lista y de los contadores? | Provisional: sí. Los contadores (celda «Bajo mínimo», barra y, más adelante, el icono) cuentan lo pendiente de pedir. |
| 8. % de confianza con softmax: las alternativas salen muy bajas (0–2 %, no 71 % / 38 % como en la maqueta). | Se mantiene el softmax de §5. Si prefieres que las alternativas se vean «comparables», se puede enseñar la puntuación bruta en los botones. |
| 9. Cantidad por retirada (p. ej. bolsa de 100 tapones). | La cantidad se puede teclear (y −/+). Falta decidir el campo opcional «cantidad por retirada» por producto. |
| 11. ¿Guardar como referencia la foto cuando el usuario corrige el producto («¿No es este?»)? | §5 dice solo con buena confianza, así que ahora no se ofrece. Esas fotos serían de las más útiles para aprender. |
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
- La foto se ofrece como referencia solo si el reconocimiento estaba seguro de ese mismo producto
  (casilla marcada según Ajustes).
- **Duda 10 (resuelta):** el contador cuenta sobre 10 (lo recomendado) hasta llegar a 10 y después
  sobre 20 (el máximo). Al tocar una foto de la galería se ve en grande y se puede borrar.
- Fotos de referencia: visor con el contador «6 / 10», la última foto hecha y «Listo». Indica qué
  hacer en cada momento («cambia de ángulo y de luz…»). Las fotos guardadas al retirar dejan sitio a
  las nuevas; con 20 hechas a propósito, no se pueden hacer más.
- Ajustes → Reconocimiento: estado del modelo (GPU o no, tiempo de carga), umbral, temperatura,
  «Aprender de las retiradas», modo diagnóstico y volver a los valores iniciales.

