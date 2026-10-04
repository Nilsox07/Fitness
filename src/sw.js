/* Custom Service Worker (vite-plugin-pwa injectManifest).
   Behält Precaching/Auto-Update und ergänzt Push-Benachrichtigungen. */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Seitenaufrufe IMMER aus der vorgeladenen index.html der GLEICHEN Version
// bedienen. So passen HTML, CSS und JS garantiert zusammen — kein halb
// aktualisierter Zustand mehr (unstyled/„nur HTML"). /api bleibt außen vor.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

self.skipWaiting()
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Fitness Tracker'
  const body = data.body || 'Zeit fürs nächste Training! 💪'
  // Eigener Tag je Art, damit ein Cheat-Meal-Alarm nicht die Trainings-
  // Erinnerung ersetzt (und umgekehrt). Der Server schickt aktuell nur
  // {title, body}; Cheat-Pushes erkennt man am Titel („… hat gesündigt").
  const isCheat = data.kind === 'cheat' || /gesündigt/i.test(title)
  const tag = data.tag || (isCheat ? 'fitness-cheat' : 'fitness-reminder')
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : isCheat ? '/feed' : '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag,
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => 'focus' in c)
      if (client) {
        // Zur Ziel-Seite wechseln (gleiche Origin), dann fokussieren.
        const nav = url !== '/' && 'navigate' in client ? client.navigate(url).catch(() => client) : null
        return Promise.resolve(nav).then((c) => (c || client).focus())
      }
      return self.clients.openWindow(url)
    }),
  )
})
