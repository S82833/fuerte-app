const BASE = new URL('./', self.location.href).href;
const CACHE_PREFIX = `fuerte:${BASE}:`;
const CACHE = `${CACHE_PREFIX}__BUILD_VERSION__`;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch(new URL('precache.json', BASE), { cache: 'no-store' });
    if (!response.ok) throw new Error('Offline manifest unavailable');
    const files = await response.json();
    await cache.addAll([BASE, ...files.map(file => new URL(file, BASE).href)]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
    for (const client of await self.clients.matchAll()) client.postMessage({ type: 'OFFLINE_READY' });
  })());
});
self.addEventListener('message', event => {
  if (event.data === 'CACHE_STATUS') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (await cache.match(BASE)) event.source?.postMessage({ type: 'OFFLINE_READY' });
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(BASE)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request); }
      catch { return await cache.match(BASE) || new Response('Abre Fuerte con conexión para preparar el modo sin internet.', { status: 503 }); }
    }
    return await cache.match(event.request) || fetch(event.request);
  })());
});
