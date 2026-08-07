const CACHE_NAME = 'vo-performance-v5';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  '../../assets/images/vo-performance-icon.svg'
];

// Instala o motor e salva os arquivos no cache do celular
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Faz o app rodar sem internet puxando do cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(fetch(event.request)
    .then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    })
    .catch(() => caches.match(event.request).then(response => response || caches.match('./index.html'))));
});
