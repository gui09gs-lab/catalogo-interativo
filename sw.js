// Service worker do Catálogo Interativo Kilews.
// Páginas e catálogo: tenta a rede primeiro (para receber atualizações) e cai no cache sem internet.
// Fontes do Google: cache primeiro.
const VERSAO = "kw-eb1960faa0";
const ESSENCIAIS = [
  "./",
  "index.html",
  "catalogo.enc",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-64.png"
];
const ESPERA_REDE_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function redePrimeiro(req) {
  return caches.open(VERSAO).then((cache) => {
    const rede = fetch(req).then((resp) => {
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    });
    const limite = new Promise((ok) => setTimeout(ok, ESPERA_REDE_MS));
    // Rede lenta em campo: depois do limite, entrega o que estiver no cache.
    return Promise.race([rede, limite.then(() => cache.match(req, { ignoreSearch: true }).then((r) => r || rede))])
      .catch(() => cache.match(req, { ignoreSearch: true }))
      .then((r) => r || cache.match("index.html"));
  });
}

function cachePrimeiro(req) {
  return caches.open(VERSAO).then((cache) =>
    cache.match(req).then((r) => r || fetch(req).then((resp) => {
      if (resp.ok || resp.type === "opaque") cache.put(req, resp.clone());
      return resp;
    }))
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(redePrimeiro(req));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cachePrimeiro(req));
  }
});
