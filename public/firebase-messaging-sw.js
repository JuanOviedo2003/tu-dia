/* Service Worker para notificaciones push (Firebase Cloud Messaging).
 * Infra: Dani. Contenido de notificaciones: Ana (backend) / Beto (frontend).
 * La version del SDK debe coincidir con `firebase` en package.json.
 * El archivo se sirve desde la raiz del sitio para que el scope sea '/'.
 */
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js')

// La config se inicializa cuando el frontend llama a
// registration.active.postMessage({ type: 'firebase-config', config }) tras
// getToken(). Hasta entonces, el SW solo encola notificaciones en background.
let appInited = false

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'firebase-config' && !appInited) {
    try {
      firebase.initializeApp(event.data.config)
      appInited = true
    } catch (err) {
      // inicializacion multiple u config invalida: ignorar
    }
  }
})

try {
  const messaging = firebase.messaging()
  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || 'Tu Dia'
    self.registration.showNotification(title, {
      body: (payload.notification && payload.notification.body) || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.data && payload.data.roomId ? 'room-' + payload.data.roomId : 'tu-dia',
      data: payload.data || {},
    })
  })
} catch (err) {
  // Si firebase.messaging() falla (sin config aun), onBackgroundMessage se
  // registra en el proximo SW update. Las notificaciones llegan igual via
  // push event por defecto de FCM.
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if ('focus' in client) return client.focus()
    }
    return clients.openWindow('/')
  }))
})
