// Service worker: mantém a casca do app disponível sem internet.
// ATENÇÃO: todo arquivo da lista SHELL precisa existir — um 404 faz o cache.addAll falhar e o app não instala.
var CACHE = "nivela-v4";
var SHELL = [
  "./", "./index.html", "./styles.css", "./i18n.js", "./i18n.en.js", "./config.js", "./data.js", "./app.js", "./proposals.js", "./settings.js", "./onboarding.js", "./help.js", "./manifest.webmanifest",
  "./brand/tokens.css", "./brand/fonts/inter-400.woff", "./brand/fonts/inter-500.woff", "./brand/fonts/inter-600.woff", "./brand/fonts/inter-700.woff",
  "./brand/fonts/inter-display-600.woff", "./brand/fonts/inter-display-700.woff",
  "./brand/favicon-16.png", "./brand/favicon-32.png", "./brand/apple-touch-icon-180.png", "./brand/logo-escuro.svg", "./brand/logo-claro.svg", "./brand/logo-mono.svg", "./brand/mark.svg",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./icons/logo-eternity.png", "./icons/mark-eternity.png", "./icons/logo-bluestar.png", "./icons/mark-bluestar.png"
];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (/supabase\.co$/.test(url.hostname) || url.hostname.indexOf("nominatim") >= 0) return; // dados ao vivo: nunca em cache
  // rede primeiro para os nossos arquivos (atualizações chegam), cache se estiver sem internet; cache primeiro para bibliotecas externas
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(function (r) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return r; }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match("./index.html"); }); }));
  } else {
    e.respondWith(caches.match(req).then(function (m) { return m || fetch(req).then(function (r) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return r; }); }));
  }
});
