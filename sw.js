/**
 * Enhanced Service Worker for Reputifly AI Note Taker
 *
 * Version: v1.1
 *
 * Features:
 * - Full App Shell Caching: Caches all necessary static assets for offline use.
 * - Resilient Caching: Skips over any single file that fails to cache during installation.
 * - Offline Navigation Fallback: Ensures the app loads even when offline.
 * - Cache-First Strategy: Provides instant loading for static assets.
 * - Automatic Cache Cleanup: Removes old caches to save user's storage space.
 * - Immediate Control: The new service worker takes control as soon as it's activated.
 */

// --- 1. Configuration ---

// IMPORTANT: Increment this version number every time you update the service worker file.
const CACHE_NAME = 'reputifly-notes-cache-v41';

// A comprehensive list of all files that make up the application's "shell".
const APP_SHELL_URLS = [
    // Core navigation paths
    '/',
    '/note',
    '/note.html', // The main HTML file is the most important fallback
    '/manifest.json',

    // Icons from your manifest
    '/icon-192.png',
    '/icon-512.png',

    // Third-party CSS and Fonts
    'https://cdn.tailwindcss.com?plugins=typography',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css',

    // Third-party JavaScript Libraries
    'https://unpkg.com/feather-icons',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js',
    'https://unpkg.com/vis-network@9.1.2/dist/vis-network.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    'https://cdn.jsdelivr.net/npm/lunr/lunr.min.js',
    'https://cdn.jsdelivr.net/npm/fuse.js/dist/fuse.min.js',
    'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.1/dist/browser-image-compression.js'
];

// --- 2. Service Worker Event Listeners ---

/**
 * INSTALL Event
 * Caches all the files defined in APP_SHELL_URLS.
 * This version is resilient and will not fail if a single file is unavailable.
 */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching App Shell...');
            // Use individual add() calls within a Promise.all to prevent one failed request
            // from stopping the entire caching process.
            const promises = APP_SHELL_URLS.map(url => {
                return cache.add(url).catch(err => {
                    console.warn(`[SW] Failed to cache ${url}. Skipping. Error: ${err}`);
                });
            });
            return Promise.all(promises);
        }).then(() => {
            // Force the waiting service worker to become the active service worker.
            return self.skipWaiting();
        })
    );
});

/**
 * ACTIVATE Event
 * This is the perfect place to clean up old, unused caches.
 * It also takes immediate control of the page.
 */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            ).then(() => {
                // Tell the active service worker to take control of the page immediately.
                return self.clients.claim();
            });
        })
    );
});

/**
 * FETCH Event
 * This is where we define our caching strategies for different types of requests.
 */
self.addEventListener('fetch', event => {
    // We only care about GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    // Strategy 1: Cache-First for static assets (CSS, JS, Fonts, Images)
    // This makes the app load instantly from the cache.
    if (APP_SHELL_URLS.some(url => event.request.url.startsWith(url.split('?')[0]))) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
        );
        return;
    }

    // Strategy 2: Network-First, Fallback to Cache for Navigation
    // This ensures users get the latest version of the app page if they are online,
    // but still allows the app to load from cache if they are offline.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                console.log('[SW] Navigation failed. Falling back to cached HTML.');
                return caches.match('/note.html');
            })
        );
        return;
    }

    // Default strategy for any other requests (e.g., Firebase API calls)
    // is to just let them go to the network.
    event.respondWith(fetch(event.request));
});
