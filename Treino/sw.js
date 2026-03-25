const CACHE_NAME = 'futevolei-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Instala o motor e salva os arquivos no cache do celular
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Faz o app rodar sem internet puxando do cache
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Achou no cache, retorna!
        }
        return fetch(event.request); // Não achou, busca na internet
      }
    )
  );
});