/* Static app shell only. Never add runtime data or API caching here. */
const CACHE_PREFIX = 'hytteappen-shell-'
const CACHE_NAME = CACHE_PREFIX + '__SHELL_VERSION__'
const SHELL_URLS = __SHELL_URLS__
const shellPaths = new Set(SHELL_URLS)

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    // Bypass HTTP caches so a new deployment gets its own complete shell.
    await cache.addAll(SHELL_URLS.map((url) => new Request(url, {
      cache: 'reload', credentials: 'omit',
    })))
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name)
    }
  })())
})

// Activation is explicit, so a deployment cannot interrupt a form being edited.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // Restrict navigation fallback to React routes. Functions and APIs always use the network.
  const appRoute = /^\/(?:$|login\/?$|innstillinger(?:\/|$)|offline-innhold\/?$|guide(?:\/|$)|booking(?:\/|$)|familieoversikt(?:\/|$)|noticeboard(?:\/|$))/.test(url.pathname)
  const navigation = request.mode === 'navigate' && appRoute
  if (!navigation && (url.search || !shellPaths.has(url.pathname))) return

  event.respondWith((async () => {
    // HTML must come from the current deployment when reachable. Only fall back
    // to the precached static shell when the network cannot serve the page.
    if (navigation) {
      try {
        const response = await fetch(request, { cache: 'no-store' })
        if (response.ok) return response
      } catch { /* Use the complete offline shell below. */ }
    }
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(navigation ? '/index.html' : url.pathname)
    return response || fetch(request)
  })())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { /* Display a fallback for malformed payloads. */ }
  event.waitUntil(self.registration.showNotification(
    typeof payload.title === 'string' ? payload.title : 'Hytteappen',
    {
      body: typeof payload.body === 'string' ? payload.body : 'Du har et nytt varsel i Hytteappen.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: typeof payload.url === 'string' ? payload.url : '/' },
    },
  ))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    let url = new URL('/', self.location.origin)
    try {
      const target = new URL(event.notification.data?.url || '/', self.location.origin)
      if (target.origin === self.location.origin) url = target
    } catch { /* Open the app home for invalid destinations. */ }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.navigate(url.href)
        await client.focus()
        return
      }
    }
    await self.clients.openWindow(url.href)
  })())
})
