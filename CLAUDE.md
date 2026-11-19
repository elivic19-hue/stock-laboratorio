> Lee también [docs/decisiones.md](docs/decisiones.md): recoge lo acordado durante el desarrollo que no está aquí.

# Stock del laboratorio — especificación del proyecto

Este archivo es la referencia permanente del proyecto. Léelo entero antes de cada sesión de trabajo y respétalo. Si algo de aquí entra en conflicto con lo que te pida en el chat, pregúntame antes de decidir.

## 1. Qué es

App móvil (PWA instalable) para controlar el stock de reactivos y material fungible (puntas de pipeta, tapones, viales, guantes…) de un laboratorio de ensayos.

- **Restar stock:** el usuario hace una foto al producto cuando lo coge del armario o se acaba. La app reconoce el producto **en el propio móvil** (sin internet ni APIs de pago), propone el producto y la cantidad, y el usuario confirma con un toque.
- **Sumar stock:** se hace **a mano**, cuando llega un pedido: se elige el producto y se indican las unidades recibidas, más lote y caducidad opcionales.
- **Avisos:** cada producto tiene un stock mínimo. Al llegar a ese mínimo o bajar de él, el producto aparece en la lista «A pedir» y se avisa.
- Idioma de la interfaz: **español de España**. Números con coma decimal (`2,5 L`), fechas `dd/mm/aaaa`.

### Requisito clave: coste cero
- Nada de APIs de IA de pago ni servicios con coste por uso.
- El reconocimiento de imágenes se hace con un modelo que corre en el navegador (TensorFlow.js + MobileNet) y funciona sin conexión.

## 2. Fases

**Fase 1 (lo que construimos ahora):** la app completa funcionando en **un solo móvil**, con los datos guardados en local (IndexedDB). Sirve para validar que el reconocimiento distingue bien nuestros productos reales.

**Fase 2 (NO construir todavía):** base de datos compartida para que varias personas del mismo laboratorio vean el mismo stock. Primero en un servicio gratuito (Supabase o Firebase) y después en la nube de la empresa. Por eso, desde el principio:
- Todo acceso a datos pasa por una interfaz `StockRepository` (productos, fotos de referencia, movimientos, pedidos). En fase 1 solo existe `LocalRepository` (Dexie/IndexedDB). En fase 2 se añadirá otra implementación sin tocar las pantallas.
- Cada movimiento guarda quién lo hizo (ver §4) y usa IDs tipo UUID, no autoincrementales, para poder fusionar datos más adelante.

## 3. Stack técnico

- **Vite + React + TypeScript** (estricto).
- **Dexie** para IndexedDB.
- **vite-plugin-pwa**: instalable, funciona offline y cachea todo, incluido el modelo.
- **@tensorflow/tfjs + @tensorflow-models/mobilenet (v2)**, usado solo como extractor de características (embeddings). Los pesos del modelo se sirven **desde la propia app** (carpeta `public/models/`), no desde un CDN, para que funcione sin conexión desde la primera instalación.
- Fuentes **IBM Plex Sans** e **IBM Plex Mono** autoalojadas con `@fontsource` (nada de Google Fonts en tiempo de ejecución).
- CSS propio con variables (tokens de §6). **No usar librerías de componentes** (MUI, shadcn, Chakra, Bootstrap…): el aspecto tiene que ser el del diseño, no el de un kit genérico.
- Tests con **Vitest** para la lógica de stock y la de reconocimiento.

## 4. Modelo de datos

```ts
type Categoria = 'reactivo' | 'fungible';

interface Producto {
  id: string;              // uuid
  codigo: string;          // automático: R-001… para reactivos, F-001… para fungible; editable
  nombre: string;          // "Puntas de pipeta 1000 µL"
  categoria: Categoria;
  formato: string;         // "Rack 96 uds", "Botella 1 L", "Bolsa 100 uds"
  unidadCorta: string;     // "racks", "bot.", "uds", "bid."
  armario: string;         // "Armario 2", "Armario inflamables"
  balda?: string;          // "Balda 3"
  stockActual: number;
  stockMinimo: number;     // avisar cuando stockActual <= stockMinimo
  cantidadPedidoSugerida?: number;
  notas?: string;
  archivado: boolean;
  creadoEn: string; actualizadoEn: string;
}

interface FotoReferencia {
  id: string;
  productoId: string;
  embedding: number[];     // vector normalizado (L2) de MobileNet
  miniatura: Blob;         // JPEG ~160 px para la galería
  origen: 'alta' | 'confirmacion';  // hecha a propósito o guardada al confirmar una retirada
  creadoEn: string;
}

type TipoMovimiento = 'retirada_foto' | 'retirada_manual' | 'entrada' | 'ajuste';

interface Movimiento {
  id: string;
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number;        // negativa en retiradas, positiva en entradas
  stockResultante: number;
  lote?: string; caducidad?: string; nota?: string;
  confianza?: number;      // solo en retirada_foto
  usuario: string;         // nombre o iniciales elegidos al abrir la app por primera vez
  fecha: string;           // ISO
}

interface Pedido {         // para la sección «Pedidos en curso»
  id: string; productoId: string; cantidad?: number;
  estado: 'pedido' | 'recibido'; fechaPedido: string; fechaRecepcion?: string;
}
```

