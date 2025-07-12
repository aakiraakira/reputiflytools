const CACHE_NAME = 'reputifly-notes-cache-v3'; // Updated version
const urlsToCache = [
  '/',
  '/note',
  '/manifest.json',
  '/reputiflyicon.jpg', // Use the correct icon filenames
  '/reputiflylogo.png',
  '/favicon.ico'
];

self.addEventListener('install', event => {
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
        return response || fetch(event.request);
      })
  );
});
