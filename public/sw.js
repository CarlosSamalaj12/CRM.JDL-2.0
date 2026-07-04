const CACHE_NAME = 'jardines-ems-cache-v2';
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

  // Extraer automáticamente el ID del usuario activo desde el token JWT de las peticiones
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const payloadBase64 = token.split('.')[1];
      // Convertir Base64URL a Base64 estándar antes de decodificar con atob
      const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);
      if (payload && payload.id) {
        activeUserId = payload.id;
      }
    }
  } catch (err) {
    // Ignorar silenciosamente errores de parseo
  }

  // 1. Skip API, Socket.io, Firebase, and dynamic Vite assets entirely (do not cache)
  if (
    url.pathname.includes('api') || 
    url.pathname.includes('socket.io') ||
    url.pathname.includes('firebase-messaging-sw.js') ||
    url.pathname.includes('/assets/') ||
    request.url.includes('api') ||
    request.url.includes('socket.io') ||
    request.url.includes('firebase-messaging-sw.js') ||
    request.url.includes('/assets/') ||
    request.url.includes('googleapis.com') ||
    request.url.includes('fcmregistrations')
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

let activeUserId = null;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_ACTIVE_USER') {
    activeUserId = event.data.userId;
    console.log('[SW] Usuario activo registrado en SW:', activeUserId);
  }
});

// Evento push: Recibir mensaje del backend y mostrar notificación flotante
self.addEventListener('push', (event) => {
  event.waitUntil(
    Promise.resolve().then(() => {
      let data = {};
      if (event.data) {
        try {
          data = event.data.json();
        } catch (e) {
          data = { title: 'Jardines del Lago', body: event.data.text() };
        }
      }

      // Si el autor de la mención es el mismo usuario logueado en este navegador, NO notificar
      if (data.data?.autorId && activeUserId && String(data.data.autorId) === String(activeUserId)) {
        console.log('[SW] Ignorando notificacion push de autoria propia.');
        return;
      }

      const title = data.title || 'Jardines del Lago';
      const options = {
        body: data.body || 'Nueva notificación recibida',
        icon: '/logo.png',
        badge: '/icons/icon-192.png',
        vibrate: [100, 50, 100],
        data: data.data || {}
      };

      return self.registration.showNotification(title, options);
    })
  );
});

// Evento click: Abrir la ventana de la PWA al presionar la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const path = event.notification.data?.url || '/';
  const absoluteUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Buscar si ya hay alguna ventana abierta del mismo origen
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin)) {
          matchingClient = client;
          break;
        }
      }

      // Si la ventana ya existe, enfocarla (síncrono al gesto del usuario) y enviar postMessage con respaldo de navigate
      if (matchingClient) {
        if ('focus' in matchingClient) {
          matchingClient.focus();
        }
        // Comunicar al frontend la navegación requerida en caliente (React-side)
        matchingClient.postMessage({ type: 'NAVIGATE_TO', url: absoluteUrl });
        
        // Respaldo doble: si la PWA no reacciona al postMessage, forzar navegación nativa del cliente
        if ('navigate' in matchingClient) {
          return matchingClient.navigate(absoluteUrl);
        } else {
          matchingClient.url = absoluteUrl;
          return;
        }
      }

      // Si no hay ninguna ventana abierta, abrir una nueva inmediatamente
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }
    })
  );
});
