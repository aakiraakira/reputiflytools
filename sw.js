// sw.js

// A new cache name to ensure the service worker updates
const CACHE_NAME = 'reputifly-notes-cache-v4';

// All the files your app needs to load, including from CDNs
const urlsToCache = [
  // Local files
  '/',
  '/note', // As per your firebase.json rewrite
    // As per your firebase.json rewrite
  '/manifest.json',
  '/icon-192.png', // Correct icon from manifest.json
  '/icon-512.png', // Correct icon from manifest.json

  // External Stylesheets
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css',

  // External Scripts
  'https://cdn.tailwindcss.com?plugins=typography',
  'https://unpkg.com/feather-icons',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js',
  'https://unpkg.com/vis-network@9.1.2/dist/vis-network.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/lunr/lunr.min.js',

  // Firebase SDKs
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'
];

// On install, cache all the important files
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache. Caching all application assets.');
        // Use a more robust caching strategy that ignores query parameters for fonts
        const requests = urlsToCache.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .catch(error => {
        console.error('Failed to cache assets during install:', error);
      })
  );
});

// On fetch, serve from cache first, then go to the network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If we have a match in the cache, return it.
        if (response) {
          return response;
        }

        // Otherwise, fetch from the network.
        return fetch(event.request).then(
          networkResponse => {
            // If the fetch was successful, clone it and cache it for next time.
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        );
      })
  );
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                 .map(cacheName => caches.delete(cacheName))
      );
    })
  );
});
