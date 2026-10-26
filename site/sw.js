// Service worker: keeps the app shell available offline.
var CACHE = "eternity-v12";
var SHELL = ["./", "./index.html", "./styles.css", "./config.js", "./data.js", "./app.js", "./proposals.js", "./icons/logo-eternity.jpg", "./icons/logo-eternity-sm.jpg", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (/supabase\.co$/.test(url.hostname) || url.hostname.indexOf("nominatim") >= 0) return; // live data: never cache
  // network first for our own files (so updates arrive), cache fallback offline; cache-first for fonts/libs
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(function (r) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return r; }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match("./index.html"); }); }));
  } else {
    e.respondWith(caches.match(req).then(function (m) { return m || fetch(req).then(function (r) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return r; }); }));
  }
});
