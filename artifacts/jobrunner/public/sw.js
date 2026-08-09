const CACHE_NAME = 'jobrunner-v8';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-32.png',
  '/icon-192.png'
];

const API_CACHE_NAME = 'jobrunner-api-v3';
const IMAGE_CACHE_NAME = 'jobrunner-images-v3';
const MAX_IMAGE_CACHE_SIZE = 50;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') {
      return;
    }
    
    if (url.pathname.includes('/api/stripe') || 
        url.pathname.includes('/api/auth') ||
        url.pathname.includes('/api/user')) {
      return;
    }

    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            cache.put(request, responseToCache);
          }
          return networkResponse;
        } catch (error) {
          console.log('[SW] Network failed, trying cache for:', url.pathname);
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            JSON.stringify({ error: 'Offline - no cached data available' }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        }
      })
    );
    return;
  }

  if (request.destination === 'image') {
    const isSameOrigin = url.origin === self.location.origin;
    const isPrivateUrl = url.pathname.includes('/api/') || url.search.includes('token');
    
    if (!isSameOrigin || isPrivateUrl) {
      return;
    }

    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
          }).catch(() => {});
          return cachedResponse;
        }
        
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            cache.put(request, responseToCache);
            
            cache.keys().then((keys) => {
              if (keys.length > MAX_IMAGE_CACHE_SIZE) {
                cache.delete(keys[0]);
              }
            });
          }
          return networkResponse;
        } catch (error) {
          return caches.match('/favicon-192.png')
            .then(fallback => fallback || new Response('', { status: 404 }));
        }
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/').then((response) => {
          return response || new Response(
            '<!DOCTYPE html><html><body><h1>Offline</h1><p>JobRunner requires an internet connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
  }
});
