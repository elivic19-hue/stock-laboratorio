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
| 8. % de confianza con softmax: las alternativas salen bajas (no 71 % / 38 % como en la maqueta). | Se propone mantener el softmax (§5). |
| 9. Cantidad por retirada (p. ej. bolsa de 100 tapones). | Se propone poder teclear la cantidad y un campo opcional «cantidad por retirada». |
| 10. Fotos: la ficha muestra «n / 10» y el máximo es 20. | El repositorio ya aplica el máximo de 20; la galería se decide en la etapa 3. |
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

