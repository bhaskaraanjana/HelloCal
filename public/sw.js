// CACHE_NAME and ASSETS_TO_CACHE are REPLACED at build time by the
// hellocal-sw-precache Vite plugin (see vite.config.ts): the cache name gets a
// content hash so every content deploy ships a byte-changed sw.js (which is what
// makes open tabs detect the update and reload), and the precache list is expanded
// to include the actual hashed JS/CSS bundles so an activate-time purge of the old
// cache can't strand a tab without its bundles. The defaults below keep the worker
// functional in `vite dev` (where the plugin doesn't run).
const CACHE_NAME = 'hellocal-cache-dev'; // replaced at build time with a content hash
const ASSETS_TO_CACHE = ['/', '/index.html', '/offline.html', '/manifest.json', '/favicon.svg', '/favicon.png', '/icon-192.png', '/icon-512.png', '/icons.svg', '/apple-touch-icon.png', '/logo.svg']; // replaced at build time with the full precache manifest

const FONT_CACHE = 'hellocal-fonts';
const isFontHost = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Per-URL adds tolerate an individual 404/rename: one missing asset must not
      // reject the whole install and silently disable all offline support.
      Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn('SW precache skipped:', url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          // Keep the current build's cache and the long-lived font cache; purge every
          // prior build's cache so storage can't grow unbounded across deploys.
          if (cache !== CACHE_NAME && cache !== FONT_CACHE) {
            return caches.delete(cache);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Don't intercept dev HMR / module requests.
  if (url.pathname.includes('@vite') || url.pathname.includes('node_modules')) return;

  // Cross-origin Google Fonts: stale-while-revalidate into a dedicated cache. The
  // default cache-first branch skips these (response.type is 'cors'/'opaque'), so
  // without this the app loses Inter/Outfit offline and falls back to system fonts.
  if (isFontHost(url)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const network = fetch(event.request)
          .then(async (res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              await cache.put(event.request, res.clone());
              // Bound the font cache (opaque responses are quota-padded) so it can't
              // grow without limit and pressure the precache. Simple FIFO trim.
              const keys = await cache.keys();
              if (keys.length > 30) await cache.delete(keys[0]);
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  const isHtmlOrManifest =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/manifest.json';

  if (isHtmlOrManifest) {
    // Network-first so online users always get the latest HTML/manifest.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(event.request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/offline.html'))
          );
        })
    );
  } else {
    // Cache-first for hashed bundles + static assets.
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            return response;
          })
          .catch(() => caches.match('/offline.html'));
      })
    );
  }
});
