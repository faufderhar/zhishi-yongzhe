/* r9：新 SW 激活时删掉不认识的旧缓存（r1–r8 留下的旧预缓存/运行时缓存），只保留当前 Workbox 预缓存与 zy-* 运行时缓存 */
self.addEventListener('activate', e => {
  const keep = n => /^workbox-precache-v2-/.test(n) || ['zy-anim', 'zy-monsters', 'zy-sfx-skills', 'zy-voice', 'zy-kimg', 'zy-pages'].includes(n);
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !keep(k)).map(k => caches.delete(k)))));
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
/* r10：页面导航网络优先（3 秒超时），拿到就存一份；没网 / 超时才用缓存（先 zy-pages，再预缓存的 index.html）。
   普通刷新 / 重新打开都能直接拿到最新 index.html，不再被旧缓存卡住 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode !== 'navigate' || req.method !== 'GET') return;
  e.respondWith((async () => {
    const fallback = async () => (await caches.match(req, { ignoreSearch: true, cacheName: 'zy-pages' }))
      || (await caches.match(new URL('index.html', self.registration.scope).href, { ignoreSearch: true }))
      || Response.error();
    try {
      const net = await Promise.race([fetch(req, { cache: 'no-cache' }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
      if (net && net.ok) { const c = await caches.open('zy-pages'); await c.put(new URL('./', self.registration.scope).href, net.clone()); return net; }
      return (await fallback()) || net;
    } catch { return fallback(); }
  })());
});
