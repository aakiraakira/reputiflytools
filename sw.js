const CACHE_NAME = 'reputifly-notes-cache-v2'; // Updated version
const urlsToCache = [
  '/',
  '/index.html',
  '/notetakeapp.html', // The notes app itself
  '/note.html',
  '/note',
  '/manifest.json',
  '/reputiflyicon.jpg',
  '/reputiflylogo.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
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