- Cada cambio de stock se hace en **una transacción**: se actualiza `stockActual` y se crea el `Movimiento`. El stock nunca puede quedar negativo (avisar y no permitirlo).
- La caducidad se guarda por entrada (lote). El resumen «Caducan <30 d» cuenta las entradas con caducidad en los próximos 30 días cuyo producto aún tiene stock.
- Al registrar una entrada de un producto que estaba «pedido», el pedido pasa a `recibido`.

## 5. Reconocimiento por foto (en el móvil)

1. **Captura.** Cámara trasera (`getUserMedia`, `facingMode: 'environment'`) con un visor que muestra un marco cuadrado. Se recorta solo lo que hay dentro del marco y se redimensiona a 224×224.
2. **Embedding.** MobileNet v2 → `model.infer(img, true)` → vector normalizado L2.
3. **Comparación.** Para cada producto, similitud coseno contra sus fotos de referencia. La puntuación del producto es la media de sus 3 mejores coincidencias (o de las que tenga, si son menos).
4. **Resultado.** Se ordenan los productos y se muestran el mejor y las 2 alternativas siguientes. El porcentaje que se enseña es una **confianza relativa** (softmax con temperatura calibrable sobre las puntuaciones), no la similitud bruta.
5. **Umbral de duda.** Si la mejor puntuación es baja o está muy cerca de la segunda, no se propone nada como seguro: se muestra «No estoy seguro» con las alternativas y un buscador manual.
6. **Aprendizaje.** Al confirmar una retirada con buena confianza, opción (activada por defecto) de guardar esa foto como referencia adicional (`origen: 'confirmacion'`). Máximo 20 referencias por producto; si se supera, se descarta la más antigua de origen `confirmacion`.
7. **Modo diagnóstico** (en Ajustes): enseña las puntuaciones brutas de los 5 mejores productos y el tiempo de inferencia, para poder calibrar umbral y temperatura con nuestros productos reales. Esos dos valores son configurables en Ajustes.
8. El modelo se carga una vez al arrancar, con calentamiento previo, y se reutiliza. Objetivo: menos de 1 s por foto en un móvil normal.

**Alta de fotos de referencia:** desde la ficha del producto, «Añadir fotos». Se recomienda hacer entre 5 y 10 fotos con distintos ángulos y luz, y la app va indicando cuántas lleva («6 / 10»).

## 6. Diseño visual (obligatorio)

En `diseno/` están las 5 pantallas de referencia (`Main`, `Retirar`, `Pedir`, `Entrada`, `Producto`, archivos `.dc.html`). Son maquetas con estilos en línea, no código ejecutable: **léelas y reprodúcelas fielmente** (estructura, textos, jerarquía, espaciados y colores).

Estética: **instrumental de laboratorio**. Sobria, técnica, como una etiqueta de reactivo o el software de un equipo. Tiene que parecer una herramienta profesional, **no una app genérica hecha con IA**.

### Tokens
```css
--fondo: #F3F4F1;        /* gris papel */
--superficie: #FFFFFF;
--superficie-2: #ECEEEA; /* control segmentado, fondos secundarios */
--tinta: #15181B;
--tinta-2: #5B636B;      /* texto secundario, etiquetas */
--linea: #D9DCD6;        /* bordes */
--linea-2: #E4E6E1;      /* separadores dentro de tarjetas */
--accion: #2340B8;       /* azul: retirar, confirmar, guardar */
--accion-suave: #E6EAFB; --accion-texto: #1B33A0;
--alerta: #B4470F;       /* naranja óxido: bajo mínimo (insignias) */
--alerta-texto: #9A3B0B; --alerta-suave: #FBEDE2;
--visor: #0E1114;        /* fondo de la cámara */
```
- **Tipografía:** IBM Plex Sans para el texto. **IBM Plex Mono** para cantidades, códigos (R-014), ubicaciones, lotes, fechas y todas las etiquetas pequeñas en MAYÚSCULAS con letter-spacing (`ARMARIO 2 · BALDA 3`, `STOCK ACTUAL`).
- Radios: 8–12 px en tarjetas y campos, 6 px en insignias. Bordes finos de 1 px en lugar de sombras.
- Datos presentados como **fichas técnicas**: rejillas con líneas finas (bloques «PRODUCTOS / BAJO MÍNIMO / CADUCAN <30 D», «STOCK ACTUAL / TRAS RETIRAR»).
- El naranja **solo** se usa para «bajo mínimo». El estado nunca se indica solo con color: siempre va acompañado de texto («BAJO MÍN. 5»).
- Iconos: SVG de trazo fino (1,6–1,8 px), coherentes entre sí. **Prohibido:** emojis, degradados de colores, sombras grandes, ilustraciones decorativas, tarjetas con borde lateral de color, textos tipo «¡Genial! 🎉».
- Zonas táctiles de al menos 44×44 px. Contraste de texto AA. Etiquetas `<label>` reales en los formularios.
- Barra inferior fija: Stock · A pedir (con contador) · **botón central azul de cámara (Retirar)** · Entrada · Catálogo.

