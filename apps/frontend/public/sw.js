// Wavee's service worker: the app opens fast and works on a bad connection,
// but a new release is always picked up on the next visit.
//  - Pages: network first, the cached app shell when offline.
//  - /assets/* (hashed, never change): cache first.
//  - Icons: cached, refreshed in the background.
//  - The API, Supabase and media (songs, videos, covers) are never touched.
const CACHE = 'wavee-v7';
const SHELL = '/index.html';
const PRECACHE = [SHELL, '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const save = (request, response) => {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep the latest shell for offline use (song and artist pages
          // carry their own preview tags, so only the plain shell is kept).
          if (response.ok && !/^\/(songs|u)\//.test(url.pathname)) save(SHELL, response.clone());
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((r) => save(request, r))));
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((r) => save(request, r))
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
