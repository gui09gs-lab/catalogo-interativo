// Service worker do Catálogo Interativo Kilews.
// Páginas e catálogo: tenta a rede primeiro (para receber atualizações) e cai no cache sem internet.
// Fontes do Google: cache primeiro.
const VERSAO = "kw-4b5e64f07b";
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
const ESPERA_REDE_MS = 8000;

self.addEventListener("install", (e) => {
  // cache: "reload" ignora o cache HTTP do navegador, senão a versão nova poderia guardar arquivos antigos
  e.waitUntil(caches.open(VERSAO)
    .then((c) => c.addAll(ESSENCIAIS.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
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
    // no-cache: sempre confere com o servidor (resposta 304 é rápida), em vez de confiar no cache HTTP
    const rede = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((resp) => {
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
  if (url.origin === self.location.origin && url.pathname.endsWith("/versao.json")) return;
  if (url.origin === self.location.origin) {
    e.respondWith(redePrimeiro(req));
  } else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cachePrimeiro(req));
  }
});
