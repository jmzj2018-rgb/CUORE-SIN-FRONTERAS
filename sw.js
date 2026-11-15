const CACHE_NAME = "turnos-vet-v2"; // Subir el número fuerza renovación
const ASSETS = ["./", "./index.html", "./app.js", "./manifest.json"];

self.addEventListener("install", e => {
  self.skipWaiting(); // Activa el nuevo SW inmediatamente sin esperar
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", e => {
  // Borra cachés viejas automáticamente
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  return self.clients.claim();
});

// Estrategia Network-First: siempre busca la versión fresca primero
self.addEventListener("fetch", e => {
  if (e.request.url.includes("script.google.com")) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
