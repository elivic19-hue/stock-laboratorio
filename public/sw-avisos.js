/*
 * Avisos del móvil desde el service worker (etapa 4). Se añade al service worker que genera
 * vite-plugin-pwa con `workbox.importScripts` (vite.config.ts).
 *
 * - Aviso diario de lotes caducados con Periodic Background Sync: el sistema despierta el service
 *   worker como mucho dos veces al día, aunque la app esté cerrada (Chrome para Android con la app
 *   instalada). Se avisa una vez al día como mucho.
 * - Número de productos a pedir en el icono de la app.
 * - Al tocar una notificación, se abre la app en la pantalla que corresponde.
 *
 * Lee la base de datos de la app (IndexedDB) directamente. Repite, en pequeño, la lógica de
 * src/dominio/resumen.ts (lotesCaducados) y src/dominio/stock.ts (productosAPedir): si cambian,
 * hay que cambiarla aquí también.
 */
;(() => {
  const BASE_DATOS = 'stock-laboratorio'
  const ETIQUETA_AVISO_DIARIO = 'avisos-diarios'
  const CLAVE_AJUSTES = 'dispositivo'
  const MAX_NOMBRES = 3

  function peticion(req) {
    return new Promise((resolver, rechazar) => {
      req.onsuccess = () => resolver(req.result)
      req.onerror = () => rechazar(req.error)
    })
  }

  /** Abre la base de datos sin crearla si todavía no existe (la crea la app con Dexie). */
  function abrirBaseDatos() {
    return new Promise((resolver, rechazar) => {
      const req = indexedDB.open(BASE_DATOS)
      req.onupgradeneeded = () => req.transaction.abort()
      req.onsuccess = () => resolver(req.result)
      req.onerror = () => rechazar(req.error)
    })
  }

  function fechaSinHora(fecha) {
    const dos = (n) => String(n).padStart(2, '0')
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
  }

  async function revisarAvisos() {
    let db
    try {
      db = await abrirBaseDatos()
    } catch {
      return // Aún no hay datos.
    }
    try {
      const t = db.transaction(['productos', 'movimientos', 'pedidos', 'ajustes'])
      const [productos, entradas, pedidos, registro] = await Promise.all([
        peticion(t.objectStore('productos').getAll()),
        peticion(t.objectStore('movimientos').index('tipo').getAll('entrada')),
        peticion(t.objectStore('pedidos').index('estado').getAll('pedido')),
        peticion(t.objectStore('ajustes').get(CLAVE_AJUSTES)),
      ])
      const ajustes = (registro && registro.valor) || {}
      const hoy = fechaSinHora(new Date())
      const activos = productos.filter((p) => !p.archivado)

      // Número en el icono: en su mínimo o por debajo y sin pedido en curso.
      const pedidosEnCurso = new Set(pedidos.map((p) => p.productoId))
      const aPedir = activos.filter((p) => p.stockActual <= p.stockMinimo && !pedidosEnCurso.has(p.id)).length
      try {
        if (aPedir > 0) await self.navigator.setAppBadge?.(aPedir)
        else await self.navigator.clearAppBadge?.()
      } catch {
        // Sin soporte para el número en el icono.
      }

      // Lotes caducados de productos con stock que nadie ha dado por terminados.
      const conStock = new Map(activos.filter((p) => p.stockActual > 0).map((p) => [p.id, p]))
      const caducados = entradas.filter(
        (m) => m.caducidad && !m.loteCerrado && conStock.has(m.productoId) && m.caducidad < hoy,
      )
      if (
        caducados.length === 0 ||
        !ajustes.avisosEnElMovil ||
        Notification.permission !== 'granted' ||
        ajustes.ultimoAvisoCaducados === hoy
      ) {
        return
      }

      const nombres = [...new Set(caducados.map((m) => conStock.get(m.productoId).nombre))]
      const lista =
        nombres.length > MAX_NOMBRES
          ? `${nombres.slice(0, MAX_NOMBRES).join(', ')} y ${nombres.length - MAX_NOMBRES} más`
          : nombres.join(', ')
      await self.registration.showNotification(
        caducados.length === 1 ? '1 lote caducado' : `${caducados.length} lotes caducados`,
        {
          body: `${lista}. Desecha el lote o marca «Ya no queda».`,
          tag: 'caducados',
          icon: 'iconos/icono-192.png',
          lang: 'es-ES',
          data: { ruta: '#/caducidades' },
        },
      )

      const escritura = db.transaction('ajustes', 'readwrite').objectStore('ajustes')
      const actual = await peticion(escritura.get(CLAVE_AJUSTES))
      await peticion(
        escritura.put({ clave: CLAVE_AJUSTES, valor: { ...(actual && actual.valor), ultimoAvisoCaducados: hoy } }),
      )
    } finally {
      db.close()
    }
  }

  function revisar(evento) {
    evento.waitUntil(
      revisarAvisos().catch((error) => console.warn('No se pudieron revisar los avisos', error)),
    )
  }

  self.addEventListener('periodicsync', (evento) => {
    if (evento.tag === ETIQUETA_AVISO_DIARIO) revisar(evento)
  })

  // Para probarlo sin esperar al sistema: postMessage({ tipo: 'revisar-avisos' }).
  self.addEventListener('message', (evento) => {
    if (evento.data && evento.data.tipo === 'revisar-avisos') revisar(evento)
  })

  self.addEventListener('notificationclick', (evento) => {
    evento.notification.close()
    const ruta = (evento.notification.data && evento.notification.data.ruta) || ''
    const alcance = self.registration.scope
    evento.waitUntil(
      (async () => {
        const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        const abierta = ventanas.find((v) => v.url.startsWith(alcance))
        if (abierta) {
          await abierta.focus()
          abierta.postMessage({ tipo: 'navegar', ruta })
        } else {
          await self.clients.openWindow(alcance + ruta)
        }
      })(),
    )
  })
})()
