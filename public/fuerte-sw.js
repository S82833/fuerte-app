// Only public, explicitly listed assets belong in this cache. API traffic is network-only.
const CACHE_PREFIX = 'fuerte-product:';
const CACHE = `${CACHE_PREFIX}__BUILD_VERSION__`;
const PRECACHE = __PRECACHE_FILES__;
const OFFLINE_URL = new URL('/pwa/offline.html', self.location.origin).href;
const ASSET_URLS = new Set(PRECACHE.map(file => new URL(file, self.location.origin).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map(file => new Request(new URL(file, self.location.origin), {cache: 'reload'})));
    // Updated workers wait for open tabs to close, preserving forms in progress.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const cache = await caches.open(CACHE);
        return await cache.match(OFFLINE_URL) || new Response('Fuerte necesita conexión a internet.', {
          status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
    })());
    return;
  }
  if (!ASSET_URLS.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
