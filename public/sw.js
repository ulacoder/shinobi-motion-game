// Сервис-воркер: держит тяжёлые файлы распознавания и озвучку в кэше браузера.
// При повторном открытии игры движок, модель и голоса берутся с диска — без сети.
// Страница и код игры сюда не попадают, поэтому новая версия сайта видна сразу.
const CACHE = 'shinobi-assets-v1';
const HEAVY = /\/(wasm|models|voices)\//;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || !HEAVY.test(url.pathname)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok && res.status === 200) cache.put(event.request, res.clone()).catch(() => {});
      return res;
    })(),
  );
});
