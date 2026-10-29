const CACHE = "dompetku-pwa-v68";
// Semua path dihitung relatif terhadap lokasi sw.js, jadi tetap benar
// baik di root domain (GitHub Pages/cPanel) maupun di subfolder.
const BASE = self.registration.scope;
const APP_SHELL = new URL("index.html", BASE).href;
const CORE_ASSETS = [
  "index.html",
  "app.js",
  "live-voice.js",
  "telemetry.js",
  "assets/tailwind.css",
  "assets/js/chart.umd.min.js",
  "assets/fa/css/all.min.css",
  "assets/fa/webfonts/fa-solid-900.woff2",
  "assets/fa/webfonts/fa-brands-400.woff2",
  "manifest.webmanifest",
  "favicon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/ai-sparkles.png"
].map((p) => new URL(p, BASE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(CORE_ASSETS.map((u) => c.add(u)))).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  // CDN (tailwind/chart/fontawesome/google) + backend telemetry lintas origin
  // biarkan ke network, jangan di-cache SW.
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to the cached app shell (offline).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(APP_SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(APP_SHELL).then((r) => r || Response.error())),
    );
    return;
  }

  // Same-origin static assets: cache first.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }),
    ),
  );
});
