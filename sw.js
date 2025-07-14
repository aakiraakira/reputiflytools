// sw.js

// A new cache name to force the browser to update the service worker
const CACHE_NAME = 'reputifly-notes-cache-v8';

// The list of files to pre-cache when the app is first loaded.
// This is a "best-effort" step. The real power is in the fetch event handler.
const urlsToCache = [
  '/',
  '/note',
  '/notes',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.tailwindcss.com?plugins=typography',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css'
];

// --- INSTALL: Pre-cache the main application shell ---
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.warn('App shell caching failed. Assets will be cached on first use.', err);
      })
  );
});

// --- ACTIVATE: Clean up old caches ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
});

// --- FETCH: Implement Stale-While-Revalidate Strategy ---
self.addEventListener('fetch', event => {
  // Ignore requests for Firebase Firestore, as it has its own offline mechanism.
  if (event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        // Create a promise for the network request
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If the network request is successful, update the cache
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return the cached response immediately if available,
        // while the network request runs in the background.
        return cachedResponse || fetchPromise;
      });
    })
  );
});
