// Wavee's service worker: the app opens fast and works on a bad connection,
// but a new release is always picked up on the next visit.
//  - Pages: network first, the cached app shell when offline.
//  - /assets/* (hashed, never change): cache first, in their own cache, trimmed so old
//    releases don't pile up. The current release's files are cached at install, so the app
//    opens offline after a single visit.
//  - Icons: cached, refreshed in the background.
//  - The API, Supabase and media (songs, videos, covers) are never touched.
const CACHE = 'wavee-v8';
const ASSETS = 'wavee-assets-v1';
const KEEP_ASSETS = 160;
const SHELL = '/index.html';
const PRECACHE = [SHELL, '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

/** The scripts and styles the current page needs, read from the shell. */
async function shellAssets() {
  try {
    const html = await (await fetch('/', { cache: 'no-store' })).text();
    return [...new Set(html.match(/\/assets\/[\w.-]+\.(?:js|css)/g) ?? [])];
  } catch {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
      shellAssets().then((list) => caches.open(ASSETS).then((cache) => cache.addAll(list).catch(() => undefined))),
    ]),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== ASSETS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const save = (cacheName, request, response) => {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(cacheName).then(async (cache) => {
      await cache.put(request, copy);
      if (cacheName !== ASSETS) return;
      // Oldest first: drop what's beyond the limit (old releases).
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - KEEP_ASSETS)).map((k) => cache.delete(k)));
    });
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
          // Keep the latest shell for offline use (song, artist and campaign pages
          // carry their own preview tags, so only the plain shell is kept).
          if (response.ok && !/^\/(songs|u)\/|^\/(founding|picks)$/.test(url.pathname)) save(CACHE, SHELL, response.clone());
          return response;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            // A file from an older release is gone: the server answers with the app's page.
            // Never keep that under the script's name.
            const type = response.headers.get('content-type') ?? '';
            return type.includes('text/html') ? response : save(ASSETS, request, response);
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request)
        .then((r) => save(CACHE, request, r))
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
