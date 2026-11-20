# Prueba en el móvil real (etapa 5)

Lista para probar la app en los móviles del laboratorio. Apunta lo que falle (con captura si se
puede) y, en el reconocimiento, los números del modo diagnóstico.

App: <https://elivic19-hue.github.io/stock-laboratorio/>

## 1. Instalar

- [ ] Android (Chrome): menú ⋮ → «Instalar aplicación». Se abre desde el icono, sin barra del navegador.
- [ ] iPhone (Safari): Compartir → «Añadir a pantalla de inicio». Abrir desde el icono.
- [ ] Con el modo avión puesto, la app abre y funciona (también la cámara y el reconocimiento).

## 2. Reconocimiento con productos reales

1. Ajustes → Reconocimiento → activa **Modo diagnóstico**.
2. Elige 5 o 6 productos, mejor si algunos se parecen (puntas de distintos tamaños, botellas iguales
   con distinta etiqueta).
3. En la ficha de cada uno, «+» en *Fotos de reconocimiento*: 8–10 fotos con distintos ángulos,
   distancia y luz, en su sitio del armario.
4. Botón azul de la cámara: 5 fotos de cada producto, como se haría al cogerlo.

Apunta para cada foto:

| Producto fotografiado | ¿Lo acierta? | Puntuación del 1.º | Puntuación del 2.º (cuál) | Tiempo |
| --- | --- | --- | --- | --- |
| | | | | |

- [ ] Una foto de algo que no está en el catálogo dice «No estoy seguro».
- [ ] El tiempo por foto es menor de 1 s.
- [ ] La linterna se enciende (si el móvil la tiene).
- [ ] Ajustes → Reconocimiento dice «autoprueba superada» en cada móvil (apunta cuál dice que usa el
      procesador porque la GPU calculaba mal).
- [ ] Ajustes → Fotos de referencia → «Revisar fotos»: todos los productos del catálogo salen «Bien»
      (si no, seguir lo que dice cada fila).
- [ ] Tapando la cámara con el dedo, la foto se rechaza («ha salido negra»).

Con esos números se ajustan el umbral (ahora 0,6) y la temperatura (0,05).

## 3. Uso diario

- [ ] Retirar con foto: confirmar, y «Deshacer» en el aviso.
- [ ] Registrar una entrada con lote y caducidad (mes/año).
- [ ] Anular el último movimiento desde la ficha.
- [ ] Dar de alta un producto de prueba con stock inicial y lote: el lote sale en el historial de la
      ficha («Ajuste · … · lote … · Stock inicial»). Después, eliminarlo.
- [ ] A pedir: «Marcar pedido», compartir la lista por WhatsApp o correo, y el CSV.
- [ ] Al registrar la entrada de un producto pedido, sale de «Pedidos en curso».

## 4. Avisos

- [ ] Ajustes → Avisos → activar. Llega el aviso de prueba.
- [ ] Retirar hasta dejar un producto en su mínimo: llega la notificación y, al tocarla, se abre «A pedir».
- [ ] Con la app instalada en Android, el icono enseña el número de productos a pedir.
- [ ] (Android, al día siguiente) Si hay lotes caducados, llega el aviso diario.

## 5. Compartir entre móviles

Las cuentas se crean en Firebase → Authentication → Usuarios (README, «Cuentas y laboratorios»).

- [ ] Móvil A: abrir la app → pide correo y contraseña → entrar → elegir Lab. Cromatografía.
- [ ] Móvil B: entrar con otra cuenta y elegir el mismo laboratorio. Ve el mismo stock.
- [ ] Una retirada en A aparece en B en unos segundos (y al revés).
- [ ] Ordenador: abrir la web, entrar y ver el mismo stock.
- [ ] Ajustes → Cambiar de laboratorio → Lab. Food Contact: stock distinto (vacío al principio). Un
      producto dado de alta aquí no aparece en Cromatografía.
- [ ] Cerrar la app y volver a abrirla: entra directamente en el último laboratorio, sin pedir nada.
- [ ] Ajustes → Cerrar sesión → vuelve a pedir correo y contraseña.
- [ ] Sin conexión en A: retirar algo. La cabecera dice «Sin conexión · 1 por enviar». Al volver la
      red se manda solo y aparece en B.
- [ ] A y B sin conexión, retiran 1 cada uno del mismo producto; al volver, el stock baja 2.

## 6. Copia de seguridad

- [ ] Descargar copia y comprobar que el archivo está en Descargas (o enviarla por correo).
- [ ] En otro móvil (sin conectar): restaurar esa copia y ver los mismos productos y fotos.
