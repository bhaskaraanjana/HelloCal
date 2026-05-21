const CACHE_NAME = 'halocal-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/favicon.png',
  '/icons.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle standard GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Prevent intercepting dev HMR requests
  if (url.pathname.includes('@vite') || url.pathname.includes('node_modules')) {
    return;
  }

  // Determine if it is the HTML shell or manifest
  const isHtmlOrManifest = 
    event.request.mode === 'navigate' || 
    url.pathname === '/' || 
    url.pathname.endsWith('.html') || 
    url.pathname === '/manifest.json';

  if (isHtmlOrManifest) {
    // Strategy: Network-First (ensure users get the absolute latest HTML/manifest version when online)
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If offline, serve the cached index.html shell
          return caches.match(event.request);
        })
    );
  } else {
    // Strategy: Cache-First (hashed bundles, static assets, and media)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        }).catch(() => {
          // Silent offline fallback
        });
      })
    );
  }
});
