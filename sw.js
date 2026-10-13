// __BUILD_ID__ e înlocuit de build.sh (cu hash-ul commit-ului pe Cloudflare Pages, cu
// un timestamp la deploy manual), ca fiecare publicare să producă un sw.js diferit la
// nivel de octet → browserul detectează SW nou → skipWaiting + controllerchange
// declanșează reload automat (update instant, nu „un reload în urmă").
// NU redenumi placeholderul fără să actualizezi build.sh — build-ul pică intenționat
// dacă substituția nu se aplică. Servit direct din folderul sursă (test local),
// literalul rămâne pe loc, ceea ce e ok.
const CACHE_NAME = 'minlon-__BUILD_ID__';
const ASSETS = [
  './',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo.svg',
  './fonts/inter.woff2',
  './fonts/inter-ext.woff2',
  './fonts/spacegrotesk.woff2',
  './fonts/spacegrotesk-ext.woff2',
  './fonts/ibmplexmono-500.woff2',
  './fonts/ibmplexmono-500-ext.woff2',
  './fonts/ibmplexmono-600.woff2',
  './fonts/ibmplexmono-600-ext.woff2',
  './fonts/ibmplexmono-700.woff2',
  './fonts/ibmplexmono-700-ext.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stale-while-revalidate: servește instant din cache dacă există (rapid, offline-ok),
// dar mereu reîmprospătează cache-ul în fundal cu o cerere reală la rețea — altfel un
// deploy nou rămâne "prins" în cache la nesfârșit, indiferent de câte refresh dă omul
// (refresh normal nu ocolește Cache Storage API-ul unui Service Worker activ).
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      const network = fetch(event.request)
        .then((response) => {
          // Cachează doar răspunsuri bune (2xx same-origin) — altfel un 404/500 prins
          // în timpul unui deploy la mijloc ar putea rămâne temporar în cache.
          if (response.ok && response.type === 'basic') {
            cache.put(event.request, response.clone());
          }
          // Un ServiceWorker nu poate respondWith() un răspuns "redirected" pentru
          // o navigare (Chrome respinge cu ERR_FAILED) - reconstruim un Response
          // curat dacă a existat un redirect pe parcurs (ex. Cloudflare Pages
          // redirectează /index.html -> /).
          if (response.redirected && event.request.mode === 'navigate') {
            return response.blob().then((body) => new Response(body, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            }));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
