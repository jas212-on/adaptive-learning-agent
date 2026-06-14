const CACHE_NAME = 'ala-v1'
const STATIC_ASSETS = ['/', '/index.html']
const API_CACHE = 'ala-api-v1'
const CACHEABLE_API_PATHS = ['/api/detector/topics', '/api/analytics', '/api/streaks']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API_PATHS.some((p) => url.pathname.startsWith(p))
    if (isCacheable && request.method === 'GET') {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(API_CACHE).then((cache) => cache.put(request, clone))
            }
            return response
          })
          .catch(() => caches.match(request))
      )
      return
    }
    // Non-cacheable API: just pass through
    return
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})

// Listen for sync events (background sync for offline writes)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_REQUESTED' }))
      })
    )
  }
})
