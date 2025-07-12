const CACHE_NAME = 'reputifly-notes-cache-v2'; // Updated version
const urlsToCache = [
  '/',
  '/note', // IMPORTANT: This should match your clean URL
  '/manifest.json',
  '/reputiflyicon.png',
  '/reputiflylogo.png'
];

self.addEventListener('install', event => {
  // Skips waiting and activates the new service worker immediately
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching files.');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
