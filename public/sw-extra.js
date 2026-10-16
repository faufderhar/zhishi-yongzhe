/* r9：新 SW 激活时删掉不认识的旧缓存（r1–r8 留下的旧预缓存/运行时缓存），只保留当前 Workbox 预缓存与 zy-* 运行时缓存 */
self.addEventListener('activate', e => {
  const keep = n => /^workbox-precache-v2-/.test(n) || ['zy-anim', 'zy-monsters', 'zy-sfx-skills', 'zy-kimg'].includes(n);
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => !keep(k)).map(k => caches.delete(k)))));
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
