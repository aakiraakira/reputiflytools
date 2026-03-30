// Network-first strategy: always try network, fall back to cache
// Cache name includes timestamp so each deploy gets fresh cache
const CACHE_NAME = 'review-dash-v3';

self.addEventListener('install', e => {
  self.skipWaiting(); // Immediately activate new SW
});

self.addEventListener('activate', e => {
  // Delete ALL old caches on activation
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Network-first: try fetch, cache result, fall back to cache if offline
  e.respondWith(
    fetch(e.request).then(response => {
      // Cache successful responses
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => caches.match(e.request))
  );
});
