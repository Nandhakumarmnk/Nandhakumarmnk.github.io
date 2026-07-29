// Service worker for the E-Palace field order app (scope: /epalace/).
// Precaches the app shell so the page opens with zero connection; Firestore
// REST calls are always passed straight to the network (never cached).
const CACHE = 'epalace-field-v1';
const SHELL = [
    './',
    'index.html',
    'bootstrap.min.css',
    'firebase-config.js',
    'firebase-rest.js',
    'offline-db.js',
    'offline-order.js',
    'manifest.webmanifest',
    'icon-192.png',
    'icon-512.png',
    'icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;

    let url;
    try { url = new URL(req.url); } catch { return; }

    // Firestore (and other Google APIs): always network, never cache.
    if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) return;

    // App navigations: serve the cached shell so it works fully offline.
    if (req.mode === 'navigate') {
        e.respondWith(caches.match('index.html').then((c) => c || fetch(req)));
        return;
    }

    // Same-origin static assets: cache-first, populate on miss.
    if (url.origin === self.location.origin) {
        e.respondWith(
            caches.match(req).then((cached) =>
                cached ||
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
