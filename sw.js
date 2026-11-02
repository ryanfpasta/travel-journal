// Offline support. The app's own files are cached on install, so the journal opens with no signal.
// Bump VERSION on every release; the app offers the update and the journal data is untouched.
var VERSION = "1.1.0";
var APP_CACHE = "journal-app-" + VERSION;
var TILE_CACHE = "journal-tiles";
var MAX_TILES = 3000;
var FILES = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "js/zip.js", "js/exif.js", "js/store.js", "js/photos.js", "js/app.js",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
  "memorybox/index.html", "memorybox/app.js", "memorybox/style.css",
  "memorybox/lib/leaflet.css", "memorybox/lib/leaflet.js", "memorybox/lib/topojson-client.min.js", "memorybox/lib/world.js",
  "memorybox/lib/images/layers.png", "memorybox/lib/images/layers-2x.png", "memorybox/lib/images/marker-icon.png",
  "memorybox/lib/images/marker-icon-2x.png", "memorybox/lib/images/marker-shadow.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(APP_CACHE).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); })); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("journal-app-") === 0 && k !== APP_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (e) { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "tile.openstreetmap.org") {
    // Map tiles you've looked at stay available offline.
    e.respondWith(caches.open(TILE_CACHE).then(function (c) {
      return c.match(e.request).then(function (hit) {
        if (hit) return hit;
        return fetch(e.request).then(function (res) {
          if (res.ok) { c.put(e.request, res.clone()); trim(c); }
          return res;
        });
      });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request);
  }));
});

var trimming = false;
function trim(c) {
  if (trimming) return;
  trimming = true;
  c.keys().then(function (keys) {
    var extra = keys.length - MAX_TILES;
    return Promise.all(keys.slice(0, Math.max(0, extra)).map(function (k) { return c.delete(k); }));
  }).finally(function () { trimming = false; });
}
