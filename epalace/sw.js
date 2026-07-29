// Service worker for the E-Palace client app (scope: /epalace/).
// Precaches the app shell so it opens offline; Firebase/Google API calls always
// go to the network (never cached).
const CACHE = 'epalace-app-v4';
const SHELL = [
    './',
    'index.html',
    'app.css',
    'fb-common.js',
    'auth.js',
    'data.js',
    'app.js',
    'offline-order.html',
    'bootstrap.min.css',
    'firebase-config.js',
    'firebase-rest.js',
    'offline-db.js',
    'offline-order.js',
    'manifest.webmanifest',
    'icon.svg',
    'icon-192.png',
    'icon-512.png',
    'icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    let url; try { url = new URL(req.url); } catch { return; }

    // Firebase / Google APIs: always network, never cache.
    if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) return;

    // Navigations: serve the matching cached page (index.html / offline-order.html),
    // falling back to the app shell, then the network.
    if (req.mode === 'navigate') {
        e.respondWith(
            caches.match(req).then((c) => c || caches.match('index.html')).then((c) => c || fetch(req))
        );
        return;
    }

    // Same-origin static assets: cache-first, populate on miss.
    if (url.origin === self.location.origin) {
        e.respondWith(
            caches.match(req).then((cached) => cached ||
                fetch(req).then((r) => {
                    const copy = r.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
                    return r;
                })
            ).catch(() => fetch(req))
        );
        return;
    }

    e.respondWith(fetch(req));
});
