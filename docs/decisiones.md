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
| 7. Caducidad: ¿mes/año o fecha completa? ¿Estimar lotes que quedan y contar lo ya caducado? | Regla de §4 tal cual: entradas que caducan entre hoy y 30 días, de productos con stock. |
| 8. % de confianza con softmax: las alternativas salen bajas (no 71 % / 38 % como en la maqueta). | Se propone mantener el softmax (§5). |
| 9. Cantidad por retirada (p. ej. bolsa de 100 tapones). | Se propone poder teclear la cantidad y un campo opcional «cantidad por retirada». |
| 10. Fotos: la ficha muestra «n / 10» y el máximo es 20. | El repositorio ya aplica el máximo de 20; la galería se decide en la etapa 3. |
| ¿El móvil de prueba lo usará una persona o varias? | Sin respuesta: un usuario por móvil, que se cambia en Ajustes. |
