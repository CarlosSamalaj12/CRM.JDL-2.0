const CACHE_NAME = 'jardines-ems-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install event: cache initial shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: handle offline fallback and runtime caching
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip API and Socket.io requests entirely (do not cache)
  if (
    url.pathname.includes('api') || 
    url.pathname.includes('socket.io') ||
    request.url.includes('api') ||
    request.url.includes('socket.io')
  ) {
    return;
  }

  // 2. Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // Offline fallback: return cached SPA index.html
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 3. Static assets (JS, CSS, images, fonts)
  if (
    request.method === 'GET' &&
    (url.origin === self.location.origin || url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com'))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch updated version in the background (stale-while-revalidate)
          fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !request.url.includes('cdn.jsdelivr.net') && !request.url.includes('fonts.')) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  }
});
