const CACHE_NAME = 'bebidas-app-v1';
const urlsToCache = [
  '/',
  '/src/pages/index.html',
  '/src/css/styles.css',
  '/src/js/main.js',
  // Adicione outros arquivos que você quer que sejam cacheados
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