## 7. Pantallas y comportamiento

1. **Stock (inicio).** Cabecera blanca: nombre del laboratorio (configurable), título «Stock», estado (en fase 1, «Guardado en este móvil»; en fase 2, la hora de sincronización) y botón de perfil/ajustes. Debajo, el bloque de resumen; la celda «Bajo mínimo» lleva a «A pedir». Buscador (nombre, código o ubicación) más botón de filtros/orden. Control segmentado Todos / Reactivos / Fungible con contadores. Lista **agrupada por armario**, con una fila por producto: código, nombre, línea secundaria (formato · último movimiento o balda/caducidad), cantidad en mono y estado («BAJO MÍN. X» en naranja o «MÍN. X» en gris). Al tocar una fila se abre la ficha.
2. **Retirar con foto.** Visor oscuro con marco y botones de cerrar y linterna (si el dispositivo la tiene). Tras la foto aparece una hoja inferior con: confianza, nombre, formato y ubicación; «Stock actual → Tras retirar»; selector de cantidad (−/+, 1 por defecto); botón «Confirmar retirada»; «¿No es este?» con 2 alternativas y un enlace para buscar a mano. Al confirmar se muestra un aviso breve con «Deshacer» durante unos segundos.
3. **A pedir.** Productos con stock ≤ mínimo: quedan / mínimo / cantidad sugerida, y botón «Marcar pedido». Debajo, la sección «Pedidos en curso» con su fecha. El botón «Compartir lista» genera un texto limpio (y opcionalmente un CSV) y usa Web Share, o copia al portapapeles si no está disponible.
4. **Registrar entrada.** Selector de producto con buscador, unidades recibidas con −/+ grande, «Stock X → Y», lote y caducidad opcionales, nota opcional. Si con la entrada el producto supera el mínimo, se indica que saldrá de «A pedir».
5. **Ficha de producto.** Datos en rejilla (stock, avisar con ≤, unidad, ubicación), galería de fotos de reconocimiento (n / 10 y botón de añadir), historial de movimientos (cantidad, tipo, fecha, usuario). Editar y archivar producto. Ajuste manual de stock con motivo, que queda como movimiento `ajuste`.
6. **Catálogo / alta de producto.** Lista de todos los productos y formulario de alta: nombre, categoría, formato, unidad, armario, balda, mínimo, cantidad sugerida y stock inicial. Al final del alta se pasa directamente a hacer las fotos de referencia.
7. **Ajustes.** Nombre del laboratorio, usuario actual, umbral y temperatura del reconocimiento, modo diagnóstico, **exportar/importar copia de seguridad en JSON** (incluidos embeddings y miniaturas en base64; es importante porque en fase 1 los datos solo viven en el móvil) y borrar todos los datos (con confirmación escrita).

**Primer arranque:** pedir nombre o iniciales del usuario y nombre del laboratorio, y ofrecer cargar unos datos de ejemplo (los productos de las maquetas) o empezar vacío.

**Avisos:** cuando una retirada deja un producto en su mínimo o por debajo, se muestra un aviso en la app y, si el usuario ha dado permiso, una notificación local (Notification API). En los navegadores que lo permitan, el número de productos bajo mínimo aparece en el icono (`navigator.setAppBadge`). Los avisos por correo o Teams quedan para la fase 2.

## 8. Calidad y forma de trabajar

- Trabaja **por etapas** y enséñame el resultado de cada una antes de seguir:
  1. Esqueleto (Vite, PWA, fuentes, tokens, navegación, repositorio local con datos de ejemplo).
  2. Pantallas Stock, Ficha, Catálogo/alta y Entrada, con la lógica de stock y sus tests.
  3. Cámara y reconocimiento, con alta de fotos de referencia, retirada con foto y modo diagnóstico.
  4. A pedir, avisos, compartir lista y copia de seguridad.
  5. Pulido visual comparando con `diseno/`, accesibilidad y prueba en móvil real.
- Usa Git y haz un commit por etapa con un mensaje claro en español.
- La cámara necesita **HTTPS**. Para probar en el móvil desde el ordenador, configura `@vitejs/plugin-basic-ssl` y `vite --host`, y explícame cómo abrirlo desde el móvil en la misma red. Prepara también un despliegue gratuito (GitHub Pages o Netlify) para cuando la red no lo permita.
- Antes de añadir una dependencia nueva que no esté en §3, pregúntame.
- Mantén un `README.md` en español con cómo arrancar, probar en el móvil, instalar la app y hacer copias de seguridad.
