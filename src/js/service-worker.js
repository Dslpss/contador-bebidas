const CACHE_NAME = "bebidas-app-v2"; // Incrementar versão para forçar atualização do cache
const RUNTIME_CACHE = "runtime-cache";

// Assets para cache inicial (críticos para o funcionamento básico da aplicação)
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/main.js",
  "/css/main.css",
  "/assets/favicon.ico",
];

// Cache estratégia: cache first, network fallback para arquivos críticos
// Recursos dinâmicos: network first, cache fallback

// Instalação do service worker - precarregar recursos críticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Ativação - limpar caches antigos
self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return cacheNames.filter(
          (cacheName) => !currentCaches.includes(cacheName)
        );
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            return caches.delete(cacheToDelete);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Estratégia de cache
self.addEventListener("fetch", (event) => {
  // Ignorar requisições para o Firebase e análise
  if (
    event.request.url.includes("firestore.googleapis.com") ||
    event.request.url.includes("analytics") ||
    event.request.url.includes("firebase")
  ) {
    return;
  }

  // Estratégia para arquivos HTML: Network first, fall back to cache
  if (
    event.request.mode === "navigate" ||
    (event.request.method === "GET" &&
      event.request.headers.get("accept").includes("text/html"))
  ) {
    event.respondWith(
      fetch(event.request).catch((error) => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Estratégia para assets estáticos: Cache first, network fallback
  if (event.request.url.match(/\.(js|css|png|jpg|jpeg|svg|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return caches.open(RUNTIME_CACHE).then((cache) => {
          return fetch(event.request).then((response) => {
            // Guardar em cache apenas se a resposta for válida
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Para outras requisições, tenta rede com fallback para cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Background sync para operações offline
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-dados") {
    event.waitUntil(syncDados());
  }
});

// Função para sincronizar dados pendentes
async function syncDados() {
  // Implementar sincronização de dados armazenados localmente quando offline
  const dbPromise = await self.indexedDB.open("offlineData", 1);
  // Implementação da sincronização
}
